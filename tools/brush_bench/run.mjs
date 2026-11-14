#!/usr/bin/env node
/*
 * Brush benchmark orchestrator (tools/brush_bench). See README.md.
 *
 *   node run.mjs runs    --machine ref --set main --mode full
 *   node run.mjs runs    --machine ref --set main --mode lean            (N: none=5, clip=3, hidden=3)
 *   node run.mjs runs    --machine ref --set trace --mode trace
 *   node run.mjs runs    --machine ref --set conditions --mode lean --network throttled --samples 3
 *   node run.mjs pilot   --machine ref
 *   node run.mjs capture fr38 [--url "<tile URL>"]
 *
 * One run = a new isolated browser context with the HTTP cache off, the dataset's viewer URL with
 * ?bench=1, bench.js injected before any page script, setup, wait for ready, one paintAtPoint,
 * one JSON line appended to results/<machine>/runs.jsonl.
 */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const HARNESS_VERSION = 1;
const VIEWPORT = { width: 1600, height: 900, deviceScaleFactor: 1 };
const CHROME_FLAGS = [
    "--enable-precise-memory-info",
    "--disable-background-timer-throttling",
    "--disable-renderer-backgrounding",
    "--disable-backgrounding-occluded-windows",
    `--window-size=${VIEWPORT.width + 40},${VIEWPORT.height + 160}`,
];
const SOFTWARE_GL = /swiftshader|llvmpipe|softpipe|software|basic render|mesa offscreen/i;
const NETWORKS = {
    normal: null,
    throttled: { latencyMs: 100, downMbps: 20, upMbps: 20, how: "CDP network emulation (latency is a per-request floor)" },
};
const DEFAULT_BLOCK = ["*classification_edits.gz*"];      // auto-imported ledgers: strokes start from an empty one
const TRACE_CATEGORIES = [
    "-*", "devtools.timeline", "v8.execute", "disabled-by-default-devtools.timeline",
    "disabled-by-default-devtools.timeline.frame", "toplevel", "blink.user_timing",
    "disabled-by-default-devtools.timeline.stack", "disabled-by-default-v8.cpu_profiler",
];
const NAV_TIMEOUT_MS = 180000;
const READY_TIMEOUT_MS = 180000;

// ── CLI ──────────────────────────────────────────────────────────────────────

function parseArgs(argv) {
    const out = { _: [] };
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (!a.startsWith("--")) { out._.push(a); continue; }
        const [k, inline] = a.slice(2).split(/=(.*)/s);
        if (inline !== undefined) out[k] = inline;
        else if (i + 1 < argv.length && !argv[i + 1].startsWith("--")) out[k] = argv[++i];
        else out[k] = true;
    }
    return out;
}

const args = parseArgs(process.argv.slice(2));
const command = args._[0] || "help";
const listArg = (v) => (v === undefined || v === true) ? null : new Set(String(v).split(",").map((s) => s.trim()).filter(Boolean));

function parseSamples(v, fallback) {
    // "5" → every condition; "none=5,clip=3,hidden=3" → per condition
    const out = { ...fallback };
    if (v === undefined) return out;
    for (const part of String(v).split(",")) {
        const [k, n] = part.includes("=") ? part.split("=") : ["default", part];
        if (k === "default") { for (const c of Object.keys(out)) out[c] = +n; out.default = +n; }
        else out[k] = +n;
    }
    return out;
}

// ── Files ────────────────────────────────────────────────────────────────────

const readJSON = (p) => JSON.parse(fs.readFileSync(p, "utf8"));
const sha256 = (buf) => crypto.createHash("sha256").update(buf).digest("hex");
const BENCH_SRC = fs.readFileSync(path.join(HERE, "bench.js"), "utf8");
const BENCH_SHA = sha256(BENCH_SRC);

function readJSONL(p) {
    if (!fs.existsSync(p)) return [];
    return fs.readFileSync(p, "utf8").split("\n").filter(Boolean).flatMap((l) => {
        try { return [JSON.parse(l)]; } catch { return []; }
    });
}
const appendJSONL = (p, obj) => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.appendFileSync(p, JSON.stringify(obj) + "\n"); };

function loadDatasets() {
    const p = path.resolve(args.datasets || path.join(HERE, "datasets.json"));
    const d = readJSON(p);
    delete d._comment;
    return d;
}

