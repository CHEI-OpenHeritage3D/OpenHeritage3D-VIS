// ══════════════════════════════════════════════════════════════
//  Classification-array compressibility measurement
//
//  Produces the figures quoted against the brush ledger: the size of the
//  full per-point classification attribute, with the ledger applied, laid
//  out in octree order, and gzipped in that order.
//
//  Loaded on demand — NOT wired into index.html, since index.html is served
//  live. From the console:
//
//     document.head.appendChild(Object.assign(
//         document.createElement("script"),
//         { src: "libs/custom/classification_entropy.js" }));
//
//     await measureClassificationCompressibility();
//
//  Depends on brush_selection.js globals: waitForLoad, brushEdits,
//  applyLedgerToNode, BRUSH_MAX_NODES_LOADING. Both are classic scripts, so
//  their top-level bindings share the global lexical scope.
//
//  Streaming, not materializing. At ~456M points the classification array
//  alone is 456 MB, but holding every node's *geometry* resident (position
//  12B + rgba 4B + intensity 4B + class 1B + …) is ~9 GB. So nodes are
//  loaded, consumed into the gzip stream, and disposed as the walk goes.
// ══════════════════════════════════════════════════════════════

/**
 * @param {object}  [opts]
 * @param {object}  [opts.pointcloud]  defaults to viewer.scene.pointclouds[0]
 * @param {boolean} [opts.applyLedger=true]   false measures the unedited file state
 * @param {boolean} [opts.saveRaw=false]      also download the raw .bin (holds it in memory)
 * @param {number}  [opts.maxNodes=Infinity]  stop after N nodes — smoke test, result is PARTIAL
 * @param {function}[opts.onProgress]         (pointsDone, nodesDone) => void
 */
