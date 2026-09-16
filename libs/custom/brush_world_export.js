/**
 * brush_world_export.js
 *
 * World-space export for the Classification Brush — replaces exportPythonCSV().
 *
 * Emits a gzipped CSV for downstream LAS/LAZ application. Unlike the Potree
 * ledger export, this one carries no octree identifiers: the consumer has no
 * octree, so pointcloud names and node names are meaningless to it. The one
 * thing the node name *did* carry that still matters is depth, which decides
 * which of two overlapping AABBs wins — that survives as its own column.
 *
 * Format (#FORMAT,world-v1):
 *
 *   #METADATA … #END_METADATA
 *   #CLASSIFICATIONS … #END_CLASSIFICATIONS        (only when custom)
 *   #AABBS
 *   depth,classification,min_x,min_y,min_z,max_x,max_y,max_z
 *   …                                               (sorted by depth ascending)
 *   #END_AABBS
 *   #OVERRIDES
 *   classification,x,y,z
 *   …
 *   #END_OVERRIDES
 *
 * Application order is AABBs by ascending depth, then overrides. Sorting at
 * export means the consumer can apply in file order within one file; when
 * merging several files it must re-sort all AABBs by depth globally, which is
 * why the column is here rather than implied.
 *
 * Rows are joined in chunks rather than accumulated as one giant array —
 * 12.8M individual JS strings is well over a gigabyte of heap before join()
 * allocates the result again.
 */

const WORLD_EXPORT_FORMAT = "world-v1";
const CSV_CHUNK_ROWS      = 50000;
const WORLD_DECIMALS      = 3;      // metres → mm. Matches typical LAS scale.

/**
 * Accumulates CSV rows and joins them in chunks, so peak heap stays at one
 * chunk of strings rather than the whole file.
 */
class CsvChunkSink {
    constructor() { this.chunks = []; this.buf = []; }
    push(line) {
        this.buf.push(line);
        if (this.buf.length >= CSV_CHUNK_ROWS) this.flush();
    }
    pushAll(lines) { for (const l of lines) this.push(l); }
    flush() {
        if (!this.buf.length) return;
        this.chunks.push(this.buf.join("\n") + "\n");
        this.buf = [];
    }
    toBlob(type = "text/csv") { this.flush(); return new Blob(this.chunks, { type }); }
}

async function downloadGzipped(blob, kind, extension) {
    const gz = await new Response(
        blob.stream().pipeThrough(new CompressionStream("gzip"))
    ).blob();

    const who  = getContributorName().replace(/[^\w\-]/g, "_");
    const tile = (getTileIndexes() || "").replace(/[^\w\-]/g, "_");
    const pcs  = [...brushEdits.keys()].join("_");
    const name = [pcs, tile, who, kind].filter(Boolean).join("_") + extension;

    const url = URL.createObjectURL(gz);
    const a = document.createElement("a");
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

/**
 * Depth of an octree node from its name: "r" is 0, "r0" is 1, "r034" is 3.
 */
function nodeDepth(nodeName) { return nodeName.length - 1; }

async function exportWorldSpace(onProgress) {
    const sink = new CsvChunkSink();
    sink.pushAll(buildMetadataBlock(WORLD_EXPORT_FORMAT));

    // ── AABBs ── one row per implicit/hybrid region. No node load needed:
    //             bounding boxes come from the hierarchy, not the point data.
    const aabbRows = [];
    for (const [pcName, pcEdits] of brushEdits) {
        const pc = viewer.scene.pointclouds.find(p => p.name === pcName);
        if (!pc) continue;

        for (const [nodeName, entry] of pcEdits) {
            if (!isAllEntry(entry)) continue;
            const geoNode = getNode(pc, nodeName);     // O(depth), not a full-tree search
            if (!geoNode) continue;

            const box = geoNode.boundingBox.clone().applyMatrix4(pc.matrixWorld);
            const f = v => v.toFixed(WORLD_DECIMALS);
            aabbRows.push({
                depth: nodeDepth(nodeName),
                row: `${nodeDepth(nodeName)},${entry.classification},` +
                     `${f(box.min.x)},${f(box.min.y)},${f(box.min.z)},` +
                     `${f(box.max.x)},${f(box.max.y)},${f(box.max.z)}`
            });
        }
    }

    // Shallow first, so a deeper region always lands after the ancestor it
    // overrides. Same-depth octree nodes are disjoint, so their order is free.
    aabbRows.sort((a, b) => a.depth - b.depth);

    sink.push("#AABBS");
    sink.push("depth,classification,min_x,min_y,min_z,max_x,max_y,max_z");
    for (const r of aabbRows) sink.push(r.row);
    sink.push("#END_AABBS");

    // ── Overrides ── one row per explicit edit, in world coordinates.
    let overrideTotal = 0;
    for (const [, pcEdits] of brushEdits) {
        for (const [, entry] of pcEdits) {
            const overrides = getOverrides(entry);
            if (overrides) overrideTotal += overrides.size;
        }
    }

    sink.push("#OVERRIDES");
    sink.push("classification,x,y,z");

    let emitted = 0;
    const tmpPos = new THREE.Vector3();

    for (const [pcName, pcEdits] of brushEdits) {
        const pc = viewer.scene.pointclouds.find(p => p.name === pcName);
        if (!pc) continue;

        for (const [nodeName, entry] of pcEdits) {
            const overrides = getOverrides(entry);
            if (!overrides || overrides.size === 0) continue;

            const geoNode = getNode(pc, nodeName);
            if (!geoNode) continue;
            if (!geoNode.loaded) await waitForLoad(geoNode);

            const positions = geoNode.geometry?.attributes?.position;
            if (!positions) continue;

            const arr         = positions.array;
            const nodeMatrix  = new THREE.Matrix4().makeTranslation(...geoNode.boundingBox.min.toArray());
            const matrixWorld = new THREE.Matrix4().multiplyMatrices(pc.matrixWorld, nodeMatrix);

            for (const [pIndex, edit] of overrides) {
                const ix = 3 * pIndex;
                tmpPos.set(arr[ix], arr[ix + 1], arr[ix + 2]).applyMatrix4(matrixWorld);
                sink.push(
                    `${edit.classification},` +
                    `${tmpPos.x.toFixed(WORLD_DECIMALS)},` +
                    `${tmpPos.y.toFixed(WORLD_DECIMALS)},` +
                    `${tmpPos.z.toFixed(WORLD_DECIMALS)}`
                );
                emitted++;

                if (emitted % 5000 === 0) {
                    onProgress?.(emitted, overrideTotal);
                    await new Promise(r => setTimeout(r, 0));
                }
            }
        }
    }
    sink.push("#END_OVERRIDES");

    onProgress?.(overrideTotal, overrideTotal);
    await downloadGzipped(sink.toBlob(), "world", ".csv.gz");
}
