/*
 * bench.js: the in-page half of the brush benchmark harness (tools/brush_bench).
 *
 * Defines window.__bench only on pages opened with ?bench=1. run.mjs injects this file before any
 * page script runs, so the viewer never serves it. To use the capture helper in an ordinary browser
 * instead of `node run.mjs capture`, paste it into the DevTools console of a ?bench=1 page.
 *
 * Hooks in libs/custom/brush_selection.js (added by patch_hooks.py):
 *   window.__bench?.onEditFlag?.()       a classification buffer was flagged for GPU upload
 *   window.__lastStrokeProfile = {...}    the stroke profiler's rows (BRUSH_PROFILE on)
 *
 * Page globals used (all from the viewer's classic scripts): viewer, Potree, THREE, brushState,
 * brushEdits, openBrushPanel, paintAtPoint, waitForLoad, pumpLoadQueue, leafExtentAt, pickAt,
 * showAllClassifications, setAutoSwitchState, _pendingPaints, _loadQueue, TWEEN, and for the
 * ledger size buildClassMap, encodeLedgerBody, buildMetadataBlock (brush_binary_export.js).
 */
(function () {
"use strict";
if (new URLSearchParams(location.search).get("bench") !== "1") {
    console.info("bench.js: inactive (open the page with ?bench=1)");
    return;
}
if (window.__bench) return;

const cfg = window.__benchConfig || {};
const B = window.__bench = { version: 1, cfg };

// ── Utilities ────────────────────────────────────────────────────────────────

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const nextFrame = () => new Promise((r) => requestAnimationFrame(r));
const now = () => performance.now();
const round = (x, d = 1) => (x === null || x === undefined || !isFinite(x)) ? null : +x.toFixed(d);
const heapNow = () => (performance.memory ? performance.memory.usedJSHeapSize : null);
const arr3 = (v) => [v.x, v.y, v.z];
const vec3 = (a) => new THREE.Vector3(a[0], a[1], a[2]);

function quantile(values, q) {
    if (!values.length) return null;
    const a = [...values].sort((x, y) => x - y);
    const i = (a.length - 1) * q, lo = Math.floor(i), hi = Math.ceil(i);
    return a[lo] + (a[hi] - a[lo]) * (i - lo);
}
const median = (a) => quantile(a, 0.5);

function findPc(name) {
    const pcs = window.viewer?.scene?.pointclouds || [];
    return pcs.find((p) => p.name === name) || null;
}

function visibleNodeCount() {
    let n = 0;
    for (const pc of viewer.scene.pointclouds) if (pc.visible) n += pc.visibleNodes.length;
    return n;
}

// Every geometry node currently in memory (the expanded part of the hierarchy).
function forEachGeoNode(root, fn) {
    const stack = [root];
    while (stack.length) {
        const n = stack.pop();
        if (!n) continue;
        fn(n);
        for (let i = 0; i < 8; i++) if (n.children?.[i]) stack.push(n.children[i]);
    }
}

function residentStats(pc) {
    let nodes = 0, points = 0, known = 0;
    forEachGeoNode(pc.pcoGeometry.root, (n) => {
        known++;
        if (n.loaded && n.geometry) {
            nodes++;
            points += n.geometry.attributes?.position?.count || 0;
        }
    });
    return { nodes, points, hierarchyNodesInMemory: known };
}

// Histogram of resident points' classes (setup check that target/hidden classes are absent).
function residentClassHistogram(pc) {
    const h = new Float64Array(256);
    forEachGeoNode(pc.pcoGeometry.root, (n) => {
        const a = n.loaded && n.geometry?.attributes?.classification?.array;
        if (!a) return;
        for (let i = 0; i < a.length; i++) h[a[i] & 255]++;
    });
    return h;
}

function ledgerStats(pcName) {
    const s = { entries: 0, implicit: 0, hybrid: 0, explicit: 0, overrides: 0 };
    const m = (typeof brushEdits !== "undefined") ? brushEdits.get(pcName) : null;
    if (!m) return s;
    for (const e of m.values()) {
        s.entries++;
        // Overrides are a Map before 2026-11-14, LedgerOverrides since; both have .size
        const isOv = (o) => o instanceof Map || (typeof LedgerOverrides !== "undefined" && o instanceof LedgerOverrides);
        if (isOv(e)) { s.explicit++; s.overrides += e.size; continue; }
        const o = (e && isOv(e.overrides)) ? e.overrides.size : 0;
        if (o) { s.hybrid++; s.overrides += o; } else s.implicit++;
    }
    return s;
}

function totalLedgerEntries() {
    let n = 0;
    if (typeof brushEdits !== "undefined") for (const m of brushEdits.values()) n += m.size;
    return n;
}

// Size of the ledger as exportBrowserBinary() would write it, without the download.
async function ledgerBytes() {
    if (typeof encodeLedgerBody !== "function" || typeof buildClassMap !== "function") return null;
    const { list, toId } = buildClassMap();
    const body = encodeLedgerBody(toId);
    const header = (typeof buildMetadataBlock === "function" ? buildMetadataBlock("browser-binary-v1") : [])
        .concat([`#CLASSMAP,${list.join(",")}`, `#BINARY,${body.length}`]).join("\n") + "\n";
    const blob = new Blob([header, body]);
    const gz = await new Response(blob.stream().pipeThrough(new CompressionStream("gzip"))).blob();
    return { bodyBytes: body.length, fileBytes: blob.size, gzipBytes: gz.size };
}

// Classes the brush treats as hidden, by the same lookup classifyInRadius uses: a class without
// a colored entry shows as class k % 32 does, else as DEFAULT.
function hiddenClasses() {
    const cls = viewer.classifications, out = [];
    for (let k = 0; k < 256; k++) {
        const e = [cls[k], cls[k % 32], cls.DEFAULT].find((x) => x?.color);
        if (e?.visible === false) out.push(k);
    }
    return out;
}

function hideClass(k) {
    if (!viewer.classifications[k]?.color) {
        // setClassificationVisibility alone would add an entry without a color, which the brush skips.
        const all = Object.assign({}, viewer.classifications);
        all[k] = { visible: true, name: "bench hidden", color: [1, 0, 1, 1] };
        viewer.setClassifications(all);
    }
    viewer.setClassificationVisibility(k, false);
}

function cameraState() {
    const view = viewer.scene.view, cam = viewer.scene.getActiveCamera();
    return { position: arr3(view.position), target: arr3(view.getPivot()), fov: cam.fov, aspect: cam.aspect };
}

function setCamera(c) {
    if (window.TWEEN && typeof TWEEN.removeAll === "function") TWEEN.removeAll();   // e.g. a URL fly-to
    const view = viewer.scene.view;
    view.position.set(c.position[0], c.position[1], c.position[2]);
    view.lookAt(vec3(c.target));
}

function clipState() {
    const vols = viewer.scene.volumes || [];
    return {
        clipTask: viewer.clipTask,
        clipVolumes: vols.filter((v) => v.clip).map((v) => ({ name: v.name, zone: !!v._isZoneVol })),
    };
}

function gpuInfo() {
    try {
        const gl = viewer.renderer.getContext();
        const ext = gl.getExtension("WEBGL_debug_renderer_info");
        return {
            renderer: gl.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER),
            vendor: gl.getParameter(ext ? ext.UNMASKED_VENDOR_WEBGL : gl.VENDOR),
        };
    } catch (e) {
        return { renderer: "error: " + e, vendor: null };
    }
}

// ── Edit-flag hook ───────────────────────────────────────────────────────────

let armed = false, flagT = null;
function onEditFlag() {
    if (armed && flagT === null) flagT = performance.now();
}
B.onEditFlag = onEditFlag;

// ── Page and scene ───────────────────────────────────────────────────────────

B.info = async function () {
    let battery = null;
    try {
        if (navigator.getBattery) {
            const b = await navigator.getBattery();
            battery = { charging: b.charging, level: b.level };
        }
    } catch (e) { /* not available */ }
    const canvas = viewer.renderer.domElement;
    return {
        gpu: gpuInfo(),
        userAgent: navigator.userAgent,
        dpr: devicePixelRatio,
        viewport: [innerWidth, innerHeight],
        canvas: [canvas.width, canvas.height],
        hardwareConcurrency: navigator.hardwareConcurrency,
        deviceMemoryGB: navigator.deviceMemory ?? null,
        battery,
        heapLimitBytes: performance.memory?.jsHeapSizeLimit ?? null,
    };
};

// SHA-256 of the scripts as fetched again from the server. run.mjs prefers the bytes the page
// actually executed and falls back to this.
B.scriptHashes = async function (pattern = /\/(brush_selection\.js|potree\.js)(\?|$)/) {
    const out = {};
    for (const s of document.scripts) {
        const m = pattern.exec(s.src);
        if (!m) continue;
        try {
            const buf = await (await fetch(s.src, { cache: "no-store" })).arrayBuffer();
            const h = new Uint8Array(await crypto.subtle.digest("SHA-256", buf));
            out[m[1]] = { url: s.src, sha256: [...h].map((b) => b.toString(16).padStart(2, "0")).join("") };
        } catch (e) {
            out[m[1]] = { url: s.src, error: String(e) };
        }
    }
    return out;
};

// Wait until the target cloud's root is loaded and the scene has applied zone visibility
// (applyZoneVisibilityFromURL sets _zoneURLStateApplied); zones that never report are given
// zonesGraceMs after the root loads.
B.waitForScene = async function ({ pointcloud, timeoutMs = 180000, zonesGraceMs = 10000 }) {
    const t0 = now();
    let rootAt = null;
    for (;;) {
        const pc = window.viewer ? findPc(pointcloud) : null;
        const ok = !!(pc && pc.pcoGeometry?.root?.loaded
            && typeof openBrushPanel === "function" && typeof paintAtPoint === "function");
        if (ok && rootAt === null) rootAt = now();
        const zones = window._zoneURLStateApplied === true;
        if (ok && (zones || now() - rootAt > zonesGraceMs)) {
            return { sceneMs: round(now()), zonesApplied: zones,
                     pointclouds: viewer.scene.pointclouds.map((p) => p.name) };
        }
        if (now() - t0 > timeoutMs) {
            const have = (window.viewer?.scene?.pointclouds || []).map((p) => p.name);
            throw new Error(`scene not ready after ${timeoutMs} ms: ${JSON.stringify(pointcloud)} `
                + `${pc ? "has no loaded root" : "not found"}; clouds: ${JSON.stringify(have)}`);
        }
        await sleep(100);
    }
};

async function forceLoadAll(pc, concurrency) {
    const t0 = now();
    const saved = Potree.maxNodesLoading;
    Potree.maxNodesLoading = Math.max(saved, concurrency);
    try {
        const visit = async (node) => {
            await waitForLoad(node);             // the brush's own loader; expands proxies too
            const kids = [];
            for (let i = 0; i < 8; i++) if (node.children[i]) kids.push(visit(node.children[i]));
            await Promise.all(kids);
        };
        await visit(pc.pcoGeometry.root);
    } finally {
        Potree.maxNodesLoading = saved;
        if (typeof pumpLoadQueue === "function") pumpLoadQueue();
    }
    const r = residentStats(pc);
    return { ms: round(now() - t0), loadedNodes: r.nodes, hierarchyNodes: r.hierarchyNodesInMemory, points: r.points };
}

// Give every worker script the page has used at least n idle workers. A stroke raises load
// concurrency to BRUSH_MAX_NODES_LOADING, so Potree would otherwise start new decoder workers
// mid-stroke, and with the HTTP cache off each one downloads its script again, which a real
// session pays once at most.
function prewarmWorkers(n) {
    const pool = Potree.workerPool;
    if (!pool?.workers || !(n > 0)) return null;
    const out = {};
    for (const url of Object.keys(pool.workers)) {
        const idleBefore = pool.workers[url].length;
        const taken = [];
        for (let i = 0; i < n; i++) taken.push(pool.getWorker(url));
        for (const w of taken) pool.returnWorker(url, w);
        out[url.split("/").slice(-2).join("/")] = { idleBefore, idleAfter: pool.workers[url].length };
    }
    return out;
}

/**
 * Put the page into the state a stroke starts from. s: {pointcloud, pointBudget, targetClass,
 * hiddenClass, condition, radius, camera, profile, forceLoadAll, forceLoadConcurrency, prewarmWorkers}
 */
B.setup = async function (s) {
    const pc = findPc(s.pointcloud);
    if (!pc) throw new Error(`pointcloud not found: ${s.pointcloud}`);

    // Zones: no auto-switching (it swaps clouds and clip boxes as the camera moves), and no zone
    // clip boxes. A tile URL's volume is not a zone volume and stays.
    if (typeof setAutoSwitchState === "function") setAutoSwitchState(false);
    let zoneVolumesRemoved = 0;
    for (const v of [...viewer.scene.volumes]) {
        if (v._isZoneVol) { viewer.scene.removeVolume(v); zoneVolumesRemoved++; }
    }
    for (const z of window.zones || []) if (Array.isArray(z._volumes)) z._volumes = [];

    // Only the target cloud renders, loads and takes the stroke.
    for (const p of viewer.scene.pointclouds) p.visible = (p === pc);

    // Brush panel: point budget 5M, every class visible, composite material.
    if (!document.getElementById("brushPanel")) openBrushPanel();
    viewer.setPointBudget(s.pointBudget);
    brushState.targetPointcloud = pc.name;
    brushState.classification = s.targetClass;
    brushState.radius = s.radius;
    window.BRUSH_PROFILE = !!s.profile;
    window.BRUSH_PROFILE_SKIPPED = false;

    if (typeof showAllClassifications === "function") showAllClassifications();
    if (s.condition === "hidden") hideClass(s.hiddenClass);

    setCamera(s.camera);
    const workers = s.prewarmWorkers
        ? prewarmWorkers(typeof BRUSH_MAX_NODES_LOADING === "number" ? BRUSH_MAX_NODES_LOADING : 24) : null;
    const forced = s.forceLoadAll ? await forceLoadAll(pc, s.forceLoadConcurrency || 16) : null;
    return { zoneVolumesRemoved, workers, forceLoad: forced, clip: clipState(), hidden: hiddenClasses() };
};

// Ready: no node loading or queued, and the visible-node count unchanged for stableMs.
B.waitReady = async function ({ stableMs = 2000, timeoutMs = 180000 } = {}) {
    const t0 = now();
    let last = null, since = now();
    for (;;) {
        const loading = Potree.numNodesLoading + (typeof _loadQueue !== "undefined" ? _loadQueue.length : 0);
        const vis = visibleNodeCount();
        const t = now();
        if (loading > 0 || vis !== last) { last = vis; since = t; }
        else if (t - since >= stableMs) return { readyMs: round(t), waitMs: round(t - t0), visibleNodes: vis };
        if (t - t0 > timeoutMs) throw new Error(`not ready after ${timeoutMs} ms (loading ${loading}, visible nodes ${vis})`);
        await sleep(100);
    }
};

// ── The stroke ───────────────────────────────────────────────────────────────

function classifyRequest(url) {
    if (/\/octree\.bin(\?|$)/.test(url)) return "octree";
    if (/\/hierarchy\.bin(\?|$)/.test(url)) return "hierarchy";
    if (/\.copc\.laz(\?|$)/i.test(url)) return "copc";
    return "other";
}

function summarizeRequests(entries) {
    const groups = {};
    for (const e of entries) {
        const k = classifyRequest(e.name);
        const g = groups[k] || (groups[k] = { count: 0, transferBytes: 0, bodyBytes: 0, sized: 0,
                                              fromCache: 0, durations: [], protocols: {}, statuses: {} });
        g.count++;
        g.durations.push(e.duration);
        const sized = e.transferSize > 0 || e.encodedBodySize > 0;
        if (sized) g.sized++;
        g.transferBytes += e.transferSize || 0;
        g.bodyBytes += e.encodedBodySize || 0;
        // From the HTTP cache: no bytes on the wire but a body (needs same origin or Timing-Allow-Origin).
        if (e.deliveryType === "cache" || (e.transferSize === 0 && e.encodedBodySize > 0)) g.fromCache++;
        const p = e.nextHopProtocol || "?";
        g.protocols[p] = (g.protocols[p] || 0) + 1;
        if (e.responseStatus) g.statuses[e.responseStatus] = (g.statuses[e.responseStatus] || 0) + 1;
    }
    const other = entries.filter((e) => classifyRequest(e.name) === "other");
    if (groups.other) groups.other.names = [...new Set(other.map((e) => `${e.initiatorType}:${e.name.split("?")[0].split("/").slice(-2).join("/")}`))].slice(0, 8);
    for (const g of Object.values(groups)) {
        g.medianMs = round(median(g.durations));
        g.p95Ms = round(quantile(g.durations, 0.95));
        g.sizesKnown = g.sized === g.count;     // false: cross-origin without Timing-Allow-Origin
        if (!g.sized) { g.transferBytes = null; g.bodyBytes = null; }
        delete g.durations; delete g.sized;
    }
    return groups;
}

/**
 * One stroke: steps 6-7 of the spec. s: {pointcloud, center, radius, targetClass, hiddenClass,
 * condition, camera, instrument (default true), settleMs}
 * instrument false = no edit-flag hook, frame sampler or long-task observer (overhead check).
 */
B.stroke = async function (s) {
    const pc = findPc(s.pointcloud);
    if (!pc) throw new Error(`pointcloud not found: ${s.pointcloud}`);
    const instrument = s.instrument !== false;

    // ── Preconditions (before t0, not timed)
    const hist = residentClassHistogram(pc);
    const pre = {
        strokeInProgress: !!brushState.strokeInProgress,
        pendingPaints: typeof _pendingPaints !== "undefined" ? _pendingPaints.size : null,
        ledgerEntries: totalLedgerEntries(),
        classification: brushState.classification,
        radius: brushState.radius,
        profile: !!window.BRUSH_PROFILE,
        camera: cameraState(),
        clip: clipState(),
        hidden: hiddenClasses(),
        visibleClouds: viewer.scene.pointclouds.filter((p) => p.visible).map((p) => p.name),
        residentTargetClassPoints: hist[s.targetClass & 255],
        residentHiddenClassPoints: s.hiddenClass != null ? hist[s.hiddenClass & 255] : null,
        resident: residentStats(pc),
        visibleNodes: visibleNodeCount(),
        pointBudget: viewer.getPointBudget ? viewer.getPointBudget() : null,
    };
    const problems = [];
    if (pre.strokeInProgress) problems.push("a stroke is already in progress");
    if (pre.pendingPaints) problems.push(`${pre.pendingPaints} paint(s) queued`);
    if (pre.ledgerEntries) problems.push(`ledger not empty (${pre.ledgerEntries} entries)`);
    if (pre.classification !== s.targetClass) problems.push(`brush class ${pre.classification}, expected ${s.targetClass}`);
    if (Math.abs(pre.radius - s.radius) > 1e-9 * Math.max(1, s.radius)) problems.push(`brush radius ${pre.radius}, expected ${s.radius}`);
    const camErr = Math.hypot(...pre.camera.position.map((v, i) => v - s.camera.position[i]));
    const camDist = Math.hypot(...s.camera.position.map((v, i) => v - s.camera.target[i]));
    if (camErr > 1e-3 * Math.max(camDist, 1e-3)) problems.push(`camera moved ${camErr.toPrecision(3)} from the stroke's camera`);
    if (pre.visibleClouds.length !== 1 || pre.visibleClouds[0] !== pc.name) problems.push(`visible clouds ${JSON.stringify(pre.visibleClouds)}`);
    if (pre.residentTargetClassPoints) problems.push(`${pre.residentTargetClassPoints} resident points already have target class ${s.targetClass}`);
    const tileVolumes = pre.clip.clipVolumes.filter((v) => !v.zone).length;
    const anyClip = pre.clip.clipVolumes.length > 0 && pre.clip.clipTask > 1;
    if (s.condition === "clip") {
        if (!tileVolumes || pre.clip.clipTask < 2) problems.push(`clip condition without an active tile volume ${JSON.stringify(pre.clip)}`);
        if (pre.clip.clipVolumes.length !== tileVolumes) problems.push("zone clip volumes present");
    } else if (anyClip) {
        problems.push(`clipping active ${JSON.stringify(pre.clip)}`);
    }
    if (s.condition === "hidden") {
        if (!pre.hidden.includes(s.hiddenClass)) problems.push(`class ${s.hiddenClass} not hidden`);
        if (pre.residentHiddenClassPoints) problems.push(`${pre.residentHiddenClassPoints} resident points have the hidden class ${s.hiddenClass}`);
    } else if (pre.hidden.length) {
        problems.push(`hidden classes ${JSON.stringify(pre.hidden.slice(0, 10))}`);
    }
    if (problems.length && !s.ignoreProblems) return { status: "precondition-failed", problems, pre };

    // ── Instrumentation
    const strokeErrors = [], strokeWarnings = [];
    const origError = console.error, origWarn = console.warn;
    const fmt = (args) => args.map((x) => (x && x.stack) ? String(x.stack).slice(0, 400) : String(x)).join(" ").slice(0, 600);
    console.error = function (...a) { if (strokeErrors.length < 20) strokeErrors.push(fmt(a)); return origError.apply(this, a); };
    console.warn = function (...a) { if (strokeWarnings.length < 20) strokeWarnings.push(fmt(a)); return origWarn.apply(this, a); };

    const drained = [];
    const onFull = () => {          // keep collecting past the buffer size
        drained.push(...performance.getEntriesByType("resource"));
        performance.clearResourceTimings();
    };
    performance.setResourceTimingBufferSize(20000);
    performance.clearResourceTimings();
    performance.addEventListener("resourcetimingbufferfull", onFull);

    const longTasks = [];
    let lto = null;
    if (instrument && PerformanceObserver.supportedEntryTypes?.includes("longtask")) {
        lto = new PerformanceObserver((l) => { for (const e of l.getEntries()) longTasks.push([e.startTime, e.duration]); });
        lto.observe({ type: "longtask" });
    }

    const frames = [];                // [rAF timestamp, interval since previous frame]
    let sampling = instrument, lastTs = null, firstVisible = null;
    const heapBefore = heapNow();
    let heapPeak = heapBefore;
    const tick = (ts) => {
        if (!sampling) return;
        if (lastTs !== null) frames.push([ts, ts - lastTs]);
        lastTs = ts;
        // First visible edit: the first frame that starts after the first flag.
        if (flagT !== null && firstVisible === null && ts > flagT) firstVisible = ts;
        const h = heapNow();
        if (h > heapPeak) heapPeak = h;
        requestAnimationFrame(tick);
    };
    if (instrument) requestAnimationFrame(tick);

    const savedHook = B.onEditFlag;
    if (!instrument) B.onEditFlag = undefined;
    window.__lastStrokeProfile = null;
    flagT = null;
    armed = instrument;

    // ── Timed: one paintAtPoint
    performance.mark("bench:t0");
    const t0 = now();
    let thrown = null;
    try {
        await paintAtPoint(pc, { position: vec3(s.center) });
    } catch (e) {
        thrown = String(e && e.stack || e);
    }
    const t1 = now();
    performance.mark("bench:t1");
    armed = false;
    const heapAfter = heapNow();
    if (heapAfter > heapPeak) heapPeak = heapAfter;

    // ── After the stroke (not timed)
    if (instrument && flagT !== null) {
        const until = now() + 2000;
        while (firstVisible === null && now() < until) await nextFrame();
    }
    sampling = false;
    B.onEditFlag = savedHook;
    if (lto) { for (const e of lto.takeRecords()) longTasks.push([e.startTime, e.duration]); lto.disconnect(); }
    console.error = origError;
    console.warn = origWarn;

    // Requests that started during the stroke; let any still in flight finish first.
    const settleUntil = now() + (s.settleMs ?? 10000);
    while (Potree.numNodesLoading > 0 && now() < settleUntil) await sleep(50);
    performance.removeEventListener("resourcetimingbufferfull", onFull);
    const all = drained.concat(performance.getEntriesByType("resource"));
    const during = all.filter((e) => e.startTime >= t0 && e.startTime <= t1);

    const intervals = frames.filter(([ts]) => ts > t0 && ts <= t1).map(([, d]) => d);
    const lt = longTasks.filter(([st, d]) => st + d > t0 && st < t1);
    const ledgerAfter = ledgerStats(pc.name);

    return {
        status: thrown ? "stroke-threw" : (strokeErrors.some((m) => /Brush stroke error/.test(m)) ? "stroke-error" : "ok"),
        problems,
        instrument,
        timing: {
            completionMs: round(t1 - t0, 2),
            firstEditFlagMs: flagT !== null ? round(flagT - t0, 2) : null,
            firstVisibleEditMs: firstVisible !== null ? round(firstVisible - t0, 2) : null,
        },
        frames: instrument ? {
            count: intervals.length,
            medianMs: round(median(intervals), 2),
            p95Ms: round(quantile(intervals, 0.95), 2),
            maxMs: round(intervals.length ? Math.max(...intervals) : null, 2),
        } : null,
        longTasks: instrument ? {
            count: lt.length,
            totalMs: round(lt.reduce((a, [, d]) => a + d, 0)),
            maxMs: round(lt.length ? Math.max(...lt.map(([, d]) => d)) : null),
        } : null,
        heap: { beforeBytes: heapBefore, peakBytes: instrument ? heapPeak : null, afterBytes: heapAfter },
        resident: { before: pre.resident, after: residentStats(pc) },
        requests: Object.assign(summarizeRequests(during), {
            total: during.length, startedAfterStroke: all.filter((e) => e.startTime > t1).length,
            bufferDrains: drained.length ? 1 : 0,
        }),
        ledger: ledgerAfter,
        ledgerSize: s.measureLedger ? await ledgerBytes() : null,
        profile: window.__lastStrokeProfile || null,
        pre,
        thrown,
        strokeErrors,
        strokeWarnings,
        t0: round(t0, 3),
        t1: round(t1, 3),
    };
};

// ── Capture helper ───────────────────────────────────────────────────────────

let lastMouse = null;
document.addEventListener("mousemove", (e) => {
    if (window.viewer && e.target === viewer.renderer?.domElement) lastMouse = { clientX: e.clientX, clientY: e.clientY };
}, true);

function tileInfo(center) {
    const vols = (viewer.scene.volumes || []).filter((v) => v.clip && !v._isZoneVol);
    if (vols.length !== 1) return vols.length ? { error: `${vols.length} clip volumes; expected one tile` } : null;
    const v = vols[0];
    v.updateMatrixWorld();
    const local = center.clone().applyMatrix4(v.matrixWorld.clone().invert());   // unit cube
    const s = v.scale;
    const dist = (a, sc) => (0.5 - Math.abs(a)) * sc;                            // to the nearer face, world units
    const dx = dist(local.x, s.x), dy = dist(local.y, s.y), dz = dist(local.z, s.z);
    return {
        name: v.name,
        inside: Math.abs(local.x) <= 0.5 && Math.abs(local.y) <= 0.5 && Math.abs(local.z) <= 0.5,
        wallDistance: Math.min(dx, dy),          // nearest vertical wall
        faceDistance: { x: dx, y: dy, z: dz },
        center: arr3(v.position),
        size: arr3(s),
        halfDiagonal: 0.5 * Math.hypot(s.x, s.y, s.z),
    };
}

function saveCapture(cap) {
    if (typeof window.__benchSave === "function") return window.__benchSave(JSON.stringify(cap));
    try {
        const list = JSON.parse(localStorage.getItem("bench.captures") || "[]");
        list.push(cap);
        localStorage.setItem("bench.captures", JSON.stringify(list));
    } catch (e) { console.warn("bench: couldn't keep the capture in localStorage", e); }
}

/**
 * __bench.capture("fr38-c1") in the console: records the camera, the point under the cursor
 * where the brush last hovered (re-picked exactly as the brush picks), the dataset, the leaf
 * extent there, the root box (for the whole-cloud radius), and a tile URL's volume if one is open.
 */
B.capture = async function (label, opts = {}) {
    if (!label) throw new Error('usage: __bench.capture("fr38-c1")');
    if (!lastMouse) throw new Error("hover the brush over the cloud first");
    if (!brushState.active || !brushState.sphere) throw new Error("open the brush panel (brush active) first");
    const result = pickAt(lastMouse);
    if (!result) throw new Error("no point under the last cursor position");
    const pc = result.pc;
    const center = result.hit.position.clone();
    const leaf = await leafExtentAt(pc, center);
    const scale = pc.matrixWorld.getMaxScaleOnAxis();
    const rb = pc.pcoGeometry.root.boundingBox;
    const corners = [];
    for (const x of [rb.min.x, rb.max.x]) for (const y of [rb.min.y, rb.max.y]) for (const z of [rb.min.z, rb.max.z]) {
        corners.push(arr3(new THREE.Vector3(x, y, z).applyMatrix4(pc.matrixWorld)));
    }
    const params = new URLSearchParams(location.search);
    const cap = {
        label,
        dataset: opts.dataset ?? cfg.dataset ?? null,
        capturedAt: new Date().toISOString(),
        url: location.href,
        vtype: params.get("vtype"),
        doi: params.get("doi"),
        pointcloud: pc.name,
        camera: cameraState(),
        center: arr3(center),
        leafExtent: leaf.w * scale,
        leafDepth: leaf.depth,
        rootCorners: corners,
        brushRadius: brushState.radius,
        volumes: /^(null|undefined)?$/.test(params.get("volumes") || "") ? null : params.get("volumes"),
        tile: tileInfo(center),
        viewport: [innerWidth, innerHeight, devicePixelRatio],
    };
    await saveCapture(cap);
    console.log(`bench: captured ${label}: ${pc.name}, leaf ${cap.leafExtent.toPrecision(3)} (depth ${leaf.depth})`
        + (cap.tile ? `, tile wall ${(+cap.tile.wallDistance).toPrecision(3)} away` : ""), cap);
    return cap;
};

// For captures kept in localStorage (pasted bench.js, no orchestrator): download them as JSONL.
B.exportCaptures = function () {
    const list = JSON.parse(localStorage.getItem("bench.captures") || "[]");
    const blob = new Blob([list.map((c) => JSON.stringify(c)).join("\n") + "\n"], { type: "application/x-ndjson" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "captures.jsonl";
    document.body.appendChild(a); a.click(); a.remove();
    return list.length;
};

})();