function loadStrokes(datasets) {
    const p = path.resolve(args.strokes || path.join(HERE, "strokes.json"));
    if (!fs.existsSync(p)) throw new Error(`${p} not found: capture centers, then run make_strokes.py`);
    const list = readJSON(p);
    const seen = new Set();
    for (const s of list) {
        const where = `strokes.json ${s.id || JSON.stringify(s).slice(0, 60)}`;
        if (!s.id || seen.has(s.id)) throw new Error(`${where}: missing or duplicate id`);
        seen.add(s.id);
        if (!datasets[s.dataset]) throw new Error(`${where}: unknown dataset ${s.dataset}`);
        s.pointcloud = s.pointcloud || datasets[s.dataset].pointcloud;
        if (!s.pointcloud) throw new Error(`${where}: no pointcloud (stroke or dataset)`);
        if (!(s.radius > 0) || s.center?.length !== 3) throw new Error(`${where}: needs center [x,y,z] and radius > 0`);
        if (s.camera?.position?.length !== 3 || s.camera?.target?.length !== 3) throw new Error(`${where}: needs camera.position and camera.target`);
        s.condition = s.condition || "none";
        if (!["none", "clip", "hidden"].includes(s.condition)) throw new Error(`${where}: condition ${s.condition}`);
        if (s.condition === "clip" && !s.volumes) throw new Error(`${where}: clip stroke without volumes`);
        s.sets = s.sets || ["main"];
    }
    return list;
}

function resultsDir(machine) { return path.resolve(args.out || path.join(HERE, "results"), machine); }

// ── Small helpers ────────────────────────────────────────────────────────────

function mulberry32(seed) {
    let t = seed >>> 0;
    return () => {
        t += 0x6d2b79f5;
        let r = Math.imul(t ^ (t >>> 15), 1 | t);
        r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
        return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
}
function shuffle(arr, seed) {
    const rnd = mulberry32(seed);
    for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; }
    return arr;
}
const hashSeed = (s) => parseInt(sha256(s).slice(0, 8), 16);
const median = (a) => { if (!a.length) return null; const b = [...a].sort((x, y) => x - y); const m = b.length >> 1; return b.length % 2 ? b[m] : (b[m - 1] + b[m]) / 2; };
const fmtDur = (ms) => { if (ms == null || !isFinite(ms)) return "?"; const s = Math.round(ms / 1000); const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60); return h ? `${h}h${String(m).padStart(2, "0")}m` : m ? `${m}m${String(s % 60).padStart(2, "0")}s` : `${s}s`; };
const localDate = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

function withTimeout(promise, ms) {
    let timer;
    return Promise.race([
        promise.then((v) => ({ value: v })),
        new Promise((resolve) => { timer = setTimeout(() => resolve({ timedOut: true }), ms); }),
    ]).finally(() => clearTimeout(timer));
}

function machineInfo(label) {
    const cpus = os.cpus();
    return {
        label, hostname: os.hostname(), platform: os.platform(), release: os.release(), arch: os.arch(),
        cpu: cpus[0]?.model?.trim() ?? null, cores: cpus.length, memGB: +(os.totalmem() / 2 ** 30).toFixed(1),
        node: process.version,
    };
}

function harnessCommit() {
    try {
        const head = fs.readFileSync(path.join(HERE, "..", "..", ".git", "HEAD"), "utf8").trim();
        if (!head.startsWith("ref: ")) return head;
        return fs.readFileSync(path.join(HERE, "..", "..", ".git", head.slice(5)), "utf8").trim();
    } catch { return null; }
}

// ── Browser ──────────────────────────────────────────────────────────────────

let puppeteer = null;
async function loadPuppeteer() {
    if (puppeteer) return puppeteer;
    try { puppeteer = (await import("puppeteer")).default; }
    catch { puppeteer = (await import("puppeteer-core")).default; }
    return puppeteer;
}

async function launchBrowser({ devtools = false } = {}) {
    const pptr = await loadPuppeteer();
    const extra = args.headless ? ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] : [];
    return pptr.launch({
        headless: !!args.headless,
        devtools,
        executablePath: typeof args.chrome === "string" ? args.chrome : undefined,
        defaultViewport: null,
        protocolTimeout: 45 * 60 * 1000,          // strokes can run 20 min; evaluate() waits on them
        args: [...CHROME_FLAGS, ...extra],
    });
}

// Patterns are written like "*classification_edits.gz*" (the old `urls` wildcard form). The newer
// `urlPatterns` field wants absolute URLPattern strings, so "*x*" becomes "*://*:*/*x*".
async function blockURLs(cdp, patterns) {
    if (!patterns.length) return "none";
    const abs = (p) => /^[a-z*]+:\/\//i.test(p) ? p : `*://*:*/${p.replace(/^\*?\/?/, "*")}`;
    try {
        await cdp.send("Network.setBlockedURLs", { urlPatterns: patterns.map((p) => ({ urlPattern: abs(p), block: true })) });
        return "urlPatterns";
    } catch {
        await cdp.send("Network.setBlockedURLs", { urls: patterns });
        return "urls";
    }
}

