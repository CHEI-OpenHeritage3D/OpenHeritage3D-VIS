# Brush benchmark harness

Unattended timing of single brush strokes in the real viewer, for the Remote Sensing revision
(R1.2, R2.ii, R2.iii, R2.v, R3.2, R3.4). Each run opens the dataset's viewer page in a fresh,
cache-less browser context, sets the stroke up, waits until loading settles, calls
`paintAtPoint` once and appends one JSON line to `results/<machine>/runs.jsonl`.

| File | What it is |
|---|---|
| `run.mjs` | Puppeteer orchestrator: `runs`, `pilot`, `capture` |
| `bench.js` | In-page side, injected before any page script; defines `window.__bench` only with `?bench=1` |
| `patch_hooks.py` | Adds the three hook lines to `libs/custom/brush_selection.js` (dry run by default) |
| `datasets.json` | Viewer URL, cloud, point budget, target/hidden class, timeouts per dataset |
| `make_strokes.py` | Captures + `plan.json` → `strokes.json` |
| `analyze.py` | Tables, `summary.md`, and the log–log figure (needs matplotlib) |

## Setup (each machine)

Node 22.12 or newer (puppeteer 25 needs it), Python 3.9+, and matplotlib for the figure.

```
cd tools/brush_bench
npm ci                      # puppeteer 25.16.0 → Chrome for Testing 156.0.8078.47, same on every machine
```

The hooks must be in the served `brush_selection.js` (`python3 patch_hooks.py` shows the diff,
`--apply` writes it). They call `window.__bench?.onEditFlag?.()`, which does nothing unless the
page was opened with `?bench=1`, and set `window.__lastStrokeProfile` only when
`window.BRUSH_PROFILE` is on. Every record carries the SHA-256 of the brush file the page ran.

Before a session: mains power, sleep off (`caffeinate -dims` on macOS, `systemd-inhibit` on Linux,
`powercfg /change standby-timeout-ac 0` on Windows), nothing else on the network, one machine at a
time. The browser is headful and is brought to the front before each stroke. Records note
`onBattery`.

## Workflow

1. **Capture centers** (4 per dataset), at the run viewport (1600×900, DPR 1):
   ```
   node run.mjs capture fr38
   ```
   In the page's DevTools console, hover the brush over a spot and run `__bench.capture("fr38-c1")`.
   Each capture records the camera, the point under the cursor (picked as the brush picks), the
   cloud, the leaf extent there, and the root box. For clip strokes, open a Work Distribution tile
   URL: `node run.mjs capture fr38 --url "<tile URL>"`, hover near a tile wall, and capture
   (`fr38-t1`); the capture keeps the URL's `volumes` and the distance to the nearest wall.
   Captures go to `captures.jsonl`.
2. **Plan and strokes**: copy `plan.example.json` to `plan.json`, then
   `python3 make_strokes.py`. Radii are multiples of the leaf extent; each camera keeps its
   capture's view direction, backed off until the sphere fills 40% of the view height. Clip strokes
   get a no-clip twin at the same center and radius for the comparison.
3. **Pilot**, then stop and review: `node run.mjs pilot --machine ref`
   (see below).
4. **Reference machine, normal network**:
   ```
   node run.mjs runs --machine ref --set main --mode full       # node counts; warms server caches
   python3 make_strokes.py --naive-from results/ref/runs.jsonl  # hidden strokes over 50,000 naive nodes?
   node run.mjs runs --machine ref --set main --mode lean       # none ×5, clip ×3, hidden ×3, in shuffled rounds
   node run.mjs runs --machine ref --set trace --mode trace
   node run.mjs runs --machine ref --set conditions --mode lean --network throttled --samples 3
   ```