async function measureClassificationCompressibility(opts = {}) {
    const pc = opts.pointcloud ?? viewer.scene.pointclouds[1];
    if (!pc) throw new Error("no pointcloud loaded");

    const applyLedger = opts.applyLedger !== false;
    const pcEdits     = applyLedger ? (brushEdits.get(pc.name) ?? null) : null;
    const root        = pc.pcoGeometry.root;

    // Keep the render loop from competing for load slots and from re-requesting
    // every node the instant we dispose it. The cloud will mostly vanish on
    // screen for the duration; both are restored in the finally block.
    const prevBudget = Potree.pointBudget;
    const prevMax    = Potree.maxNodesLoading;
    Potree.pointBudget     = 1;
    Potree.maxNodesLoading = Math.max(prevMax, BRUSH_MAX_NODES_LOADING);

    // ── gzip sink ── drained concurrently, or writer.write() deadlocks on
    //                 backpressure once the internal queue fills.
    const cs      = new CompressionStream("gzip");
    const writer  = cs.writable.getWriter();
    let   gzBytes = 0;
    const drain   = (async () => {
        const reader = cs.readable.getReader();
        for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            gzBytes += value.byteLength;
        }
    })();

    const maxNodes = opts.maxNodes ?? Infinity;
    const STOP     = Symbol("maxNodes");

    const hist    = new Float64Array(256);
    const kept    = opts.saveRaw ? [] : null;
    let   total   = 0;
    let   nodes   = 0;
    let   runs    = 0;
    let   prevVal = -1;
    let   missing = 0;              // nodes that came back without a class attribute
    const tStart  = performance.now();

    try {
        await (async function visit(node) {
            if (!node.loaded) await waitForLoad(node);

            const classAttr = node.geometry?.attributes?.classification;
            if (classAttr) {
                // Ledger state, not file state. Called explicitly rather than
                // relying on reconcileFreshNode, so the result is the same
                // whether the node was already resident or just fetched.
                if (pcEdits) applyLedgerToNode(node, pcEdits);

                const n     = classAttr.count;
                const chunk = classAttr.array.slice(0, n);   // copy: node is disposed below

                for (let i = 0; i < n; i++) {
                    const v = chunk[i];
                    hist[v]++;
                    if (v !== prevVal) { runs++; prevVal = v; }
                }
                total += n;
                nodes++;

                if (kept) kept.push(chunk);
                await writer.write(chunk);
            } else {
                missing++;
            }

            // Children only exist once this node's hierarchy chunk has loaded,
            // so collect them after the await. Kick their fetches off without
            // awaiting: waitForLoad's queue caps in-flight at maxNodesLoading,
            // so this is lookahead, not a fan-out of the whole subtree.
            const children = [];
            for (let i = 0; i < 8; i++) if (node.children[i]) children.push(node.children[i]);
            for (const c of children) if (!c.loaded) waitForLoad(c);

            // Free before descending: peak residency stays at roughly
            // (in-flight + one sibling group per level) instead of the whole tree.
            if (node !== root) node.dispose();

            for (const c of children) await visit(c);

            if (opts.onProgress && nodes % 256 === 0) opts.onProgress(total, nodes);
            if (nodes >= maxNodes) throw STOP;
        })(root);

        await writer.close();
        await drain;
    } catch (e) {
        if (e === STOP) { await writer.close(); await drain; }
        else {
            try { await writer.abort(e); } catch (_) {}
            throw e;
        }
    } finally {
        Potree.pointBudget     = prevBudget;
        Potree.maxNodesLoading = prevMax;
    }

    // ── Order-0 entropy of the class histogram ──
    let entropyBits = 0;
    const classes = [];
    for (let v = 0; v < 256; v++) {
        if (hist[v] === 0) continue;
        const p = hist[v] / total;
        entropyBits -= p * Math.log2(p);
        classes.push({ classification: v, count: hist[v], fraction: p });
    }
    classes.sort((a, b) => b.count - a.count);

    const MB = b => b / 1e6;   // 10^6, to match the 455.7 MB / 73.2 MB figures
    const result = {
        pointcloud:      pc.name,
        partial:         nodes >= maxNodes,
        ledgerApplied:   !!pcEdits,
        points:          total,
        nodes,
        nodesWithoutClassification: missing,
        expectedPoints:  pc.pcoGeometry.loader?.metadata?.points ?? null,
        rawBytes:        total,
        rawMB:           MB(total),
        gzipBytes:       gzBytes,
        gzipMB:          MB(gzBytes),
        gzipBitsPerPoint: (gzBytes * 8) / total,
        gzipRatio:       total / gzBytes,
        entropyBitsPerPoint: entropyBits,
        entropyMB:       MB(total * entropyBits / 8),
        runs,
        meanRunLength:   total / runs,
        classes,
        elapsedSeconds:  (performance.now() - tStart) / 1000,
    };

    console.log(
        `%c${pc.name}%c  ${total.toLocaleString()} points in ${nodes.toLocaleString()} nodes` +
        `${pcEdits ? " (ledger applied)" : " (no ledger edits)"}\n` +
        `  raw     ${MB(total).toFixed(1)} MB   (1.000 bits/point)\n` +
        `  entropy ${MB(total * entropyBits / 8).toFixed(1)} MB   (${entropyBits.toFixed(3)} bits/point, order-0)\n` +
        `  gzip    ${MB(gzBytes).toFixed(2)} MB   (${((gzBytes * 8) / total).toFixed(4)} bits/point, ` +
        `${(total / gzBytes).toFixed(1)}x)\n` +
        `  runs    ${runs.toLocaleString()}  (mean run ${(total / runs).toFixed(1)} points)\n` +
        `  ${result.elapsedSeconds.toFixed(1)}s`,
        "font-weight:bold", "font-weight:normal"
    );
    if (result.partial) {
        console.warn(`PARTIAL: stopped at the maxNodes cap of ${maxNodes} — figures are not the full cloud.`);
    }
    if (!result.partial && result.expectedPoints !== null && result.expectedPoints !== total) {
        console.warn(`point count mismatch: walked ${total}, metadata says ${result.expectedPoints}`);
    }
    console.table(classes.slice(0, 20));

    if (kept) {
        const blob = new Blob(kept, { type: "application/octet-stream" });
        const a = Object.assign(document.createElement("a"), {
            href: URL.createObjectURL(blob),
            download: `${pc.name}_classification_octree_order.bin`,
        });
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 60000);
    }

    return result;
}