function buildUrl(ds, stroke, extra = {}) {
    const u = new URL(ds.url);
    u.searchParams.set("bench", "1");
    if (stroke && stroke.condition === "clip") {
        // A Work Distribution tile URL: volumes plus the camera (loadParams ignores volumes without it).
        const f = (v) => v.toFixed(3);
        u.searchParams.set("volumes", stroke.volumes);
        u.searchParams.set("position", stroke.camera.position.map(f).join(";"));
        u.searchParams.set("target", stroke.camera.target.map(f).join(";"));
    }
    for (const [k, v] of Object.entries(extra)) u.searchParams.set(k, v);
    return u.href;
}

// ── One run ──────────────────────────────────────────────────────────────────

/**
 * run: {key, stroke, mode ("full"|"lean"|"trace"), sample, round, discard, role, instrument}
 * ctx: {browser, datasets, machine, network, sessionId, outDir, chromeVersion}
 */
async function runOne(ctx, run) {
    const { stroke } = run;
    const ds = ctx.datasets[stroke.dataset];
    const startedAt = new Date();
    const rec = {
        type: "run", key: run.key, sessionId: ctx.sessionId, harness: { version: HARNESS_VERSION, commit: ctx.commit, benchSha256: BENCH_SHA },
        startedAt: startedAt.toISOString(), machine: ctx.machine, network: ctx.network, networkProfile: NETWORKS[ctx.network],
        chrome: ctx.chromeVersion, gpu: null, softwareGL: null, build: {},
        dataset: stroke.dataset, strokeId: stroke.id, condition: stroke.condition, mode: run.mode,
        sample: run.sample, round: run.round, discard: !!run.discard, role: run.role || "main", instrument: run.instrument !== false,
        stroke: {
            pointcloud: stroke.pointcloud, center: stroke.center, radius: stroke.radius, multiplier: stroke.multiplier ?? null,
            leafExtent: stroke.leafExtent ?? null, leafDepth: stroke.leafDepth ?? null, captureLabel: stroke.captureLabel ?? null,
            wholeCloud: !!stroke.wholeCloud, tileInit: !!stroke.tileInit, camera: stroke.camera,
        },
        settings: { gcBeforeStroke: !args["no-gc"], prewarmWorkers: !args["no-prewarm-workers"], pointBudget: null,
                    targetClass: ds.targetClass ?? 100, hiddenClass: ds.hiddenClass ?? 18 },
        status: "error", error: null,
    };
    let context = null;
    let page = null;
    let strokePromise = null;
    const consoleErrors = [];
    try {
        context = await ctx.browser.createBrowserContext();
        page = await context.newPage();
        await page.setViewport(VIEWPORT);
        await page.setCacheEnabled(false);
        const cdp = await page.createCDPSession();
        await cdp.send("Network.enable");
        const net = NETWORKS[ctx.network];
        if (net) await page.emulateNetworkConditions({ download: net.downMbps * 1e6 / 8, upload: net.upMbps * 1e6 / 8, latency: net.latencyMs });

        // SHA-256 of the scripts the page actually ran.
        const hashes = {};
        page.on("response", (res) => {
            const m = /\/(libs\/custom\/brush_selection\.js|build\/potree\/potree\.js)(\?|$)/.exec(res.url());
            if (!m) return;
            hashes[m[1]] = res.buffer().then((b) => ({ url: res.url(), sha256: sha256(b), bytes: b.length }), (e) => ({ url: res.url(), error: String(e) }));
        });
        page.on("console", (m) => { if (m.type() === "error" && consoleErrors.length < 30) consoleErrors.push(m.text().slice(0, 300)); });
        page.on("pageerror", (e) => { if (consoleErrors.length < 30) consoleErrors.push(("pageerror: " + (e.message || e)).slice(0, 300)); });
        page.on("dialog", (d) => d.accept().catch(() => {}));

        rec.blockedVia = await blockURLs(cdp, ds.block ?? DEFAULT_BLOCK);
        await page.evaluateOnNewDocument(`window.__benchConfig = ${JSON.stringify({ dataset: stroke.dataset })};`);
        await page.evaluateOnNewDocument(BENCH_SRC);
        rec.url = buildUrl(ds, stroke);
        await page.goto(rec.url, { waitUntil: "load", timeout: NAV_TIMEOUT_MS });
        await page.bringToFront();

        rec.scene = await page.evaluate((o) => window.__bench.waitForScene(o), { pointcloud: stroke.pointcloud, timeoutMs: READY_TIMEOUT_MS });
        const info = await page.evaluate(() => window.__bench.info());
        rec.page = info;
        rec.gpu = info.gpu;
        rec.onBattery = info.battery ? info.battery.charging === false : null;
        rec.softwareGL = SOFTWARE_GL.test(String(info.gpu?.renderer));
        if (rec.softwareGL && !args["allow-software-gl"]) {
            rec.status = "software-gl";
            throw Object.assign(new Error(`WebGL renderer is not a hardware GPU: ${info.gpu?.renderer}`), { fatal: true });
        }

        const pointBudget = +(args["budget-override"] ?? ds.pointBudget ?? 5e6);
        rec.settings.pointBudget = pointBudget;
        rec.setup = await page.evaluate((s) => window.__bench.setup(s), {
            pointcloud: stroke.pointcloud, pointBudget, targetClass: rec.settings.targetClass, hiddenClass: rec.settings.hiddenClass,
            condition: stroke.condition, radius: stroke.radius, camera: stroke.camera,
            profile: run.mode === "full", forceLoadAll: !!ds.forceLoadAll, forceLoadConcurrency: ds.forceLoadConcurrency ?? 16,
            prewarmWorkers: rec.settings.prewarmWorkers,
        });
        rec.ready = await page.evaluate((o) => window.__bench.waitReady(o), { stableMs: 2000, timeoutMs: READY_TIMEOUT_MS });

        for (const [k, p] of Object.entries(hashes)) rec.build[k.endsWith("potree.js") ? "potree" : "brush"] = await p;
        if (!rec.build.brush?.sha256) {
            const h = await page.evaluate(() => window.__bench.scriptHashes());
            if (h["brush_selection.js"]) rec.build.brush = { ...h["brush_selection.js"], via: "refetch" };
            if (h["potree.js"] && !rec.build.potree?.sha256) rec.build.potree = { ...h["potree.js"], via: "refetch" };
        }

        if (!args["no-gc"]) await cdp.send("HeapProfiler.collectGarbage").catch(() => {});
        const heapCdpBefore = await cdp.send("Runtime.getHeapUsage").catch(() => null);

        const tracePath = run.mode === "trace" ? path.join(ctx.outDir, "traces", `${run.key.replaceAll("|", "_")}.json`) : null;
        if (tracePath) {
            fs.mkdirSync(path.dirname(tracePath), { recursive: true });
            await page.tracing.start({ path: tracePath, categories: TRACE_CATEGORIES });
        }

        const timeoutMs = (stroke.timeoutMin ?? ds.strokeTimeoutMin ?? 5) * 60000;
        await page.bringToFront();
        strokePromise = page.evaluate((s) => window.__bench.stroke(s), {
            pointcloud: stroke.pointcloud, center: stroke.center, radius: stroke.radius, camera: stroke.camera,
            condition: stroke.condition, targetClass: rec.settings.targetClass, hiddenClass: rec.settings.hiddenClass,
            instrument: run.instrument !== false, measureLedger: run.mode === "full",
        });
        const r = await withTimeout(strokePromise, timeoutMs + 15000);   // + the post-stroke settle
        if (r.timedOut) {
            rec.status = "timeout";
            rec.error = `stroke did not finish within ${timeoutMs / 60000} min`;
            strokePromise.catch(() => {});
            if (tracePath) await page.tracing.stop().catch(() => {});
        } else {
            const res = r.value;
            Object.assign(rec, res);          // status, timing, frames, longTasks, heap, resident, requests, ledger, profile, pre, ...
            rec.heapCdp = { before: heapCdpBefore, after: await cdp.send("Runtime.getHeapUsage").catch(() => null) };
            if (res.timing) res.timing.timeToReadyMs = rec.ready.readyMs;
            if (tracePath) { await page.tracing.stop(); rec.trace = path.relative(ctx.outDir, tracePath); }
        }
    } catch (e) {
        if (e.fatal) rec.fatal = true;
        if (rec.status === "error" || rec.status === "software-gl") rec.error = String(e.stack || e).slice(0, 2000);
        if (!ctx.browser.connected) { rec.status = "crash"; rec.crash = true; }
    } finally {
        rec.consoleErrors = consoleErrors;
        rec.finishedAt = new Date().toISOString();
        rec.durationMs = Date.now() - startedAt.getTime();
        if (context) await context.close().catch(() => {});
    }
    return rec;
}