5. **Laptop**, normal network: `node run.mjs runs --machine laptop --set conditions --mode lean --samples 3`
6. **Analysis**: `python3 analyze.py` (copy the laptop's `results/laptop/` next to `results/ref/` first).

Runs whose key is already in `runs.jsonl` are skipped, so a session can be restarted.
`--retry-failed` reruns errors and timeouts. `--dry-run` lists what would run.

## One run

1. New browser context, HTTP cache off, viewport 1600×900 at DPR 1, network profile.
   `classification_edits.gz` is blocked (FR38 and Pantheon import one at load), so every stroke
   starts from an empty ledger.
2. `<viewer URL>&bench=1` (plus `volumes`, `position`, `target` for clip strokes: a real tile URL).
3. Wait for the cloud's root and the zone setup. Zone auto-switch off, zone clip boxes removed
   (a tile volume stays), other clouds hidden. `openBrushPanel()`, then the point budget, target
   cloud, class, radius, class visibility and `BRUSH_PROFILE` (on in full mode only).
4. Camera set directly (pending tweens cleared). Decoder workers pre-created up to the stroke's
   load concurrency (see below). Pantheon: every node loaded.
5. Ready: no node loading or queued and the visible-node count unchanged for 2 s (3 min limit).
6. Forced GC, Resource Timing cleared (buffer 20,000, drained if it fills), heap read, per-frame
   sampler and long-task observer started; tracing in trace mode.
7. `t0`, `await paintAtPoint(pc, {position: center})`, `t1`.

Preconditions are checked before `t0`. A failure is recorded as `precondition-failed`, not run:
- the ledger is empty;
- class, radius and camera are as set, and only the target cloud is visible;
- no resident point already has the target class (or the hidden class);
- clipping and hidden classes match the condition.

## Measurements

- `timing.completionMs`: `t1 − t0`.
- `timing.firstVisibleEditMs`: the first animation frame that starts after the first hook call
  (a classification buffer flagged for upload: a bulk-marked resident node or a per-point flush),
  minus `t0`. `firstEditFlagMs` is the hook call itself. `null` if the stroke changed nothing resident.
- `timing.timeToReadyMs`: navigation start to ready (step 5).
- `frames`: rAF intervals during the stroke (median, p95, max); `longTasks` during the stroke.
- `heap`: `performance.memory.usedJSHeapSize` before, peak (per frame), after. In this Chrome it
  includes typed-array backing stores (point buffers): it equals CDP `usedSize + backingStorageSize`,
  which `heapCdp` records before and after.
- `resident`: loaded nodes and points of the cloud before and after.
- `requests`: Resource Timing entries that *started* during the stroke, by kind (`octree`,
  `hierarchy`, `copc`, `other`): count, bytes, median/p95 duration, `fromCache` (must be 0),
  HTTP status and protocol. Sizes need same origin, which the production viewer has.
- Full mode: `profile` (the stroke profiler's rows: naive = "nodes: total", inspected =
  "↳ explicit per-point", implicit = "↳ bulk-marked implicit"), `ledger` entries by type,
  `ledgerSize` (bytes `exportBrowserBinary` would write, gzipped). Full mode also times the
  profiler's hierarchy reads, so take timing from lean mode only.
- Identity: key, session, machine (CPU, cores, RAM, OS), network profile, Chrome version, GPU
  renderer string, brush and potree.js SHA-256, bench.js SHA-256, dataset, stroke, condition, mode,
  sample, round, status.

Choices beyond the spec, each switchable:
- **Forced GC before `t0`** (`--no-gc` to skip), so heap before/after compare like with like.
- **Pre-created decoder workers** (`--no-prewarm-workers` to skip). A stroke raises load
  concurrency to 24, so Potree would start new decoder workers mid-stroke, and with the cache off
  each new worker downloads its 230 KB script again. A real session pays that once at most.

Network throttling (`--network throttled`) is CDP emulation: 20 Mbps down and up, 100 ms latency.
Chrome applies the latency as a per-request floor, so it equals +100 ms only on a link whose own
round trip is short (campus).

## Sessions and samples

- Lean runs go in rounds: each round runs every stroke once, in a seeded shuffled order.
- If lean doesn't start on the same day as full mode on that machine and network, round 0 is an
  extra warm-up round that analysis discards (`--warmup true|false` overrides).
- The anchor stroke (`"anchor"` in the plan) runs at the start and end of every session.
  `sessions.jsonl` flags the session if the two completions differ by more than 20%, and analysis
  leaves flagged sessions out unless `--include-flagged`.
- Stroke timeout: 5 min (`strokeTimeoutMin`), 20 for strokes at least `largeStrokeRadius`
  (LA County). A crashed browser is relaunched and the run retried once.

## Pilot

`node run.mjs pilot --machine ref` runs and checks:
1. the WebGL renderer is a hardware GPU (not SwiftShader/llvmpipe);
2. nothing is served from cache, and two identical lean runs make the same request counts;
3. instrumentation overhead: 10 strokes with the hook, sampler and observers on vs off
   (alternating order), median completion within 3%;
4. two full-mode runs give identical profiler rows (all but the time rows);
5. a Pantheon stroke makes 0 octree.bin requests.

Results: `results/<machine>/pilot/`. Override the strokes with `--cache-stroke`, `--full-stroke`,
`--overhead-strokes`, `--pantheon-stroke`.

## Size

| Set | Runs |
|---|---|
| main: 6 datasets × 4 centers × 5 radii = 120 strokes, full ×1 + lean ×5 | 720 |
| clip/hidden: 48 strokes, full ×1 + lean ×3 | 192 |
| clip twins (no-clip, same center/radius): 24 strokes, full ×1 + lean ×3 | 96 |
| conditions: 18 strokes × 2 conditions × 3 | 108 |
| trace | 12 |

## Development checks

`--headless --allow-software-gl --chrome <path>` runs under SwiftShader; such records carry
`softwareGL: true` and analysis ignores them unless `--include-software-gl`. `--budget-override N`
lowers the point budget for that.
