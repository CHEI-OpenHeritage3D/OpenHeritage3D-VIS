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
 * Memory stays bounded however large the ledger is:
 *  - Rows are joined in chunks and each chunk goes straight into a gzip
 *    stream, so only the compressed file accumulates, never the CSV text
 *    (12.8M rows is ~0.5 GB of text).
 *  - Override nodes are loaded a few at a time (EXPORT_PREFETCH ahead of the
 *    writer) and disposed once their rows are written, unless the renderer is
 *    using them. Potree's LRU only evicts nodes it has drawn, so a node loaded
 *    off-screen would otherwise stay in memory for good.
 */

const WORLD_EXPORT_FORMAT = "world-v1";
const CSV_CHUNK_ROWS      = 50000;
const WORLD_DECIMALS      = 3;      // metres → mm. Matches typical LAS scale.
const EXPORT_PREFETCH     = 8;      // override nodes loading or loaded ahead of the writer

/**
 * Collects CSV rows in chunks and feeds each chunk to a gzip stream as it fills.
 * Call drain() at yield points so a slow compressor holds the producer back
 * instead of queueing text, finish() for the .gz Blob, abort() on failure.
 */
class GzipCsvSink {
    constructor() {
        const cs     = new CompressionStream("gzip");
        this.writer  = cs.writable.getWriter();
        this.result  = new Response(cs.readable).blob();   // drains compressed bytes as they come
        this.encoder = new TextEncoder();
        this.buf     = [];
    }
    push(line) {
        this.buf.push(line);
        if (this.buf.length >= CSV_CHUNK_ROWS) this.flush();
    }
    pushAll(lines) { for (const l of lines) this.push(l); }
    flush() {
        if (!this.buf.length) return;
        const bytes = this.encoder.encode(this.buf.join("\n") + "\n");
        this.buf = [];
        this.writer.write(bytes).catch(() => {});   // failures surface via close() / result
    }
    drain() { return this.writer.ready; }
    async finish() {
        this.flush();
        await this.writer.close();
        return this.result;
    }
    abort(reason) {
        this.buf = [];
        this.result.catch(() => {});
        this.writer.abort(reason).catch(() => {});
    }
}

/**
 * Frees a node the export loaded once its rows are written. Leaves it alone when
 * the renderer has it (it is in Potree's LRU, which will evict it in its own time)
 * or someone else, such as a brush stroke, is waiting on it.
 */
function releaseExportNode(geoNode) {
    if (!geoNode.loaded || geoNode.parent == null) return;   // the root is never disposed
    if (Potree.lru.items[geoNode.id]) return;
    if (_loadAwaiters.has(geoNode)) return;
    geoNode.dispose();
}

function saveWorldExport(gz, kind, extension) {
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
    const sink = new GzipCsvSink();
    try {
        await writeWorldSpace(sink, onProgress);
        saveWorldExport(await sink.finish(), "world", ".csv.gz");
    } catch (e) {
        sink.abort(e);
        throw e;
    }
}

async function writeWorldSpace(sink, onProgress) {
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
    const jobs = [];
    let overrideTotal = 0;
    for (const [pcName, pcEdits] of brushEdits) {
        const pc = viewer.scene.pointclouds.find(p => p.name === pcName);
        if (!pc) continue;
        for (const [nodeName, entry] of pcEdits) {
            const overrides = getOverrides(entry);
            if (!overrides || overrides.size === 0) continue;
            const geoNode = getNode(pc, nodeName);
            if (!geoNode) continue;
            jobs.push({ pc, nodeName, geoNode, overrides, ready: null });
            overrideTotal += overrides.size;
        }
    }

    sink.push("#OVERRIDES");
    sink.push("classification,x,y,z");

    let emitted = 0, skippedNodes = 0, skippedRows = 0;
    const tmpPos = new THREE.Vector3();
    const request = job => { job.ready = waitForLoad(job.geoNode); };
    for (let i = 0; i < Math.min(EXPORT_PREFETCH, jobs.length); i++) request(jobs[i]);

    for (let j = 0; j < jobs.length; j++) {
        const { pc, nodeName, geoNode, overrides } = jobs[j];
        if (j + EXPORT_PREFETCH < jobs.length) request(jobs[j + EXPORT_PREFETCH]);

        await jobs[j].ready;
        jobs[j].ready = null;
        if (!geoNode.loaded) await waitForLoad(geoNode);   // evicted after it was requested

        const positions = geoNode.geometry?.attributes?.position;
        if (!positions) {
            skippedNodes++;
            skippedRows += overrides.size;
            console.warn(`World export: no positions for ${pc.name}/${nodeName}; ${overrides.size} overrides skipped`);
            continue;
        }

        // Hold the array itself: the node may be evicted while this loop yields
        const arr         = positions.array;
        const nodeMatrix  = new THREE.Matrix4().makeTranslation(...geoNode.boundingBox.min.toArray());
        const matrixWorld = new THREE.Matrix4().multiplyMatrices(pc.matrixWorld, nodeMatrix);

        for (const [pIndex, cls] of overrides) {
            const ix = 3 * pIndex;
            tmpPos.set(arr[ix], arr[ix + 1], arr[ix + 2]).applyMatrix4(matrixWorld);
            sink.push(
                `${cls},` +
                `${tmpPos.x.toFixed(WORLD_DECIMALS)},` +
                `${tmpPos.y.toFixed(WORLD_DECIMALS)},` +
                `${tmpPos.z.toFixed(WORLD_DECIMALS)}`
            );
            emitted++;

            if (emitted % 5000 === 0) {
                onProgress?.(emitted, overrideTotal);
                await sink.drain();
                await new Promise(r => setTimeout(r, 0));
            }
        }
        releaseExportNode(geoNode);
    }
    sink.push("#END_OVERRIDES");

    if (skippedNodes) {
        console.warn(`World export: ${skippedRows} overrides in ${skippedNodes} nodes were skipped (no point data)`);
    }
    onProgress?.(overrideTotal, overrideTotal);
}