// ── Sessions ─────────────────────────────────────────────────────────────────

async function startSession(label, { launch = true } = {}) {
    const machineLabel = args.machine;
    if (!machineLabel || machineLabel === true) throw new Error("--machine <name> is required (e.g. ref, laptop)");
    const network = args.network && args.network !== true ? args.network : "normal";
    if (!(network in NETWORKS)) throw new Error(`--network ${network}: one of ${Object.keys(NETWORKS).join(", ")}`);
    const datasets = loadDatasets();
    const strokes = loadStrokes(datasets);
    const outDir = resultsDir(machineLabel);
    fs.mkdirSync(outDir, { recursive: true });
    const browser = launch ? await launchBrowser() : null;
    const ctx = {
        browser, datasets, strokes, network, outDir, commit: harnessCommit(),
        machine: machineInfo(machineLabel), chromeVersion: browser ? await browser.version() : null,
        sessionId: `${localDate()}T${new Date().toTimeString().slice(0, 8).replaceAll(":", "")}-${crypto.randomBytes(3).toString("hex")}`,
    };
    if (browser) console.log(`session ${ctx.sessionId} (${label}) on ${machineLabel}, ${ctx.chromeVersion}, network ${network}, bench.js ${BENCH_SHA.slice(0, 12)}`);
    return ctx;
}

async function relaunch(ctx) {
    try { await ctx.browser.close(); } catch { /* already gone */ }
    ctx.browser = await launchBrowser();
    ctx.chromeVersion = await ctx.browser.version();
    console.log("browser relaunched");
}

async function execute(ctx, run, log) {
    let rec = await runOne(ctx, run);
    if (rec.status === "crash" || !ctx.browser.connected) {
        await relaunch(ctx);
        if (run.retryOnCrash !== false) { rec = await runOne(ctx, run); rec.retriedAfterCrash = true; }
    }
    appendJSONL(log, rec);
    if (rec.fatal) throw new Error(rec.error);
    return rec;
}

function summarizeRec(rec) {
    const t = rec.timing || {};
    const p = rec.profile || {};
    const req = rec.requests || {};
    const bits = [rec.status];
    if (t.completionMs != null) bits.push(`done ${(t.completionMs / 1000).toFixed(2)}s`);
    if (t.firstVisibleEditMs != null) bits.push(`first edit ${(t.firstVisibleEditMs / 1000).toFixed(2)}s`);
    if (req.octree || req.copc) bits.push(`${(req.octree?.count ?? 0) + (req.copc?.count ?? 0)} node req`);
    if (p["nodes: visited"] != null) bits.push(`visited ${p["nodes: visited"]}, explicit ${p["↳ explicit per-point"]}, implicit ${p["↳ bulk-marked implicit"]}`);
    if (rec.problems?.length) bits.push(`problems: ${rec.problems.join("; ")}`);
    if (rec.onBattery) bits.push("ON BATTERY");
    if (rec.error) bits.push(rec.error.split("\n")[0].slice(0, 160));
    return bits.join(", ");
}

async function anchorRun(ctx, anchor, which, log) {
    const rec = await execute(ctx, {
        key: [ctx.machine.label, ctx.network, "lean", anchor.id, `anchor-${which}`, ctx.sessionId].join("|"),
        stroke: anchor, mode: "lean", sample: 0, round: 0, discard: true, role: `anchor-${which}`,
    }, log);
    console.log(`anchor (${which}) ${anchor.id}: ${summarizeRec(rec)}`);
    return rec;
}

// ── runs ─────────────────────────────────────────────────────────────────────

function planRuns(ctx, opts) {
    const sel = ctx.strokes.filter((s) => s.sets.includes(opts.set)
        && (!opts.only || opts.only.has(s.id)) && (!opts.datasets || opts.datasets.has(s.dataset)));
    const runs = [];
    const key = (s, sample) => [ctx.machine.label, ctx.network, opts.mode, s.id, `s${sample}`].join("|");
    if (opts.mode === "lean") {
        const n = (s) => opts.samples[s.samplesAs ?? s.condition] ?? opts.samples.default;
        const maxN = Math.max(0, ...sel.map(n));
        for (let r = opts.warmup ? 0 : 1; r <= maxN; r++) {
            const round = shuffle(sel.filter((s) => r === 0 || n(s) >= r), opts.seed + r);
            for (const s of round) runs.push({ key: key(s, r), stroke: s, mode: "lean", sample: r, round: r, discard: r === 0 });
        }
    } else {
        for (const s of shuffle([...sel], opts.seed)) runs.push({ key: key(s, 1), stroke: s, mode: opts.mode, sample: 1, round: 1, discard: false });
    }
    return runs;
}

async function cmdRuns() {
    const mode = args.mode || "lean";
    if (!["full", "lean", "trace"].includes(mode)) throw new Error(`--mode ${mode}: full, lean or trace`);
    const set = args.set || "main";
    const ctx = await startSession(`${set}/${mode}`, { launch: !args["dry-run"] });
    const log = path.join(ctx.outDir, "runs.jsonl");
    const existing = readJSONL(log).filter((r) => r.type === "run");
    const done = new Map(existing.map((r) => [r.key, r.status]));

    // Lean: discard the first round unless full mode ran today on this machine and network.
    let warmup = false;
    if (mode === "lean") {
        if (args.warmup !== undefined) warmup = args.warmup !== "false";
        else warmup = !existing.some((r) => r.mode === "full" && r.network === ctx.network && r.finishedAt && localDate(new Date(r.finishedAt)) === localDate());
        if (warmup) console.log("lean: no full-mode runs today on this machine and network, so round 0 is a warm-up that analysis discards");
    }
    const seed = args.seed !== undefined ? +args.seed : hashSeed([ctx.machine.label, ctx.network, set, mode].join("|"));
    const samples = parseSamples(args.samples, { none: 5, clip: 3, hidden: 3, default: 1 });
    let runs = planRuns(ctx, { set, mode, warmup, seed, samples, only: listArg(args.only), datasets: listArg(args.dataset) });
    const retry = new Set(["error", "crash", "timeout", "precondition-failed", "stroke-error", "stroke-threw"]);
    runs = runs.filter((r) => !done.has(r.key) || (args["retry-failed"] && retry.has(done.get(r.key))));
    if (args.limit) runs = runs.slice(0, +args.limit);
    console.log(`${runs.length} runs to do (${done.size} already in ${path.relative(process.cwd(), log)}), seed ${seed}`);
    if (args["dry-run"]) { for (const r of runs) console.log(r.key); return; }
    if (!runs.length) { await ctx.browser.close(); return; }

    const anchorId = args.anchor && args.anchor !== true ? args.anchor : ctx.strokes.find((s) => s.anchor)?.id;
    const anchor = anchorId && anchorId !== "none" ? ctx.strokes.find((s) => s.id === anchorId) : null;
    if (anchorId && anchorId !== "none" && !anchor) throw new Error(`anchor stroke ${anchorId} not in strokes.json`);
    const anchors = {};
    const durations = [];
    let fatal = false;
    try {
        if (anchor) anchors.start = await anchorRun(ctx, anchor, "start", log);
        for (let i = 0; i < runs.length; i++) {
            const run = runs[i];
            const rec = await execute(ctx, run, log);
            durations.push(rec.durationMs);
            const eta = median(durations) * (runs.length - i - 1);
            console.log(`[${i + 1}/${runs.length}] ${run.stroke.id} ${run.mode} s${run.sample}${run.discard ? " (warm-up)" : ""}: ${summarizeRec(rec)} | ETA ${fmtDur(eta)}`);
        }
    } catch (e) {
        fatal = true;
        throw e;
    } finally {
        if (anchor && anchors.start && !fatal && ctx.browser.connected) {
            anchors.end = await anchorRun(ctx, anchor, "end", log);
            const a = anchors.start?.timing?.completionMs, b = anchors.end?.timing?.completionMs;
            const diffPct = a && b ? 100 * Math.abs(b - a) / a : null;
            const session = {
                type: "session", sessionId: ctx.sessionId, set, mode, network: ctx.network, machine: ctx.machine,
                anchor: anchor.id, anchorStartMs: a ?? null, anchorEndMs: b ?? null, diffPct,
                flagged: diffPct === null || diffPct > 20, runs: runs.length, finishedAt: new Date().toISOString(),
            };
            appendJSONL(path.join(ctx.outDir, "sessions.jsonl"), session);
            console.log(`anchor ${anchor.id}: ${a?.toFixed(0)} ms at start, ${b?.toFixed(0)} ms at end (${diffPct?.toFixed(1)}%)${session.flagged ? "  SESSION FLAGGED" : ""}`);
        }
        await ctx.browser.close().catch(() => {});
    }
}

// ── pilot ────────────────────────────────────────────────────────────────────

const PROFILE_TIME_ROW = /^time:/;

async function cmdPilot() {
    const ctx = await startSession("pilot");
    const log = path.join(ctx.outDir, "pilot", "runs.jsonl");
    const byId = (id) => { const s = ctx.strokes.find((x) => x.id === id); if (!s) throw new Error(`stroke ${id} not in strokes.json`); return s; };
    const mainNone = ctx.strokes.filter((s) => s.sets.includes("main") && s.condition === "none" && !s.wholeCloud && !s.tileInit);
    const A = args["cache-stroke"] && args["cache-stroke"] !== true ? byId(args["cache-stroke"]) : (ctx.strokes.find((s) => s.anchor) || mainNone[0]);
    const F = args["full-stroke"] && args["full-stroke"] !== true ? byId(args["full-stroke"]) : A;
    let overhead;
    if (listArg(args["overhead-strokes"])) overhead = [...listArg(args["overhead-strokes"])].map(byId);
    else {
        // Ten quick strokes, spread over the datasets: the smallest multipliers first.
        const byDs = {};
        for (const s of [...mainNone].sort((a, b) => (a.multiplier ?? 0) - (b.multiplier ?? 0))) (byDs[s.dataset] ||= []).push(s);
        overhead = [];
        for (let i = 0; overhead.length < 10 && Object.values(byDs).some((l) => l.length > i); i++) {
            for (const l of Object.values(byDs)) if (l[i] && overhead.length < 10) overhead.push(l[i]);
        }
    }
    const pantheonDs = Object.entries(ctx.datasets).find(([, d]) => d.forceLoadAll)?.[0];
    const P = args["pantheon-stroke"] && args["pantheon-stroke"] !== true ? byId(args["pantheon-stroke"])
        : ctx.strokes.find((s) => s.dataset === pantheonDs && s.condition === "none");
    if (!A) throw new Error("no stroke for the cache check");

    const runs = [];
    const add = (stroke, mode, role, n, instrument = true) => runs.push({
        key: [ctx.machine.label, ctx.network, mode, stroke.id, role, ctx.sessionId, n].join("|"),
        stroke, mode, sample: n, round: 0, discard: true, role, instrument,
    });
    add(A, "lean", "pilot-cache", 1); add(A, "lean", "pilot-cache", 2);
    add(F, "full", "pilot-full", 1); add(F, "full", "pilot-full", 2);
    overhead.forEach((s, i) => {
        const order = i % 2 ? [false, true] : [true, false];
        for (const on of order) add(s, "lean", on ? "pilot-hooks-on" : "pilot-hooks-off", i + 1, on);
    });
    if (P) add(P, "lean", "pilot-pantheon", 1);
    console.log(`pilot: ${runs.length} runs (cache ${A.id}, full ${F.id}, ${overhead.length} overhead strokes, pantheon ${P?.id ?? "none"})`);

    const recs = [];
    try {
        for (let i = 0; i < runs.length; i++) {
            const rec = await execute(ctx, runs[i], log);
            recs.push(rec);
            console.log(`[${i + 1}/${runs.length}] ${runs[i].role} ${runs[i].stroke.id}: ${summarizeRec(rec)}`);
        }
    } finally {
        await ctx.browser.close().catch(() => {});
    }

    // ── Checks
    const checks = [];
    const ok = (r) => r.status === "ok";
    const gpus = [...new Set(recs.map((r) => r.gpu?.renderer).filter(Boolean))];
    checks.push({ check: "1. WebGL renderer is a hardware GPU", pass: gpus.length > 0 && !recs.some((r) => r.softwareGL), detail: gpus.join(" | ") || "no renderer read" });

    const cache = recs.filter((r) => r.role === "pilot-cache");
    const counts = (r) => Object.fromEntries(["octree", "hierarchy", "copc"].map((k) => [k, r.requests?.[k]?.count ?? 0]));
    const fromCache = (r) => ["octree", "hierarchy", "copc", "other"].reduce((a, k) => a + (r.requests?.[k]?.fromCache ?? 0), 0);
    const sizesKnown = cache.every((r) => ["octree", "hierarchy", "copc"].every((k) => !r.requests?.[k] || r.requests[k].sizesKnown));
    const sameCounts = cache.length === 2 && cache.every(ok) && JSON.stringify(counts(cache[0])) === JSON.stringify(counts(cache[1]));
    checks.push({
        check: "2. nothing from cache; identical runs give identical request counts",
        pass: sameCounts && cache.every((r) => fromCache(r) === 0) && sizesKnown,
        detail: `${cache.map((r) => `${JSON.stringify(counts(r))} fromCache ${fromCache(r)}`).join(" vs ")}${sizesKnown ? "" : " (sizes unknown: cross-origin without Timing-Allow-Origin, cache use not verifiable)"}`,
    });

    const on = recs.filter((r) => r.role === "pilot-hooks-on" && ok(r)).map((r) => r.timing.completionMs);
    const off = recs.filter((r) => r.role === "pilot-hooks-off" && ok(r)).map((r) => r.timing.completionMs);
    const mOn = median(on), mOff = median(off);
    const diffPct = mOn && mOff ? 100 * (mOn - mOff) / mOff : null;
    checks.push({ check: "3. instrumentation overhead: median completion on vs off < 3%", pass: diffPct !== null && Math.abs(diffPct) < 3 && on.length === overhead.length && off.length === overhead.length,
                  detail: `on ${mOn?.toFixed(1)} ms vs off ${mOff?.toFixed(1)} ms (${diffPct?.toFixed(2)}%), ${on.length}+${off.length} ok of ${overhead.length}+${overhead.length}` });

    const full = recs.filter((r) => r.role === "pilot-full");
    const rows = (r) => Object.entries(r.profile || {}).filter(([k]) => !PROFILE_TIME_ROW.test(k));
    const differing = full.length === 2 ? rows(full[0]).filter(([k, v]) => full[1].profile?.[k] !== v).map(([k, v]) => `${k}: ${v} vs ${full[1].profile?.[k]}`) : ["missing runs"];
    checks.push({ check: "4. full mode twice gives identical node counts", pass: full.length === 2 && full.every(ok) && full.every((r) => r.profile) && differing.length === 0,
                  detail: differing.length ? differing.join("; ") : `${rows(full[0]).length} rows identical` });

    const pan = recs.find((r) => r.role === "pilot-pantheon");
    checks.push({ check: "5. Pantheon makes 0 octree.bin requests during strokes", pass: !!pan && ok(pan) && (pan.requests?.octree?.count ?? 0) === 0,
                  detail: pan ? `${pan.requests?.octree?.count ?? 0} octree.bin, ${pan.requests?.hierarchy?.count ?? 0} hierarchy.bin; force-loaded ${pan.setup?.forceLoad?.loadedNodes}/${pan.setup?.forceLoad?.hierarchyNodes} nodes` : "no Pantheon stroke" });

    const report = { type: "pilot", sessionId: ctx.sessionId, machine: ctx.machine, chrome: ctx.chromeVersion, finishedAt: new Date().toISOString(), checks };
    fs.writeFileSync(path.join(ctx.outDir, "pilot", "pilot_report.json"), JSON.stringify(report, null, 2));
    console.log("\nPilot checks:");
    for (const c of checks) console.log(`  ${c.pass ? "PASS" : "FAIL"}  ${c.check}\n        ${c.detail}`);
    console.log(`\nreport: ${path.join(ctx.outDir, "pilot", "pilot_report.json")}`);
}

// ── capture ──────────────────────────────────────────────────────────────────

async function cmdCapture() {
    const id = args._[1];
    const datasets = loadDatasets();
    const ds = datasets[id];
    if (!ds) throw new Error(`usage: node run.mjs capture <dataset> [--url "<tile URL>"]; datasets: ${Object.keys(datasets).join(", ")}`);
    const out = path.resolve(args.captures || path.join(HERE, "captures.jsonl"));
    const browser = await launchBrowser({ devtools: true });
    const page = (await browser.pages())[0] || await browser.newPage();
    await page.setViewport(VIEWPORT);
    const cdp = await page.createCDPSession();
    await cdp.send("Network.enable");
    await blockURLs(cdp, ds.block ?? DEFAULT_BLOCK);
    await page.exposeFunction("__benchSave", (json) => {
        const cap = JSON.parse(json);
        appendJSONL(out, cap);
        console.log(`saved ${cap.label} → ${out}`);
        return "saved";
    });
    await page.evaluateOnNewDocument(`window.__benchConfig = ${JSON.stringify({ dataset: id })};`);
    await page.evaluateOnNewDocument(BENCH_SRC);
    let url;
    if (typeof args.url === "string") { const u = new URL(args.url); u.searchParams.set("bench", "1"); url = u.href; }
    else url = buildUrl(ds, null);
    await page.goto(url, { waitUntil: "load", timeout: NAV_TIMEOUT_MS });
    if (ds.pointcloud) {
        await page.evaluate(async (pc) => {
            await window.__bench.waitForScene({ pointcloud: pc });
            for (const p of viewer.scene.pointclouds) p.visible = p.name === pc;
            if (!document.getElementById("brushPanel")) openBrushPanel();
        }, ds.pointcloud).catch((e) => console.log("scene:", e.message));
    }
    console.log(`Capturing ${id} at ${VIEWPORT.width}x${VIEWPORT.height}. In the page's DevTools console, hover the brush over a`
        + ` spot and run:\n    __bench.capture("${id}-c1")\nCaptures are appended to ${out}. Close the browser when done.`);
    await new Promise((resolve) => browser.on("disconnected", resolve));
}

// ── main ─────────────────────────────────────────────────────────────────────

const HELP = `usage:
  node run.mjs runs --machine <name> [--set main|conditions|trace] [--mode full|lean|trace]
                    [--samples 5 | none=5,clip=3,hidden=3] [--network normal|throttled]
                    [--only id,id] [--dataset id,id] [--limit N] [--seed N] [--anchor id|none]
                    [--retry-failed] [--warmup true|false] [--dry-run]
  node run.mjs pilot --machine <name> [--cache-stroke id] [--full-stroke id]
                    [--overhead-strokes id,...] [--pantheon-stroke id]
  node run.mjs capture <dataset> [--url "<tile URL>"] [--captures captures.jsonl]
common: [--datasets datasets.json] [--strokes strokes.json] [--out results] [--chrome <path>]
measurement: [--no-gc] (no forced GC before the stroke) [--no-prewarm-workers] (let the stroke start decoder workers)
dev only: [--headless] [--allow-software-gl] [--budget-override N]`;

try {
    if (command === "runs") await cmdRuns();
    else if (command === "pilot") await cmdPilot();
    else if (command === "capture") await cmdCapture();
    else { console.log(HELP); process.exitCode = command === "help" ? 0 : 1; }
} catch (e) {
    console.error(e.stack || String(e));
    process.exitCode = 1;
}
