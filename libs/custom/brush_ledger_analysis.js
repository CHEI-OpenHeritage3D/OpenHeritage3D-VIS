/**
 * brush_ledger_analysis.js
 *
 * Ledger Analysis for the Classification Brush. Compares N imported ledger files with one
 * another, point by point, reports how far they agree, and merges them, by consensus or by
 * contributor priority, into a new browser-format ledger file. With overlapping tile margins the
 * same comparison is a boundary review: margin points carry two labels, and disagreements become
 * ties.
 *
 * Separate from the live ledger. Compare and merge never read or change brushEdits, the class
 * list, the contributor name or the scene, and never read classifications from the hosted octree.
 * Viewing is the one exception: View shows an imported ledger, and Merge its result, in the
 * viewer by putting it in brushEdits in place of the brush's own entries, which are set aside and
 * put back when viewing stops (see "Viewing a ledger"). Download saves the merge as a file, and
 * Export JSON the analysis: statistics, matrices and the histogram behind them. To
 * adjudicate, Merge, hide every class except Conflict, and brush over the conflicts: the brush
 * skips hidden classes point by point, so only Conflict points change. The brush panel's Export
 * then saves the merged ledger with those strokes.
 *
 * Status: Compare and merge both work end to end. Compare's walk tallies a histogram of label
 * tuples, and every statistic, the confusion matrix and the merge preview are computed from it.
 * The merge walks the same nodes and writes the merged entries (laMergeEngine), which the
 * writer saves as a browser-binary-v1 file that the brush panel's Import reads.
 *
 * Ledger model, one per imported file:
 *   clouds: Map<pcName, Map<nodeName, { all, runs }>>
 *     all   class of the node's "#all" baseline, or LA_NONE
 *     runs  Uint32Array of (start, end, class) triples over the node's own point indices: sorted,
 *           disjoint, end exclusive, adjacent runs of one class joined. null without overrides.
 *   A point's label is its own override, else the nearest "#all" at or above its node, else none:
 *   the same rule applyLedgerToNode() renders with. With class 0 set to count as no label, Compare
 *   and Merge read a label of 0 as none; with unlabeled points set to vote as class 0, they read a
 *   ledger's missing label as 0 wherever another ledger labels the point (see laReadTuple).
 *   Overrides stay as runs, the way the binary
 *   format stores them, at 12 bytes a run; Import expands each into a Map entry and an object per
 *   point, about 30 bytes per override.
 *
 * Depends on brush_selection.js (DEFAULT_CLASSIFICATIONS, CLASSIFICATIONS, syncClassificationsToViewer,
 * rebuildClassificationGridUI, getContributorName, geoNodeNumPoints, countSubtreeFromFile,
 * _fetchChunk20, _fetchPageCopc, brushEdits, brushState, waitForLoad, viewer) and
 * brush_binary_export.js (BRUSH_BINARY_MAGIC,
 * maybeGunzip, splitHeader, ByteSink, _writeVarint), which are classic scripts sharing one global
 * scope. Works on Potree 2.0 and COPC clouds; the ledger format is the same for both.
 */

// ══════════════════════════════════════════════════════════════
//  Styles
// ══════════════════════════════════════════════════════════════

const _laStyle = document.createElement("style");
_laStyle.textContent = `
#ledgerAnalysisPanel {
    position: fixed;
    top: 80px;
    right: -460px;
    width: clamp(320px, 30vw, 420px);
    max-height: calc(100vh - 100px);
    overflow-y: auto;
    padding: 18px 20px;
    box-sizing: border-box;
    background: rgba(20, 20, 26, 0.9);
    backdrop-filter: blur(12px) saturate(140%);
    -webkit-backdrop-filter: blur(12px) saturate(140%);
    border: 1px solid rgba(255,255,255,0.12);
    border-radius: 14px;
    box-shadow: 0 0 28px rgba(0,0,0,0.55);
    z-index: 10000;
    font-family: 'Segoe UI', system-ui, sans-serif;
    font-size: 13px;
    color: #d6d6de;
    display: flex;
    flex-direction: column;
    gap: 14px;
    transition: right 0.28s ease, opacity 0.25s ease;
    opacity: 0;
}
#ledgerAnalysisPanel.open { right: 420px; opacity: 1; }
#ledgerAnalysisPanel [hidden] { display: none !important; }
/* The panel is mostly text and figures, so it is nearly opaque, in the window manager's frame too:
   the scene showing through made small text hard to read. No text is smaller than 12px. */
.pwm-frame:has(> .pwm-body > #ledgerAnalysisPanel) { background: rgba(20, 20, 26, 0.9); }
#ledgerAnalysisPanel .brush-label { color: #b4b4c0; }

.la-intro { font-size: 13px; line-height: 1.5; color: #b4b4c0; }
.la-section { display: flex; flex-direction: column; gap: 6px; }
.la-section > .brush-label { margin-bottom: 0; }
.la-section-head { display: flex; align-items: center; gap: 8px; }
.la-section-head .brush-label { margin-bottom: 0; }
.la-count { font-size: 12px; color: #a4a4b0; font-variant-numeric: tabular-nums; }
.la-head-actions { margin-left: auto; display: flex; gap: 2px; }

.la-link-btn {
    background: none; border: none; color: #8f8cff; font-size: 13px; font-family: inherit;
    cursor: pointer; padding: 2px 6px; border-radius: 4px; transition: background 0.15s;
}
.la-link-btn:hover:not(:disabled) { background: rgba(79,70,229,0.15); }
.la-link-btn:disabled { color: #6a6a74; cursor: default; }
.la-link-btn.la-danger { color: #e07070; }
.la-link-btn.la-danger:hover:not(:disabled) { background: rgba(220,38,38,0.15); }

.la-list {
    display: flex; flex-direction: column; gap: 6px;
    border-radius: 10px; transition: background 0.15s, box-shadow 0.15s;
}
.la-list.la-dropping { background: rgba(79,70,229,0.12); box-shadow: 0 0 0 1px rgba(110,107,255,0.6); }
.la-empty {
    padding: 16px 12px; text-align: center; font-size: 13px; line-height: 1.5; color: #a4a4b0;
    border: 1px dashed rgba(255,255,255,0.18); border-radius: 10px;
}
.la-empty b { color: #b3afff; font-weight: 600; }

/* Rank, name and controls on the first line, and the lines under the name as wide as name and controls */
.la-row {
    display: grid; grid-template-columns: auto minmax(0, 1fr) auto; row-gap: 2px; align-items: center;
    padding: 8px 6px 8px 10px;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 8px;
}
.la-rank {
    grid-area: 1 / 1; width: 22px; height: 22px; margin-right: 10px; border-radius: 50%;
    display: inline-flex; align-items: center; justify-content: center;
    background: rgba(79,70,229,0.35); color: #d4d1ff; font-size: 12px; font-weight: 700;
}
.la-row.la-viewing { background: rgba(79,70,229,0.12); border-color: rgba(110,107,255,0.55); }
.la-row-main { display: contents; }
.la-row-main > * { grid-column: 2 / 4; }
.la-row-main > .la-name { grid-area: 1 / 2; }
.la-name { font-size: 14px; font-weight: 600; color: #f2f2f6; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.la-sub {
    font-size: 12px; color: #b4b4c0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    font-variant-numeric: tabular-nums;
}
.la-sub.la-wrap { white-space: normal; }
.la-sub.la-warn { color: #fbbf77; }
.la-sub strong { color: #d0cdff; font-weight: 600; }
.la-controls { grid-area: 1 / 3; margin-left: 8px; display: flex; gap: 1px; }
.la-nowrap { white-space: nowrap; }

.la-icon-btn {
    width: 24px; height: 24px; padding: 0; display: inline-flex; align-items: center; justify-content: center;
    border: none; border-radius: 5px; background: transparent; color: #b4b4c0;
    font-size: 15px; font-family: inherit; cursor: pointer; transition: background 0.15s, color 0.15s;
}
.la-icon-btn:hover:not(:disabled) { background: rgba(255,255,255,0.08); color: #fff; }
.la-icon-btn.la-remove:hover:not(:disabled) { background: rgba(220,38,38,0.3); color: #f87171; }
.la-icon-btn:disabled { opacity: 0.3; cursor: default; }
.la-view-btn {
    height: 24px; padding: 0 9px; margin-right: 4px;
    border: 1px solid rgba(255,255,255,0.16); border-radius: 5px; background: transparent;
    color: #b9b5ff; font-size: 12px; font-weight: 600; font-family: inherit;
    cursor: pointer; transition: background 0.15s, border-color 0.15s, color 0.15s;
}
.la-view-btn:hover:not(:disabled) { background: rgba(79,70,229,0.18); }
.la-view-btn[aria-pressed="true"] { background: rgba(79,70,229,0.45); border-color: rgba(79,70,229,0.6); color: #fff; }
.la-view-btn:disabled { opacity: 0.3; cursor: default; }

.la-cloud { display: flex; align-items: center; gap: 8px; font-size: 13px; min-width: 0; }
.la-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; background: #4ade80; }
.la-dot.la-warn { background: #fbbf24; }
.la-cloud-name { color: #e2e2e8; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
.la-cloud-status { margin-left: auto; padding-left: 8px; font-size: 12px; color: #b4b4c0; white-space: nowrap; flex-shrink: 0; }
.la-cloud-status.la-warn { color: #fbbf77; }

.la-progress {
    display: flex; align-items: center; gap: 8px; padding: 6px 6px 6px 12px;
    border-radius: 8px; background: rgba(79,70,229,0.15); border: 1px solid rgba(79,70,229,0.25);
    font-size: 13px; color: #c4c0ff;
}
.la-progress .la-link-btn { margin-left: auto; }

.la-table { width: 100%; border-collapse: collapse; table-layout: auto; font-size: 13px; font-variant-numeric: tabular-nums; }
.la-table td, .la-table th { padding: 3px 0; color: #d0d0d8; font-weight: normal; text-align: left; }
.la-table th { color: #b4b4c0; font-size: 12px; }
.la-table .la-num { text-align: right; color: #f0f0f4; padding-left: 10px; white-space: nowrap; width: 1%; }
.la-table th.la-num { color: #b4b4c0; }
.la-table .la-pct { text-align: right; color: #b4b4c0; padding-left: 10px; white-space: nowrap; width: 1%; }
.la-table .la-name-cell { max-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.la-table .la-indent1 { padding-left: 14px; }
.la-table .la-indent2 { padding-left: 28px; }
.la-table .la-strong { color: #d0cdff; }
.la-subhead { font-size: 12px; font-weight: 600; letter-spacing: 0.03em; color: #b4b4c0; margin-top: 6px; }
.la-badge {
    display: inline-flex; align-items: center; justify-content: center; min-width: 18px; height: 18px;
    margin-right: 5px; border-radius: 50%; background: rgba(79,70,229,0.35); color: #d4d1ff;
    font-size: 12px; font-weight: 700; vertical-align: 1px;
}

.la-pair { padding: 7px 30px 7px 10px; font-size: 13px; }
.la-matrix-wrap { overflow-x: auto; }
.la-matrix { border-collapse: separate; border-spacing: 2px; font-size: 12px; font-variant-numeric: tabular-nums; }
.la-matrix th { font-weight: normal; color: #c4c4ce; white-space: nowrap; padding: 0 4px; }
.la-matrix thead th { text-align: center; }
.la-matrix tbody th { text-align: left; max-width: 128px; overflow: hidden; text-overflow: ellipsis; padding-left: 0; }
.la-matrix td { min-width: 32px; height: 24px; padding: 0 3px; text-align: center; border-radius: 3px; }
.la-matrix td.la-zero { background: rgba(255,255,255,0.05); }
.la-matrix td.la-cell { font-weight: 600; cursor: default; }
.la-matrix td.la-cell:hover, .la-matrix td.la-cell:focus { outline: 1px solid #f0efec; outline-offset: 1px; }
.la-axis-swatch {
    display: inline-block; width: 9px; height: 9px; margin-right: 5px; border-radius: 2px;
    border: 1px solid rgba(255,255,255,0.15);
}
.la-none { font-style: italic; color: #b4b4c0; }
.la-readout { font-size: 12px; line-height: 1.5; color: #c4c4ce; min-height: 36px; }
.la-readout strong { color: #f2f2f6; font-weight: 600; }
.la-scale { display: flex; align-items: center; gap: 3px; font-size: 12px; color: #b4b4c0; }
.la-scale i { display: inline-block; width: 13px; height: 9px; border-radius: 2px; }

.la-field { display: grid; grid-template-columns: 100px 1fr; align-items: center; gap: 8px; }
.la-field-label { font-size: 13px; color: #c4c4ce; }
.la-seg { display: flex; gap: 4px; }
.la-seg button {
    flex: 1; padding: 6px 8px; border: 1px solid rgba(255,255,255,0.12); border-radius: 6px;
    background: rgba(255,255,255,0.05); color: #dcdce4; font-size: 13px; font-family: inherit;
    cursor: pointer; transition: background 0.15s, border-color 0.15s;
}
.la-seg button:hover { background: rgba(255,255,255,0.09); }
.la-seg button[aria-pressed="true"] { background: rgba(79,70,229,0.45); border-color: rgba(79,70,229,0.6); color: #fff; }

.la-conflict { display: flex; align-items: center; gap: 8px; }
.la-conflict input {
    width: 62px; box-sizing: border-box; padding: 5px 8px;
    background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.14); border-radius: 6px;
    color: #f2f2f6; font-size: 14px; font-family: inherit; text-align: right; outline: none;
    -moz-appearance: textfield;
}
.la-conflict input:focus { border-color: #6e6bff; }
.la-conflict input.la-invalid { border-color: rgba(239,68,68,0.8); }
.la-conflict input::-webkit-outer-spin-button,
.la-conflict input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
.la-swatch { width: 12px; height: 12px; border-radius: 3px; border: 1px solid rgba(255,255,255,0.15); flex-shrink: 0; }
.la-conflict-name { font-size: 13px; color: #d0d0d8; }

.la-hint { font-size: 12px; line-height: 1.5; color: #a4a4b0; }
.la-hint.la-center { text-align: center; }
.la-hint.la-error { color: #f87171; }
.la-hint.la-warn { color: #fbbf77; }

.la-notice { font-size: 13px; line-height: 1.5; padding: 7px 10px; border-radius: 8px; border: 1px solid; overflow-wrap: anywhere; }
.la-notice.la-info  { color: #d0cdff; background: rgba(79,70,229,0.14); border-color: rgba(79,70,229,0.35); }
.la-notice.la-warn  { color: #fbbf77; background: rgba(220,120,30,0.12); border-color: rgba(220,120,30,0.3); }
.la-notice.la-error { color: #f87171; background: rgba(220,38,38,0.12); border-color: rgba(220,38,38,0.3); }
`;
document.head.appendChild(_laStyle);

// ══════════════════════════════════════════════════════════════
//  State
// ══════════════════════════════════════════════════════════════

const LA_NONE = -1;   // no label. Class 0 ("Never Classified") is a real label, so it can't mean none.
const LA_CONFLICT_NAME  = "Conflict";
const LA_CONFLICT_COLOR = "#00e5ff";

const _la = {
    inputs: [],      // imported ledgers in priority order, top first
    nextId: 1,
    // conflictClass null: automatic. zero: how a label of class 0 counts, "label" (Never
    // Classified) or "none"; it reads both Compare's histogram and the merge. unlabeled: how a
    // ledger without a label for a point counts where another ledger labels it, "abstain" or
    // "background" (a vote for class 0). "background" needs zero "label"; laSetRule keeps them apart.
    rule: { mode: "consensus", ties: "conflict", conflictClass: null, zero: "label", unlabeled: "abstain" },
    result: null,    // last Compare: { inputIds, clouds, raw, tuples, stats, seconds, notes }; tuples and stats read raw as rule.zero says
    merged: null,    // last Merge: { id, clouds, key, rule, inputCount, summary, table }
    matrixPair: null,  // input ids [a, b] the confusion matrix shows; null: the pair with most overlap
    busy: null,      // { slot, label, cancel } while files are read or a Compare or merge runs
    notices: [],     // [{ slot, kind: "info" | "warn" | "error", text }], shown under their action
    view: null,      // { id, saved } while input `id` is shown; saved: the brush's own brushEdits entries
    viewChain: Promise.resolve(),   // view switches, run one at a time
    viewClasses: [], // class list entries added while a merge result is shown (laShowClasses)
    panel: null,
    ui: null,
};

// ══════════════════════════════════════════════════════════════
//  Reading ledger files
// ══════════════════════════════════════════════════════════════

/**
 * Parses one ledger file into the model above. Accepts what the brush panel's Import accepts,
 * the binary Potree-only export (gzipped or not) and the older text CSV, and reads them the way
 * Import does, but into a fresh structure: nothing global changes.
 */
async function laReadLedgerFile(file) {
    const bytes  = await maybeGunzip(await file.arrayBuffer());
    const head   = new TextDecoder("utf-8", { fatal: false }).decode(bytes.subarray(0, 64));
    const binary = head.startsWith(BRUSH_BINARY_MAGIC);
    const parsed = binary ? laParseBinary(bytes) : laParseCSV(new TextDecoder().decode(bytes));
    const summary = laSummarize(parsed.clouds);
    return {
        fileName: file.name,
        name: parsed.meta.contributor || file.name,
        format: binary ? "binary" : "csv",
        meta: parsed.meta,
        classes: parsed.classes,       // the file's #CLASSIFICATIONS, or null (made with the defaults)
        clouds: parsed.clouds,
        summary,
        fingerprint: laFingerprint(parsed.clouds, summary),
    };
}

// The #METADATA and #CLASSIFICATIONS blocks both formats carry. take(line) consumes a line that
// belongs to them and reports whether it did.
function laHeaderReader() {
    const meta = {};
    let classes = null, block = null;
    return {
        meta,
        get classes() { return classes; },
        take(line) {
            if (line === "#METADATA")        { block = "meta"; return true; }
            if (line === "#CLASSIFICATIONS") { block = "classes"; classes = []; return true; }
            if (line === "#END_METADATA" || line === "#END_CLASSIFICATIONS") { block = null; return true; }
            if (block === "meta") {
                const comma = line.indexOf(",");
                if (comma !== -1) meta[line.slice(0, comma).trim()] = line.slice(comma + 1).trim();
                return true;
            }
            if (block === "classes") {
                const first = line.indexOf(","), last = line.lastIndexOf(",");
                const value = parseInt(line.slice(0, first));
                const name  = line.slice(first + 1, last), color = line.slice(last + 1);
                if (first !== -1 && first !== last && value >= 0 && value <= 255 && name && color) {
                    classes.push({ value, name, color });
                }
                return true;
            }
            return false;
        },
    };
}

function laCheckClass(c) {
    if (!(c >= 0 && c <= 255)) throw new Error(`Class ${c} is outside 0–255.`);
}

function laFormatError(format) {
    return format === "python" || format.startsWith("world")
        ? "This is a world-space export. Use the Potree-only export (.gz) instead."
        : `Unknown ledger format "${format}".`;
}

/** The older text CSV: [pc] and {node} sections holding "#all,<class>" and "pIndex,class" rows. */
function laParseCSV(text) {
    const lines = text.split("\n");
    for (let i = 0, seen = 0; i < lines.length && seen < 20; i++) {
        const t = lines[i].trim();
        if (!t) continue;
        seen++;
        if (t.startsWith("#FORMAT,")) {
            const format = t.slice(8);
            if (format !== "browser") throw new Error(laFormatError(format));
            break;
        }
    }

    const header = laHeaderReader();
    const staged = new Map();      // pcName → Map<nodeName, { all, idx, cls }>
    let nodes = null, entry = null, sectionStart = 0;

    for (let line of lines) {
        line = line.trim();
        if (!line || line.startsWith("#FORMAT,") || header.take(line)) continue;

        if (line.startsWith("[") && line.endsWith("]")) {
            const pc = line.slice(1, -1);
            if (!staged.has(pc)) staged.set(pc, new Map());
            nodes = staged.get(pc);
            entry = null;
            continue;
        }
        if (line.startsWith("{") && line.endsWith("}")) {
            entry = null;
            if (!nodes) continue;
            const name = line.slice(1, -1);
            if (!nodes.has(name)) nodes.set(name, { all: LA_NONE, idx: [], cls: [] });
            entry = nodes.get(name);
            sectionStart = entry.idx.length;   // a node can have several sections; later rows win
            continue;
        }
        if (!entry) continue;

        if (line.startsWith("#all,")) {
            const c = parseInt(line.slice(5));
            if (isNaN(c)) continue;
            laCheckClass(c);
            entry.all = c;
            // As Import does: an "#all" replaces the rows its own section had before it.
            entry.idx.length = entry.cls.length = sectionStart;
            continue;
        }
        const comma = line.indexOf(",");
        const p = parseInt(line), c = parseInt(line.slice(comma + 1));
        if (comma === -1 || isNaN(p) || isNaN(c) || p < 0) continue;   // also skips "pIndex,classification"
        laCheckClass(c);
        entry.idx.push(p);
        entry.cls.push(c);
    }

    if (staged.size === 0 && !header.meta.contributor && !lines.some(l => l.startsWith("#FORMAT,"))) {
        throw new Error("Not a ledger file.");
    }

    const clouds = new Map();
    for (const [pc, staging] of staged) {
        const out = new Map();
        for (const [name, e] of staging) {
            const runs = laRunsFromRows(e.idx, e.cls);
            if (e.all !== LA_NONE || runs) out.set(name, { all: e.all, runs });
        }
        if (out.size) clouds.set(pc, out);
    }
    return { meta: header.meta, classes: header.classes, clouds };
}

// CSV rows (in file order, later rows win) → runs.
function laRunsFromRows(idx, cls) {
    if (idx.length === 0) return null;
    const last = new Map();
    for (let i = 0; i < idx.length; i++) last.set(idx[i], cls[i]);
    const keys = Float64Array.from(last.keys()).sort();
    const runs = [];
    for (let i = 0; i < keys.length; ) {
        const start = keys[i], c = last.get(start);
        let end = start + 1;
        for (i++; i < keys.length && keys[i] === end && last.get(end) === c; i++) end++;
        runs.push(start, end, c);
    }
    return Uint32Array.from(runs);
}

/** browser-binary-v1, as written by exportBrowserBinary(). The layout is documented there. */
function laParseBinary(bytes) {
    const split = splitHeader(bytes);
    if (!split) throw new Error("Binary ledger without a #BINARY line.");

    const header = laHeaderReader();
    let classMap = null, declared = 0;
    for (const raw of split.header.split("\n")) {
        const line = raw.trim();
        if (!line || line.startsWith("#FORMAT,") || header.take(line)) continue;
        if (line.startsWith("#CLASSMAP,")) classMap = line.slice(10).split(",").filter(Boolean).map(Number);
        else if (line.startsWith("#BINARY,")) declared = Number(line.slice(8));
    }
    if (!classMap) throw new Error("Binary ledger without a #CLASSMAP line.");
    classMap.forEach(laCheckClass);
    const toClass = (id) => {
        if (id < 1 || id > classMap.length) throw new Error(`Class slot ${id} isn't in the #CLASSMAP.`);
        return classMap[id - 1];
    };

    const body = bytes.subarray(split.bodyOffset);
    if (body.length < declared) throw new Error("Binary ledger is truncated.");
    const view = new DataView(body.buffer, body.byteOffset, body.byteLength);
    const utf8 = new TextDecoder();
    let off = 0;
    const take = (n) => {                 // offset of the next n bytes
        if (off + n > body.length) throw new Error("Binary ledger is truncated.");
        off += n;
        return off - n;
    };

    const clouds = new Map();
    const pcCount = view.getUint32(take(4), true);
    for (let p = 0; p < pcCount; p++) {
        const pcName = utf8.decode(body.subarray(take(view.getUint16(take(2), true)), off));
        const nodeCount = view.getUint32(take(4), true);
        const nodes = clouds.get(pcName) ?? new Map();
        for (let n = 0; n < nodeCount; n++) {
            const name  = utf8.decode(body.subarray(take(body[take(1)]), off));
            const flags = body[take(1)];
            const all   = flags & 1 ? toClass(body[take(1)]) : LA_NONE;
            let runs = null;
            if (flags & 2) {
                const len = view.getUint32(take(4), true);
                const at  = take(len);
                runs = laDecodeRuns(body, at, at + len, toClass);
            }
            if (all === LA_NONE && !runs) continue;
            if (nodes.has(name)) throw new Error(`Node ${name} of ${pcName} appears twice.`);
            nodes.set(name, { all, runs });
        }
        if (nodes.size) clouds.set(pcName, nodes);
    }
    return { meta: header.meta, classes: header.classes, clouds };
}

// One node's run stream: (u8 class slot, varint length) pairs from point 0, slot 0 for a gap.
function laDecodeRuns(bytes, off, end, toClass) {
    const runs = [];
    let cursor = 0;
    while (off < end) {
        const id = bytes[off++];
        let len = 0, scale = 1, b;
        do {
            if (off >= end) throw new Error("Binary ledger has a cut-off run.");
            b = bytes[off++];
            len += (b & 0x7f) * scale;
            scale *= 128;
        } while (b & 0x80);
        if (id !== 0 && len > 0) {
            const c = toClass(id), k = runs.length;
            if (k && runs[k - 2] === cursor && runs[k - 1] === c) runs[k - 2] += len;
            else runs.push(cursor, cursor + len, c);
        }
        cursor += len;
    }
    return runs.length ? Uint32Array.from(runs) : null;
}

function laSummarize(clouds) {
    const s = { clouds: clouds.size, nodes: 0, bulk: 0, runs: 0, points: 0, classes: new Set() };
    for (const nodes of clouds.values()) {
        for (const e of nodes.values()) {
            s.nodes++;
            if (e.all !== LA_NONE) { s.bulk++; s.classes.add(e.all); }
            if (!e.runs) continue;
            for (let i = 0; i < e.runs.length; i += 3) {
                s.runs++;
                s.points += e.runs[i + 1] - e.runs[i];
                s.classes.add(e.runs[i + 2]);
            }
        }
    }
    return s;
}

// Identifies a ledger's entries regardless of format and metadata, so the same work imported
// twice (exported twice, or as both .gz and .csv) is caught: it would vote twice. FNV-1a over
// 32-bit words, every field length-prefixed.
function laFingerprint(clouds, summary) {
    let h = 0x811c9dc5;
    const word = (v) => { h = Math.imul(h ^ v, 0x01000193); };
    const text = (s) => { word(s.length); for (let i = 0; i < s.length; i++) word(s.charCodeAt(i)); };
    for (const pc of [...clouds.keys()].sort()) {
        text(pc);
        const nodes = clouds.get(pc);
        for (const name of [...nodes.keys()].sort()) {
            const e = nodes.get(name);
            text(name);
            word(e.all + 1);
            word(e.runs ? e.runs.length : 0);
            if (e.runs) for (let i = 0; i < e.runs.length; i++) word(e.runs[i]);
        }
    }
    return `${summary.nodes}:${summary.points}:${(h >>> 0).toString(16)}`;
}

// ══════════════════════════════════════════════════════════════
//  Classes and the merge rule
// ══════════════════════════════════════════════════════════════

/**
 * Class names and colours across the inputs: each file's own #CLASSIFICATIONS, or the defaults
 * for a file without one (the export writes the block only for a custom list). A value two lists
 * define differently keeps the first in priority order and is reported. Values a ledger uses but
 * no list names get a generated entry, so the merged file lists every class it holds: Import
 * replaces the session's list with the file's, and the brush treats an unlisted class as visible,
 * so adjudicating could otherwise repaint it.
 */
function laClassTable(inputs) {
    const table = new Map(), clashes = new Set();
    for (const input of inputs) {
        for (const c of input.classes ?? DEFAULT_CLASSIFICATIONS) {
            const have = table.get(c.value);
            if (!have) table.set(c.value, { name: c.name, color: c.color });
            else if (have.name.trim().toLowerCase() !== c.name.trim().toLowerCase()) clashes.add(c.value);
        }
    }
    for (const input of inputs) {
        for (const v of input.summary.classes) {
            if (!table.has(v)) table.set(v, { name: `Class ${v}`, color: "#cccccc" });
        }
    }
    return { table, clashes: [...clashes].sort((a, b) => a - b) };
}

function laClassName(value, table) {
    if (value === LA_NONE) return "none";
    return table.get(value)?.name ?? `Class ${value}`;
}

// Why a class can't be the Conflict class, or null. Every class an input labels with or a list
// names is taken, except one already listed as Conflict (an earlier merge's): reusing it keeps
// both rounds' unresolved points in one class.
function laConflictTaken(v, inputs, table) {
    const listed = table.get(v);
    if (listed && listed.name.trim().toLowerCase() === LA_CONFLICT_NAME.toLowerCase()) return null;
    const user = inputs.find(i => i.summary.classes.has(v));
    if (user) return `Class ${v} is taken: ${user.name} labels points with it.`;
    if (listed) return `Class ${v} is taken: it is ${listed.name}.`;
    return null;
}

function laAutoConflictClass(inputs, table) {
    for (let v = 255; v >= 0; v--) if (!laConflictTaken(v, inputs, table)) return v;
    return 255;
}

/**
 * The merged label of one point from its label tuple (one class per input, LA_NONE where an input
 * doesn't label it). Inputs without a label abstain: a point one ledger labels takes that label,
 * which is what makes tile margins work as a boundary review. With unlabeled points voting as
 * class 0, laReadTuple has already turned those abstentions into votes for 0.
 * rank[i] is input i's priority,
 * 0 the highest. Returns [class, how], how being what decided it (for the preview).
 */
function laResolve(t, rank, rule) {
    let labelers = 0, first = LA_NONE, unanimous = true, best = -1;
    for (let i = 0; i < t.length; i++) {
        const c = t[i];
        if (c === LA_NONE) continue;
        if (labelers === 0) first = c;
        else if (c !== first) unanimous = false;
        labelers++;
        if (best === -1 || rank[i] < rank[best]) best = i;
    }
    if (labelers === 0) return [LA_NONE, "none"];
    if (labelers === 1) return [first, "single"];
    if (unanimous)      return [first, "agree"];
    if (rule.mode === "priority") return [t[best], "priority"];

    const votes = new Map();
    for (const c of t) if (c !== LA_NONE) votes.set(c, (votes.get(c) || 0) + 1);
    let top = 0;
    for (const v of votes.values()) top = Math.max(top, v);
    const winners = [...votes.keys()].filter(c => votes.get(c) === top);
    if (winners.length === 1) return [winners[0], "majority"];
    if (rule.ties === "conflict") return [rule.conflictClass, "tieConflict"];

    // The tied class whose best-ranked voter ranks highest
    let pick = -1;
    for (let i = 0; i < t.length; i++) {
        if (winners.includes(t[i]) && (pick === -1 || rank[i] < rank[pick])) pick = i;
    }
    return [t[pick], "tiePriority"];
}

// ══════════════════════════════════════════════════════════════
//  Statistics — all functions of the histogram
// ══════════════════════════════════════════════════════════════

// Histogram key of a label tuple
const laTupleKey     = (t) => t.join(",");
const laTupleFromKey = (key) => Int16Array.from(key.split(","), Number);

// A label tuple with class 0 read as no label
const laZeroToNone = (t) => t.map(c => (c === 0 ? LA_NONE : c));
// A label tuple with no label read as a vote for class 0
const laNoneToZero = (t) => t.map(c => (c === LA_NONE ? 0 : c));

/**
 * A label tuple as the rule reads it. Class 0 counting as no label turns every 0 into LA_NONE.
 * Unlabeled points voting as class 0 turn every LA_NONE into 0, but only where some ledger labels
 * the point: a point no ledger labels stays unlabeled, so the merge writes nothing for it. Use that
 * setting only when every ledger covers the same area, e.g. each contributor's whole-area ledger,
 * not tile ledgers, whose unlabeled points can lie outside their tile.
 */
function laReadTuple(t, rule) {
    if (rule.zero === "none") t = laZeroToNone(t);
    if (rule.unlabeled === "background" && t.some(c => c !== LA_NONE)) t = laNoneToZero(t);
    return t;
}

/**
 * The Compare histogram as the rule reads it (laReadTuple): tuples that end up alike are added
 * together, and those left without a label drop out, as the walk drops them. So neither setting
 * needs a new walk.
 */
function laReadTuples(raw, rule) {
    if (rule.zero !== "none" && rule.unlabeled !== "background") return raw;
    const hist = new Map();
    for (const { t, count } of raw) {
        const u = laReadTuple(t, rule);
        if (u.every(c => c === LA_NONE)) continue;
        const key = laTupleKey(u);
        hist.set(key, (hist.get(key) || 0) + count);
    }
    return [...hist].map(([key, count]) => ({ t: laTupleFromKey(key), count }));
}

/**
 * Agreement statistics from the histogram, as [{ t, count }]. They don't depend on the merge
 * settings, so changing those never needs another walk.
 */
function laStats(tuples, n) {
    const s = {
        n, any: 0, byOne: 0, byMany: 0, agree: 0, disagree: 0,
        labeled: new Array(n).fill(0),   // points each input labels
        pairs: [],                       // [{ i, j, both, agree, kappa }], most overlap first
        confusions: [],                  // [{ a, b, count }], class pairs labelers split on
    };
    const both = new Float64Array(n * n), same = new Float64Array(n * n);
    const margins = new Map();           // i*n+j → Map<class, [count by i, count by j]>
    const confusion = new Map();         // "a,b" (a < b) → points

    for (const { t, count } of tuples) {
        let k = 0, first = LA_NONE, unanimous = true;
        for (let i = 0; i < n; i++) {
            if (t[i] === LA_NONE) continue;
            s.labeled[i] += count;
            if (k === 0) first = t[i];
            else if (t[i] !== first) unanimous = false;
            k++;
        }
        if (k === 0) continue;
        s.any += count;
        if (k === 1) { s.byOne += count; continue; }
        s.byMany += count;
        if (unanimous) s.agree += count;
        else {
            s.disagree += count;
            const present = [...new Set(t)].filter(c => c !== LA_NONE).sort((a, b) => a - b);
            for (let a = 0; a < present.length; a++) {
                for (let b = a + 1; b < present.length; b++) {
                    const key = `${present[a]},${present[b]}`;
                    confusion.set(key, (confusion.get(key) || 0) + count);
                }
            }
        }
        for (let i = 0; i < n; i++) {
            if (t[i] === LA_NONE) continue;
            for (let j = i + 1; j < n; j++) {
                if (t[j] === LA_NONE) continue;
                const p = i * n + j;
                both[p] += count;
                if (t[i] === t[j]) same[p] += count;
                if (!margins.has(p)) margins.set(p, new Map());
                const m = margins.get(p);
                if (!m.has(t[i])) m.set(t[i], [0, 0]);
                if (!m.has(t[j])) m.set(t[j], [0, 0]);
                m.get(t[i])[0] += count;
                m.get(t[j])[1] += count;
            }
        }
    }

    for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
            const p = i * n + j, total = both[p];
            if (!total) continue;
            // Cohen's kappa over the points both label: agreement corrected for chance
            let expected = 0;
            for (const [ci, cj] of margins.get(p).values()) expected += (ci / total) * (cj / total);
            const observed = same[p] / total;
            const kappa = expected < 1 ? (observed - expected) / (1 - expected) : NaN;
            s.pairs.push({ i, j, both: total, agree: same[p], kappa });
        }
    }
    s.pairs.sort((x, y) => y.both - x.both);
    s.confusions = [...confusion].map(([key, count]) => {
        const [a, b] = key.split(",").map(Number);
        return { a, b, count };
    }).sort((x, y) => y.count - x.count);
    return s;
}

/** What the merge would decide under `rule`, per tuple of the histogram. */
function laPreview(tuples, rank, rule, n) {
    const how = { single: 0, agree: 0, majority: 0, priority: 0, tiePriority: 0, tieConflict: 0 };
    const kept = new Array(n).fill(0), overruled = new Array(n).fill(0), conflicted = new Array(n).fill(0);
    for (const { t, count } of tuples) {
        const [c, h] = laResolve(t, rank, rule);
        if (h === "none") continue;
        how[h] += count;
        for (let i = 0; i < n; i++) {
            if (t[i] === LA_NONE) continue;
            if (t[i] === c) kept[i] += count;
            else if (h === "tieConflict") conflicted[i] += count;
            else overruled[i] += count;
        }
    }
    return { how, kept, overruled, conflicted };
}

/**
 * Confusion matrix of the inputs at tuple positions a and b: points by (a's label, b's label),
 * LA_NONE where one of them doesn't label the point. A marginal of the histogram, so any pair is
 * instant. axis: the classes either uses, ascending, then LA_NONE.
 */
function laConfusion(tuples, a, b) {
    const cells = new Map(), classes = new Set();
    let total = 0;
    for (const { t, count } of tuples) {
        if (t[a] === LA_NONE && t[b] === LA_NONE) continue;
        const key = `${t[a]},${t[b]}`;
        cells.set(key, (cells.get(key) || 0) + count);
        total += count;
        if (t[a] !== LA_NONE) classes.add(t[a]);
        if (t[b] !== LA_NONE) classes.add(t[b]);
    }
    const axis = [...classes].sort((x, y) => x - y);
    axis.push(LA_NONE);
    return { axis, total, count: (x, y) => cells.get(`${x},${y}`) || 0 };
}

// ══════════════════════════════════════════════════════════════
//  Compare engine
//
//  One walk per cloud, down the octree from the root, through the nodes that have an entry at or
//  below them in some input: every entry name plus its ancestors, never the rest of the octree.
//  At such a node each input labels a point with its own run there, else with its baseline (the
//  nearest "#all" at or above). The inputs' run boundaries cut the node's points into stretches
//  of one label tuple, each tallied at once rather than point by point. A child with no entry at
//  or below it takes the inherited baselines for its whole subtree, tallied from its point count.
//
//  Counts come from node objects, which carry their point counts from the hierarchy before any
//  point data loads. Node objects exist only where the hierarchy has been expanded, though, and
//  the viewer expands it where the camera has looked. Below a node whose hierarchy isn't read yet
//  there are none: a Potree 2.0 proxy (nodeType 2), or a COPC node whose hierarchy page isn't
//  loaded (no nodeinfo yet). There the walk reads that chunk or page, never point data: 2.0
//  chunks through _fetchChunk20, which downloads hierarchy.bin once when it's at most 64 MB, COPC
//  pages through _fetchPageCopc. countSubtreeFromFile() counts a subtree that way. To reach
//  entries below such a node, Potree's own parser builds its nodes on a detached copy
//  (laExpandProxy), so the live octree stays exactly as the viewer has it.
//
//  COPC names its nodes as Potree does ("r" plus child indices, from the d-x-y-z key), and point
//  indices are record order in a node's LAZ chunk, so ledgers and both walks are the same for it.
// ══════════════════════════════════════════════════════════════

/**
 * @param {object[]} inputs   parsed ledgers in list order; tuple positions follow it
 * @param {object[]} clouds   [{ name, pc }]: the clouds to compare, loaded as Potree 2.0 or COPC
 * @param {object}   opts     { signal: AbortSignal, onProgress(text) }
 * @returns {Promise<{ hist: Map<string, number>, notes: string[] }>}
 *          hist: points per label tuple (key laTupleKey(t)); tuples without a label aren't tallied.
 *          notes: data problems met on the way, shown as warnings.
 */
async function laCompareEngine(inputs, clouds, { signal, onProgress } = {}) {
    const hist = new Map(), notes = [];
    const tally = (t, count) => {
        if (count <= 0 || t.every(c => c === LA_NONE)) return;
        const key = laTupleKey(t);
        hist.set(key, (hist.get(key) || 0) + count);
    };
    for (const { name, pc } of clouds) {
        const ledgers = inputs.map(i => i.clouds.get(name) ?? null);
        if (!ledgers.some(Boolean)) continue;
        const { missing, pastEnd } = await laWalkCloud(pc, ledgers, tally, signal,
            (done, total) => onProgress?.(`Comparing ${name}: ${laFmt(done)} of ${laFmt(total)} nodes…`));
        inputs.forEach((input, i) => {
            if (missing[i]) notes.push(`${input.name}: ${laFmt(missing[i])} ${missing[i] === 1 ? "entry names a node" : "entries name nodes"} ` +
                `${name} doesn't have, so it was likely made on another conversion of this dataset. Left out.`);
            if (pastEnd[i]) notes.push(`${input.name}: ${laFmt(pastEnd[i])} override ${pastEnd[i] === 1 ? "point lies" : "points lie"} ` +
                `past the end of ${pastEnd[i] === 1 ? "its node" : "their nodes"} in ${name}. Left out.`);
        });
    }
    return { hist, notes };
}

// The walk over one cloud. ledgers[i] is input i's entries for it, or null. Reports per input the
// entries the hierarchy has no node for, and the override points past their node's count.
async function laWalkCloud(pc, ledgers, tally, signal, progress) {
    const n = ledgers.length;
    const onPath = laPathSet(ledgers);
    const reached = new Set();
    const pastEnd = new Array(n).fill(0);
    const copies  = new Map();     // proxy → detached copy with its hierarchy chunk or page parsed
    let lastYield = performance.now();

    async function visit(node, inherited) {
        if (signal?.aborted) throw new DOMException("Compare cancelled.", "AbortError");
        if (performance.now() - lastYield > 30) {          // keep the page responsive
            await new Promise(r => setTimeout(r, 0));
            lastYield = performance.now();
            progress(reached.size, onPath.size);
        }
        if (!onPath.has(node.name)) {
            if (inherited.some(c => c !== LA_NONE)) tally(inherited, (await countSubtreeFromFile(node)).points);
            return;
        }
        reached.add(node.name);
        const real = laIsProxy(node) ? await laExpandProxy(node, copies) : node;
        const base = inherited.slice(), runs = new Array(n).fill(null);
        for (let i = 0; i < n; i++) {
            const e = ledgers[i]?.get(node.name);
            if (!e) continue;
            if (e.all !== LA_NONE) base[i] = e.all;
            runs[i] = e.runs;
        }
        laSweepNode(geoNodeNumPoints(real), runs, base, (t, from, to) => tally(t, to - from), pastEnd);
        await Promise.all(Object.values(real.children).filter(Boolean).map(child => visit(child, base)));
    }
    await visit(pc.pcoGeometry.root, new Int16Array(n).fill(LA_NONE));
    progress(reached.size, onPath.size);

    const missing = ledgers.map(ledger => ledger ? [...ledger.keys()].filter(name => !reached.has(name)).length : 0);
    return { missing, pastEnd };
}

// The nodes both walks visit: every entry name in the ledgers and every ancestor of one.
function laPathSet(ledgers) {
    const onPath = new Set();
    for (const ledger of ledgers) {
        if (!ledger) continue;
        for (const name of ledger.keys()) {
            for (let k = name.length; k > 0 && !onPath.has(name.slice(0, k)); k--) onPath.add(name.slice(0, k));
        }
    }
    return onPath;
}

// The hierarchy page a COPC node lists its children in, while that page isn't loaded
function laCopcPage(node) {
    return node.owner && !node.nodeinfo ? node.owner.pages[window.Copc.Key.toString(node.key)] : undefined;
}

// A node whose children aren't known until its hierarchy chunk (2.0) or page (COPC) is read
function laIsProxy(node) {
    return node.nodeType === 2 || !!laCopcPage(node);
}

// A proxy's subtree as node objects: its hierarchy chunk or page parsed by Potree's own parser
// onto a detached copy of the proxy. No point data is read, and the live octree doesn't change.
function laExpandProxy(proxy, copies) {
    if (!copies.has(proxy)) copies.set(proxy, (async () => {
        if (proxy.owner) {                                  // COPC
            const copy = new proxy.constructor(laDetachedOwner(proxy.owner), proxy.key, proxy.bounds);
            await copy.loadHierarchy();
            return copy;
        }
        const geom = proxy.octreeGeometry;
        const view = await _fetchChunk20(geom, proxy.hierarchyByteOffset, proxy.hierarchyByteSize);
        const copy = new proxy.constructor(proxy.name, geom, proxy.boundingBox);
        Object.assign(copy, { level: proxy.level, spacing: proxy.spacing, nodeType: 2 });
        geom.loader.parseHierarchy(copy, view.buffer.slice(view.byteOffset, view.byteOffset + view.byteLength));
        return copy;
    })());
    return copies.get(proxy);
}

/**
 * The owner for detached COPC nodes: the live geometry with a page map of its own. A COPC node's
 * loadHierarchy() records the pages it finds below it in owner.pages; here those go into a map
 * that falls back to the live one, so the live map gets nothing the viewer hasn't loaded. Pages
 * are read through _fetchPageCopc, which caps and retries requests as the brush's own reads are.
 * One per live geometry, so countSubtreeFromFile's per-owner memo lasts from one Compare to the
 * next.
 */
const _laDetachedOwners = new WeakMap();
function laDetachedOwner(geom) {
    let owner = _laDetachedOwners.get(geom);
    if (!owner) {
        owner = Object.create(geom, {
            pages: { value: Object.create(geom.pages) },
            loadHierarchyPage: { value(key) { return _fetchPageCopc(this, this.pages[window.Copc.Key.toString(key)]); } },
        });
        _laDetachedOwners.set(geom, owner);
    }
    return owner;
}

/**
 * Labels one node's own points, [0, count): input i labels a point with its run covering it,
 * else with base[i]. The inputs' run boundaries cut the range into stretches of one tuple, and
 * emit(t, from, to) is called once per stretch; t is reused between calls. Run points at or past
 * `count` go to pastEnd[i] instead, when pastEnd is given.
 */
function laSweepNode(count, runs, base, emit, pastEnd = null) {
    const n = runs.length;
    const cuts = [0, count];
    for (let i = 0; i < n; i++) {
        const r = runs[i];
        if (!r) continue;
        for (let k = 0; k < r.length; k += 3) {
            if (pastEnd && r[k + 1] > count) pastEnd[i] += r[k + 1] - Math.max(r[k], count);
            if (r[k] < count) cuts.push(r[k], Math.min(r[k + 1], count));
        }
    }
    cuts.sort((a, b) => a - b);
    const t = new Int16Array(n);
    const next = new Int32Array(n);   // per input, the first run that doesn't end before the stretch
    for (let c = 0; c + 1 < cuts.length; c++) {
        const from = cuts[c], to = cuts[c + 1];
        if (from === to) continue;
        for (let i = 0; i < n; i++) {
            const r = runs[i];
            t[i] = base[i];
            if (!r) continue;
            while (next[i] < r.length && r[next[i] + 1] <= from) next[i] += 3;
            if (next[i] < r.length && r[next[i]] <= from) t[i] = r[next[i] + 2];
        }
        emit(t, from, to);
    }
}

// ══════════════════════════════════════════════════════════════
//  Merge engine
//
//  Compare's walk again, through the same nodes, writing entries instead of counting points. It
//  needs no point counts, so it reads nothing from the dataset: the node names alone give the
//  tree, and clouds that aren't loaded merge too. At each node the merged baseline is the rule
//  applied to the inputs' baselines, written as "#all" only where it differs from the one the
//  merged ledger inherits from above. Points in some input's runs get a merged run where their
//  merged label differs from that baseline. Every other point, here or in a subtree the walk
//  doesn't enter, has the inputs' baselines as its tuple, so the merged baseline already gives it
//  the merged label.
//
//  Below a baseline a ledger can't take a point back to "none". Under the plain rule that never
//  comes up: down the tree an input's baseline only changes from one class to another, and the
//  rule gives none only to a point no input labels. With class 0 counting as no label, a point
//  whose only labels are 0 is none, and below a merged baseline it's written as noneAs: 0, the
//  class that setting reads as no label. Entries Compare leaves out, those naming nodes the
//  hierarchy lacks and run points past a node's end, pass through unchanged.
// ══════════════════════════════════════════════════════════════

/**
 * @param {object[]} inputs   parsed ledgers in priority order, top first; tuple positions follow it
 * @param {function} resolve  label tuple → merged class, LA_NONE for none
 * @param {object}   opts     { signal: AbortSignal, onProgress(text), noneAs: the class written for
 *                            a labeled point that resolves to none below a merged baseline, or
 *                            null when resolve gives none only to a tuple without a label }
 * @returns {Promise<Map<string, Map<string, {all, runs}>>>}   merged clouds, in the ledger model
 */
async function laMergeEngine(inputs, resolve, { signal, onProgress, noneAs = null } = {}) {
    const merged = new Map();
    for (const name of new Set(inputs.flatMap(i => [...i.clouds.keys()]))) {
        const nodes = await laMergeCloud(inputs.map(i => i.clouds.get(name) ?? null), resolve, noneAs, signal,
            (done, total) => onProgress?.(`Merging ${name}: ${laFmt(done)} of ${laFmt(total)} nodes…`));
        if (nodes.size) merged.set(name, nodes);
    }
    return merged;
}

// The merge walk over one cloud. ledgers[i] is input i's entries for it, or null.
async function laMergeCloud(ledgers, resolve, noneAs, signal, progress) {
    const n = ledgers.length;
    const onPath = laPathSet(ledgers);
    const children = new Map();     // name → its children on the path
    for (const name of onPath) {
        if (name.length < 2) continue;
        const parent = name.slice(0, -1);
        if (!children.has(parent)) children.set(parent, []);
        children.get(parent).push(name);
    }
    const out = new Map();
    let done = 0, lastYield = performance.now();

    // inherited: the inputs' baselines from above. above: the merged ledger's.
    async function visit(name, inherited, above) {
        if (signal?.aborted) throw new DOMException("Merge cancelled.", "AbortError");
        if (performance.now() - lastYield > 30) {          // keep the page responsive
            await new Promise(r => setTimeout(r, 0));
            lastYield = performance.now();
            progress(done, onPath.size);
        }
        done++;
        const base = inherited.slice(), runs = new Array(n).fill(null);
        for (let i = 0; i < n; i++) {
            const e = ledgers[i]?.get(name);
            if (!e) continue;
            if (e.all !== LA_NONE) base[i] = e.all;
            runs[i] = e.runs;
        }
        const all = laUnder(resolve(base), above, noneAs);
        const merged = laMergeRuns(runs, base, all, resolve, noneAs);
        if (all !== above || merged) out.set(name, { all: all !== above ? all : LA_NONE, runs: merged });
        for (const child of (children.get(name) ?? []).sort()) await visit(child, base, all);
    }
    for (const root of [...onPath].filter(name => name.length === 1).sort()) {
        await visit(root, new Int16Array(n).fill(LA_NONE), LA_NONE);
    }
    progress(done, onPath.size);
    return out;
}

// One node's merged runs: the stretches in some input's runs whose merged label differs from
// the node's merged baseline `all`, adjacent ones of a class joined. Without point counts the
// sweep ends where the last run does; past that every point has the baselines as its tuple.
function laMergeRuns(runs, base, all, resolve, noneAs) {
    let end = 0;
    for (const r of runs) if (r) end = Math.max(end, r[r.length - 2]);
    if (end === 0) return null;
    const out = [];
    laSweepNode(end, runs, base, (t, from, to) => {
        const c = laUnder(resolve(t), all, noneAs);
        if (c === all) return;
        const k = out.length;
        if (k && out[k - 2] === from && out[k - 1] === c) out[k - 2] = to;
        else out.push(from, to, c);
    });
    return out.length ? Uint32Array.from(out) : null;
}

// Merged label c as written below the merged baseline `under`, where none can't be written
function laUnder(c, under, noneAs) {
    if (c !== LA_NONE || under === LA_NONE) return c;
    if (noneAs === null) throw new Error("The merge rule gave a labeled point no label.");
    return noneAs;
}

// ══════════════════════════════════════════════════════════════
//  Writing the merged ledger (browser-binary-v1)
// ══════════════════════════════════════════════════════════════

function laClassesUsed(clouds) {
    const used = new Set();
    for (const nodes of clouds.values()) {
        for (const e of nodes.values()) {
            if (e.all !== LA_NONE) used.add(e.all);
            if (e.runs) for (let i = 2; i < e.runs.length; i += 3) used.add(e.runs[i]);
        }
    }
    return used;
}

/** Merged clouds → [header, body] of a file in the layout encodeLedgerBody() writes. */
function laEncodeLedger(clouds, headerLines) {
    const list = [...laClassesUsed(clouds)].sort((a, b) => a - b);
    if (list.length > 255) throw new Error(`Too many distinct classes (${list.length}) for a u8 class map.`);
    const toId = new Uint8Array(256);           // class value → slot (1-based)
    list.forEach((v, i) => { toId[v] = i + 1; });

    const kept = [];
    for (const [pc, nodes] of clouds) {
        const entries = [...nodes].filter(([, e]) => e.all !== LA_NONE || e.runs?.length);
        if (entries.length) kept.push([pc, entries]);
    }

    const sink = new ByteSink(), utf8 = new TextEncoder();
    sink.u32(kept.length);
    for (const [pcName, entries] of kept) {
        const pcBytes = utf8.encode(pcName);
        sink.u16(pcBytes.length);
        sink.pushBytes(pcBytes);
        sink.u32(entries.length);
        for (const [name, e] of entries) {
            const nameBytes = utf8.encode(name);
            const runs = e.runs?.length ? e.runs : null;
            sink.u8(nameBytes.length);
            sink.pushBytes(nameBytes);
            sink.u8((e.all !== LA_NONE ? 1 : 0) | (runs ? 2 : 0));
            if (e.all !== LA_NONE) sink.u8(toId[e.all]);
            if (runs) {
                const stream = laEncodeRuns(runs, toId);
                sink.u32(stream.length);
                sink.pushBytes(stream);
            }
        }
    }
    const body = sink.toUint8Array();
    const header = headerLines.concat([`#CLASSMAP,${list.join(",")}`, `#BINARY,${body.length}`]).join("\n") + "\n";
    return [header, body];
}

// Runs → run stream: (class slot, varint length) pairs from point 0, gaps as slot 0.
function laEncodeRuns(runs, toId) {
    const out = [];
    let cursor = 0;
    for (let i = 0; i < runs.length; i += 3) {
        const start = runs[i], end = runs[i + 1];
        if (start > cursor) { out.push(0); _writeVarint(out, start - cursor); }
        out.push(toId[runs[i + 2]]);
        _writeVarint(out, end - start);
        cursor = end;
    }
    return Uint8Array.from(out);
}

// Whoever runs the merge, named as the brush panel's export would name them.
function laAnalystName() {
    let name = getContributorName();
    if (!name) try { name = localStorage.getItem("oh3d_contributor") || ""; } catch (_) {}
    return name;
}

function laTiles(inputs) {
    return [...new Set(inputs.flatMap(i => (i.meta.tile || "").split("_").filter(Boolean)))].sort();
}

function laRuleText(rule) {
    const text = rule.mode === "priority" ? "priority"
        : rule.ties === "conflict" ? `consensus; ties to class ${rule.conflictClass} (${LA_CONFLICT_NAME})`
        : "consensus; ties by priority";
    if (rule.zero === "none") return `${text}; class 0 as no label`;
    if (rule.unlabeled === "background") return `${text}; unlabeled votes as class 0`;
    return text;
}

// The merged ledger's classes: the inputs' (laClassTable), with Conflict when the merge uses it
function laMergedClassTable(clouds, inputs, rule) {
    const { table } = laClassTable(inputs);
    if (laClassesUsed(clouds).has(rule.conflictClass) && !table.has(rule.conflictClass)) {
        table.set(rule.conflictClass, { name: LA_CONFLICT_NAME, color: LA_CONFLICT_COLOR });
    }
    return table;
}

/**
 * The merged file's header up to #END_CLASSIFICATIONS. Import sets the contributor box from the
 * file and replaces the session's class list with the file's, so the list is always written, in
 * full, with Conflict when the merge uses it. The inputs and the rule go in keys Import ignores.
 */
function laMergedHeader(clouds, inputs, rule) {
    const clean = (s) => String(s ?? "").replace(/[\r\n]+/g, " ").trim();
    const classes = [...laMergedClassTable(clouds, inputs, rule)].sort((a, b) => a[0] - b[0]);
    return [
        "#FORMAT,browser-binary-v1",
        "#METADATA",
        `contributor,${clean(laAnalystName())}`,
        `doi,${clean(window.doi || inputs.find(i => i.meta.doi)?.meta.doi)}`,
        `source,${clean([...clouds.keys()].join("; "))}`,
        `citation,${clean(window.projectCitation).replace(/,+/g, " ")}`,
        `generated,${new Date().toISOString()}`,
        `tile,${laTiles(inputs).join("_")}`,
        `merge,${laRuleText(rule)}`,
        `merge_inputs,${inputs.map(i => clean(i.name)).join("; ")}`,
        "#END_METADATA",
        "#CLASSIFICATIONS",
        ...classes.map(([value, c]) => `${value},${clean(c.name)},${c.color}`),
        "#END_CLASSIFICATIONS",
    ];
}

// Non-empty parts joined by "_", characters a file name can't take replaced
function laFileName(parts, ext) {
    return parts.filter(Boolean).map(s => String(s).replace(/[^\w\-]/g, "_")).join("_") + ext;
}

function laMergedFileName(clouds, inputs, rule) {
    return laFileName([...clouds.keys(), laTiles(inputs).join("_"), "merged", rule.mode, "ledger"], ".gz");
}

function laSaveBlob(blob, name) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

async function laSaveGzip(parts, name) {
    laSaveBlob(await new Response(new Blob(parts).stream().pipeThrough(new CompressionStream("gzip"))).blob(), name);
}

// ══════════════════════════════════════════════════════════════
//  Exporting the analysis (JSON)
// ══════════════════════════════════════════════════════════════

/**
 * The last Compare as one JSON document: the ledgers, the agreement statistics, every pair's
 * confusion matrix, the label-tuple histogram all of them come from, the merge preview under the
 * current settings, and the last merge. Ledgers are numbered by priority as the panel numbers
 * them, and every per-ledger array follows that order, whatever the order was when Compare ran.
 */
function laAnalysisReport() {
    const r = _la.result, inputs = _la.inputs, n = inputs.length;
    // The histogram with its tuples in list order, so statistics come out per priority
    const pos = inputs.map(i => r.inputIds.indexOf(i.id));
    const tuples = r.tuples.map(({ t, count }) => ({ t: Int16Array.from(pos, p => t[p]), count }));
    const s = laStats(tuples, n);
    const rule = laEffectiveRule(), problem = laConflictProblem();
    const p = laPreview(tuples, inputs.map((_, i) => i), rule, n);
    const { table, clashes } = laClassTable(inputs);
    const names = laDisplayNames(), m = _la.merged;
    const label = (c) => (c === LA_NONE ? null : c);
    const entries = (sum) => ({ nodes: sum.nodes, bulk: sum.bulk, overrideRuns: sum.runs, overridePoints: sum.points });
    const sorted = (set) => [...set].sort((a, b) => a - b);

    const matrices = [];
    for (let a = 0; a < n; a++) {
        for (let b = a + 1; b < n; b++) {
            const c = laConfusion(tuples, a, b);
            matrices.push({ rows: a + 1, columns: b + 1, classes: c.axis.map(label),
                            points: c.axis.map(x => c.axis.map(y => c.count(x, y))) });
        }
    }
    return {
        format: "oh3d-ledger-analysis",
        version: 1,
        about: "Ledger Analysis of the Classification Brush. Ledgers are numbered by priority, 1 at the top " +
               "of the list; per-ledger arrays follow that order. A label of null means the ledger " +
               "doesn't label the point. Point counts cover the compared clouds.",
        generated: new Date().toISOString(),
        analyst: laAnalystName() || null,
        doi: window.doi || inputs.find(i => i.meta.doi)?.meta.doi || null,
        settings: {
            treatClass0AsNoLabel: rule.zero === "none",
            unlabeledVotesAsClass0: rule.unlabeled === "background",
            merge: {
                mode: rule.mode,
                ties: rule.mode === "consensus" ? rule.ties : null,
                conflictClass: rule.mode === "consensus" && rule.ties === "conflict" ? rule.conflictClass : null,
                text: laRuleText(rule),
            },
        },
        ledgers: inputs.map((input, i) => ({
            priority: i + 1,
            name: names.get(input.id),
            file: input.fileName,
            format: input.format,
            contributor: input.meta.contributor || null,
            tile: input.meta.tile || null,
            generated: input.meta.generated || null,
            doi: input.meta.doi || null,
            clouds: [...input.clouds.keys()],
            entries: entries(input.summary),
            classes: sorted(input.summary.classes),
            labeledPoints: s.labeled[i],
        })),
        classes: [...table].sort((a, b) => a[0] - b[0]).map(([value, c]) => ({ value, name: c.name, color: c.color })),
        classNameClashes: clashes,
        compare: {
            clouds: r.clouds,
            seconds: r.seconds,
            warnings: r.notes,
            points: { labeled: s.any, byOneLedger: s.byOne, byTwoOrMore: s.byMany, allAgree: s.agree, disagree: s.disagree },
            pairs: s.pairs.map(q => ({ ledgers: [q.i + 1, q.j + 1], bothLabel: q.both, agree: q.agree,
                                       kappa: Number.isFinite(q.kappa) ? q.kappa : null })),
            classConfusions: s.confusions.map(c => ({ classes: [c.a, c.b], points: c.count })),
            confusionMatrices: matrices,
            labelTuples: tuples.map(({ t, count }) => ({ labels: Array.from(t, label), points: count }))
                .sort((x, y) => y.points - x.points),
        },
        mergePreview: {
            ...(problem ? { problem } : {}),
            decided: { byOneLedger: p.how.single, allAgree: p.how.agree, majority: p.how.majority,
                       topLedgerWins: p.how.priority, tieTopLedgerWins: p.how.tiePriority, tieToConflict: p.how.tieConflict },
            perLedger: inputs.map((_, i) => ({ priority: i + 1, kept: p.kept[i], overruled: p.overruled[i], toConflict: p.conflicted[i] })),
        },
        lastMerge: m ? {
            rule: laRuleText(m.rule),
            ledgers: m.inputCount,
            upToDate: m.key === laMergeKey(),
            clouds: [...m.clouds.keys()],
            entries: entries(m.summary),
            classes: sorted(m.summary.classes),
        } : null,
    };
}

// JSON indented by level, with anything short (a label tuple, a matrix row) kept on one line
function laStringify(value, indent = "") {
    const flat = JSON.stringify(value) ?? "null";
    if (value === null || typeof value !== "object" || flat.length + indent.length <= 100
        || (Array.isArray(value) && value.every(v => v === null || typeof v !== "object"))) return flat;
    const inner = indent + "  ";
    const items = Array.isArray(value)
        ? value.map(v => inner + laStringify(v, inner))
        : Object.entries(value).filter(([, v]) => v !== undefined)
            .map(([k, v]) => `${inner}${JSON.stringify(k)}: ${laStringify(v, inner)}`);
    const [open, close] = Array.isArray(value) ? ["[", "]"] : ["{", "}"];
    return `${open}\n${items.join(",\n")}\n${indent}${close}`;
}

// ══════════════════════════════════════════════════════════════
//  Actions
// ══════════════════════════════════════════════════════════════

// slot: where the panel shows it, under the list ("files"), Compare, Merge or Download
function laNotice(slot, kind, text) { _la.notices.push({ slot, kind, text }); }

function laFailed(slot, what, e) {
    if (e?.name === "AbortError") laNotice(slot, "info", `${what} cancelled.`);
    else {
        console.error(`[ledger analysis] ${what} failed:`, e);
        laNotice(slot, "error", `${what} failed: ${e?.message || e}`);
    }
}

// Runs `run(signal, progress)` with the panel showing progress in `slot`, offering Cancel unless
// `cancelable` is false.
async function laBusy(slot, label, run, cancelable = true) {
    const ctrl = new AbortController();
    const busy = _la.busy = { slot, label, cancel: cancelable ? () => ctrl.abort() : null };
    laRender();
    try {
        return await run(ctrl.signal, (text) => { busy.label = text; laRender(); });
    } finally {
        if (_la.busy === busy) _la.busy = null;
        laRender();
    }
}

function laPickFiles() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".csv,.gz,.ohl";
    input.multiple = true;
    input.addEventListener("change", () => laAddFiles([...input.files]));
    input.click();
}

async function laAddFiles(files) {
    if (!files.length || _la.busy) return;
    _la.notices = [];
    await laBusy("files", `Reading ${files.length} file${files.length === 1 ? "" : "s"}…`, async (signal) => {
        for (const file of files) {
            if (signal.aborted) break;
            try {
                const input = await laReadLedgerFile(file);
                const twin = _la.inputs.find(i => i.fingerprint === input.fingerprint);
                if (twin) {
                    laNotice("files", "warn", `${file.name} skipped: it has the same entries as ${twin.name} (${twin.fileName}).`);
                    continue;
                }
                if (input.summary.nodes === 0) laNotice("files", "warn", `${file.name} has no entries.`);
                _la.inputs.push({ id: _la.nextId++, ...input });
                _la.result = null;
            } catch (e) {
                console.error(`[ledger analysis] ${file.name}:`, e);
                laNotice("files", "error", `${file.name}: ${e.message}`);
            }
        }
    });
}

// Reordering keeps the Compare result: its tuples are keyed by input, and only the merge preview
// depends on the order. Adding or removing an input makes it stale.
function laMove(id, delta) {
    const i = _la.inputs.findIndex(x => x.id === id), j = i + delta;
    if (i === -1 || j < 0 || j >= _la.inputs.length) return;
    [_la.inputs[i], _la.inputs[j]] = [_la.inputs[j], _la.inputs[i]];
    laRender();
}

function laRemove(id) {
    if (_la.view?.id === id) laSetView(null);
    _la.inputs = _la.inputs.filter(x => x.id !== id);
    _la.result = null;
    _la.notices = [];
    laRender();
}

function laClear() {
    if (_la.view) laSetView(null);
    _la.inputs = [];
    _la.result = null;
    _la.merged = null;
    _la.notices = [];
    laRender();
}

function laSetRule(patch) {
    // A vote for class 0 means nothing while class 0 counts as no label, so each setting turns the other off
    if (patch.unlabeled === "background") patch = { ...patch, zero: "label" };
    if (patch.zero === "none") patch = { ...patch, unlabeled: "abstain" };
    Object.assign(_la.rule, patch);
    if ("zero" in patch || "unlabeled" in patch) laRecount();
    laRender();
}

function laEffectiveRule() {
    return { ..._la.rule, conflictClass: laConflictClass() };
}

function laConflictClass() {
    if (_la.rule.conflictClass !== null) return _la.rule.conflictClass;
    return laAutoConflictClass(_la.inputs, laClassTable(_la.inputs).table);
}

// Why the Conflict class can't be used, or null. Only matters when ties go to Conflict.
function laConflictProblem() {
    const rule = _la.rule;
    if (rule.mode !== "consensus" || rule.ties !== "conflict") return null;
    const v = laConflictClass();
    if (!Number.isInteger(v) || v < 0 || v > 255) return "The Conflict class must be a whole number from 0 to 255.";
    if (v === 0 && rule.zero === "none") return "Class 0 counts as no label, so it can't be the Conflict class.";
    return laConflictTaken(v, _la.inputs, laClassTable(_la.inputs).table);
}

// One row per cloud the ledgers name: is it in this scene, as a format Compare can read?
function laCloudRows() {
    const named = new Map();
    for (const input of _la.inputs) {
        for (const name of input.clouds.keys()) named.set(name, (named.get(name) || 0) + 1);
    }
    return [...named].map(([name, count]) => {
        const pc = viewer.scene.pointclouds.find(p => p.name === name);
        const format = pc && laCloudFormat(pc);
        const status = !pc ? "not in this scene" : format ?? "neither Potree 2.0 nor COPC, not supported yet";
        return { name, count, pc, ok: !!format, status };
    });
}

// The octree formats Compare can walk, by name; null for others (Potree 1.x, EPT)
function laCloudFormat(pc) {
    const geom = pc.pcoGeometry;
    if (geom?.loader?.metadata?.hierarchy) return "Potree 2.0";
    if (geom?.type === "copc" && geom.pages && window.Copc) return "COPC";
    return null;
}

function laDatasetNote() {
    const dois = [...new Set(_la.inputs.map(i => i.meta.doi).filter(Boolean))];
    if (dois.length > 1) return `These ledgers come from different datasets: ${dois.join(", ")}.`;
    if (dois.length === 1 && window.doi && dois[0] !== window.doi) {
        return `These ledgers were made on dataset ${dois[0]}; this page shows ${window.doi}.`;
    }
    return null;
}

function laCompareBlocker() {
    if (_la.inputs.length < 2) return "Add at least two ledgers to compare.";
    if (!laCloudRows().some(r => r.ok)) return "None of the ledgers' clouds is loaded here as Potree 2.0 or COPC.";
    return null;
}

function laDownloadBlocker() {
    if (_la.inputs.length < 2) return "Add at least two ledgers to merge.";
    return laConflictProblem();
}

function laMergeBlocker() {
    return laDownloadBlocker() || (laCloudRows().some(r => r.pc) ? null
        : "None of the ledgers' clouds is in this scene, so a merge has nothing to show. Download still saves it.");
}

// The inputs and settings a merge comes from, to tell when the one shown is out of date
function laMergeKey() {
    return JSON.stringify([_la.inputs.map(i => i.id), laRuleText(laEffectiveRule())]);
}

// The merge engine under `rule`: priority by list order, labels read as the rule says (laReadTuple)
function laMergeWith(inputs, rule, opts) {
    const rank = inputs.map((_, i) => i), zeroNone = rule.zero === "none";
    return laMergeEngine(inputs, (t) => laResolve(laReadTuple(t, rule), rank, rule)[0],
                         { ...opts, noneAs: zeroNone ? 0 : null });
}

// Fills the Compare result's tuples and stats: its histogram as the rule reads it
function laRecount() {
    const r = _la.result;
    if (!r) return;
    r.tuples = laReadTuples(r.raw, _la.rule);
    r.stats = laStats(r.tuples, r.inputIds.length);
}

// Benchmark samples (seconds) for the paper: window.__laTimes.compare / .merge; median in the console
function laRecordTime(kind, seconds) {
    ((window.__laTimes ??= {})[kind] ??= []).push(seconds);
}

async function laCompare() {
    if (_la.busy || laCompareBlocker()) return;
    const inputs = _la.inputs.slice();
    const clouds = laCloudRows().filter(r => r.ok).map(r => ({ name: r.name, pc: r.pc }));
    _la.notices = [];
    try {
        const t0 = performance.now();
        const out = await laBusy("compare", "Comparing…", (signal, onProgress) =>
            laCompareEngine(inputs, clouds, { signal, onProgress }));
        const raw = [];
        for (const [key, count] of out.hist) if (count > 0) raw.push({ t: laTupleFromKey(key), count });
        _la.result = {
            inputIds: inputs.map(i => i.id),
            clouds: clouds.map(c => c.name),
            raw,
            seconds: (performance.now() - t0) / 1000,
            notes: out.notes || [],
        };
        laRecordTime("compare", _la.result.seconds);
        laRecount();
        for (const note of _la.result.notes) laNotice("compare", "warn", note);
    } catch (e) {
        laFailed("compare", "Compare", e);
    }
    laRender();
}

// Merges the inputs and shows the result in the viewer in place of the brush's ledger
async function laMerge() {
    if (_la.busy || laMergeBlocker()) return;
    const inputs = _la.inputs.slice(), rule = laEffectiveRule(), key = laMergeKey();
    _la.notices = [];
    try {
        const t0 = performance.now();
        const clouds = await laBusy("merge", "Merging…", (signal, onProgress) =>
            laMergeWith(inputs, rule, { signal, onProgress }));
        laRecordTime("merge", (performance.now() - t0) / 1000);
        _la.merged = { id: _la.nextId++, clouds, key, rule, inputCount: inputs.length,
                       summary: laSummarize(clouds), table: laMergedClassTable(clouds, inputs, rule) };
    } catch (e) {
        laFailed("merge", "Merging", e);
        laRender();
        return;
    }
    await laSetView(_la.merged.id);
}

async function laDownload() {
    if (_la.busy || laDownloadBlocker()) return;
    const inputs = _la.inputs.slice();
    const rule = laEffectiveRule();
    _la.notices = [];
    try {
        const merged = await laBusy("download", "Merging…", (signal, onProgress) =>
            laMergeWith(inputs, rule, { signal, onProgress }));
        const fileName = laMergedFileName(merged, inputs, rule);
        await laSaveGzip(laEncodeLedger(merged, laMergedHeader(merged, inputs, rule)), fileName);
        laNotice("download", "info", `Downloaded ${fileName}.`);
    } catch (e) {
        laFailed("download", "Merging", e);
    }
    laRender();
}

function laExportAnalysis() {
    if (_la.busy || !_la.result) return;
    try {
        const fileName = laFileName([..._la.result.clouds, laTiles(_la.inputs).join("_"), "ledger_analysis"], ".json");
        laSaveBlob(new Blob([laStringify(laAnalysisReport()) + "\n"], { type: "application/json" }), fileName);
        const text = `Downloaded ${fileName}.`;
        _la.notices = _la.notices.filter(x => x.text !== text);   // once, however often it's exported
        laNotice("compare", "info", text);
    } catch (e) {
        laFailed("compare", "Export", e);
    }
    laRender();
}

// ══════════════════════════════════════════════════════════════
//  Viewing a ledger
//
//  View shows one input, or the last merge, in the viewer in place of the ledger the brush holds.
//  The brush's own entries (brushEdits: one Map per cloud) are set aside, the shown ledger's put
//  in, and every cloud either names is flushed: its loaded nodes are read from the dataset again,
//  so no buffer keeps a class the outgoing ledger painted, and the brush's onNodeLoaded hook paints
//  the incoming ledger onto each node as it arrives. Stopping puts the set-aside Maps back, the
//  same objects, and flushes again. The contributor name and the scene are left as they are, and
//  so is the class list, except while a merge is shown (laShowClasses).
//
//  Brush strokes and imports made while viewing go into the view's entries, and are dropped with
//  them; Export saves them.
// ══════════════════════════════════════════════════════════════

/** One cloud of a parsed ledger as brushEdits entries: what Import builds from the same file. */
function laBrushEntries(nodes) {
    const pcEdits = new Map();
    for (const [name, e] of nodes) {
        let overrides = null;
        if (e.runs) {
            overrides = new LedgerOverrides();
            for (let k = 0; k < e.runs.length; k += 3) {
                const cls = e.runs[k + 2];
                for (let p = e.runs[k]; p < e.runs[k + 1]; p++) overrides.set(p, cls);
            }
        }
        if (e.all !== LA_NONE) {
            pcEdits.set(name, overrides ? { all: true, classification: e.all, overrides }
                                        : { all: true, classification: e.all });
        } else if (overrides) {
            pcEdits.set(name, overrides);
        }
    }
    return pcEdits;
}

// Shows input `id` in place of the brush's ledger, or with null gives the brush its own back.
// Switches run one at a time, in the order asked for.
function laSetView(id) {
    _la.viewChain = _la.viewChain.then(() => laSwitchView(id));
    return _la.viewChain;
}

async function laSwitchView(id) {
    const input = id === null ? null : laViewable(id);
    if (id !== null && !input) return;                       // removed or merged again while waiting its turn
    if (input ? _la.view?.id === id : !_la.view) return;      // already so

    // A merge's progress shows by the Merge button, an input's under the list
    const merge = !!_la.merged && (input ? input === _la.merged : _la.view.id === _la.merged.id);
    const slot = merge ? "merge" : "files";
    const label = input ? `Loading ${merge ? "the merged ledger" : laDisplayNames().get(id)}…` : "Restoring your ledger…";
    try {
        await laBusy(slot, label, async (_, onProgress) => {
            // A stroke keeps the entries it started with, so it has to finish first
            if (brushState.strokeInProgress) {
                onProgress("Waiting for the brush stroke to finish…");
                while (brushState.strokeInProgress) await new Promise(r => setTimeout(r, 50));
                onProgress(label);
            }
            await new Promise(r => requestAnimationFrame(() => setTimeout(r, 0)));   // show the label first

            const incoming = input ? [...input.clouds].map(([pc, nodes]) => [pc, laBrushEntries(nodes)])
                                   : [..._la.view.saved];
            const flush = new Set([...brushEdits.keys(), ...incoming.map(([pc]) => pc)]);
            if (!_la.view) _la.view = { id: null, saved: new Map(brushEdits) };
            brushEdits.clear();
            for (const [pc, edits] of incoming) brushEdits.set(pc, edits);
            _la.view = input ? { ..._la.view, id } : null;
            laShowClasses(input);
            laRender();

            await Promise.all(viewer.scene.pointclouds.filter(pc => flush.has(pc.name)).map(laFlushCloud));
        }, false);
    } catch (e) {
        laFailed(slot, input ? "Viewing" : "Restoring your ledger", e);
        laRender();
    }
}

// The input, or the last merge, with this id
function laViewable(id) {
    return _la.inputs.find(i => i.id === id) ?? (_la.merged?.id === id ? _la.merged : null);
}

/**
 * While a merge is shown, the classes it uses that the session doesn't list (Conflict, usually)
 * are listed too, so they draw in their own colours and get a checkbox; otherwise they'd draw as
 * class k % 32 or DEFAULT. Whatever an earlier merge view added is taken out first, so the list
 * is as it was once no merge is shown. Only those entries: a list Import replaced meanwhile stays.
 */
function laShowClasses(shown) {
    const added = _la.viewClasses;
    _la.viewClasses = [];
    if (shown === _la.merged && shown) {
        const listed = new Set(CLASSIFICATIONS.map(c => c.value));
        for (const value of [...laClassesUsed(shown.clouds)].sort((a, b) => a - b)) {
            if (listed.has(value)) continue;
            const c = shown.table.get(value) ?? { name: `Class ${value}`, color: "#cccccc" };
            _la.viewClasses.push({ value, name: c.name, color: c.color });
        }
    }
    if (!added.length && !_la.viewClasses.length) return;
    CLASSIFICATIONS = CLASSIFICATIONS.filter(c => !added.includes(c))
        .concat(_la.viewClasses).sort((a, b) => a.value - b.value);
    syncClassificationsToViewer();
    rebuildClassificationGridUI();
}

/**
 * Reads a cloud's loaded nodes from the dataset again, so their classification buffers hold the
 * file's classes with brushEdits as it is now on top, and nothing a ledger painted before. Every
 * node but the root is disposed as Potree's LRU disposes nodes: the viewer loads the visible ones
 * again and the brush's onNodeLoaded hook applies brushEdits as each arrives. Potree never
 * disposes a root (its tree node holds the cloud together), so the root is loaded again in place
 * and its scene node given the new geometry. A node still loading needs nothing: it applies
 * brushEdits when it lands.
 */
async function laFlushCloud(pc) {
    const root = pc.pcoGeometry?.root;
    if (!root) return;
    const loaded = [];
    (function walk(node) {
        for (const child of Object.values(node.children)) {
            if (!child) continue;
            if (child.loaded) loaded.push(child);
            walk(child);
        }
    })(root);
    for (const node of loaded) {
        Potree.lru.remove(node);
        node.dispose();
    }
    // Until the next frame rebuilds it, keep the visible list to nodes that still have geometry
    pc.visibleNodes = pc.visibleNodes.filter(n => n.geometryNode?.geometry);

    if (!root.loaded && !root.loading) return;     // never shown: nothing painted
    if (!root.loading) root.loaded = false;
    await waitForLoad(root);
    const sceneNode = pc.root?.isTreeNode?.() ? pc.root.sceneNode : null;
    if (sceneNode && sceneNode.geometry !== root.geometry) {
        const old = sceneNode.geometry;
        sceneNode.geometry = root.geometry;
        old.dispose();
    }
}

// ══════════════════════════════════════════════════════════════
//  Panel
// ══════════════════════════════════════════════════════════════

// laEl("div.la-row", { title, onclick, … }, ...children). Strings become text nodes, so names
// read from files can't inject markup.
function laEl(spec, props, ...children) {
    const [tag, ...classes] = spec.split(".");
    const el = document.createElement(tag || "div");
    if (classes.length) el.className = classes.join(" ");
    for (const [k, v] of Object.entries(props || {})) {
        if (v === undefined || v === null || v === false) continue;
        if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
        else if (k === "dataset") Object.assign(el.dataset, v);
        else if (k in el) el[k] = v;
        else el.setAttribute(k, v);
    }
    return laFill(el, ...children);
}

// Replaces el's children, skipping null, undefined and false (replaceChildren would print them).
function laFill(el, ...children) {
    el.replaceChildren(...children.flat(Infinity).filter(c => c !== null && c !== undefined && c !== false));
    return el;
}

const laFmt = (n) => Math.round(n).toLocaleString();
const laPct = (a, b) => (b > 0 ? `${(100 * a / b).toFixed(1)}%` : "—");

// Items joined by " · ", where a line can break only between items
const laJoin = (items) => items.map((item, k) =>
    [k ? " " : null, laEl("span.la-nowrap", null, k < items.length - 1 ? `${item} ·` : item)]);

function laDate(iso) {
    const d = new Date(iso);
    if (!iso || isNaN(d)) return "";
    const year = d.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined;
    return d.toLocaleString(undefined, { year, month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

// Names as the panel shows them: two ledgers by one contributor are told apart by tile or file.
function laDisplayNames() {
    const counts = new Map();
    for (const i of _la.inputs) counts.set(i.name, (counts.get(i.name) || 0) + 1);
    return new Map(_la.inputs.map(i => [i.id, counts.get(i.name) > 1
        ? `${i.name} (${i.meta.tile ? `tile ${i.meta.tile}` : i.fileName})` : i.name]));
}

function laSeg(key, options) {
    return laEl("div.la-seg", { role: "group" }, options.map(([value, label, title]) =>
        laEl("button", { type: "button", title, dataset: { value }, onclick: () => laSetRule({ [key]: value }) }, label)));
}

const laField = (label, control) =>
    laEl("div.la-field", null, laEl("span.la-field-label", null, label), control);

function openLedgerAnalysisPanel() {
    if (_la.panel) { laClosePanel(); return; }

    const ui = _la.ui = {};
    const panel = _la.panel = laEl("div", { id: "ledgerAnalysisPanel" });

    ui.addBtn   = laEl("button.la-link-btn", { type: "button", title: "Add ledger files", onclick: laPickFiles }, "+ Add…");
    ui.clearBtn = laEl("button.la-link-btn.la-danger", { type: "button", title: "Remove every ledger from this panel", onclick: laClear }, "Clear");
    ui.count    = laEl("span.la-count");
    ui.list     = laEl("div.la-list");
    ui.viewNote = laEl("div.la-notice.la-info");
    ui.clouds   = laEl("section.la-section");
    // Progress and notices, under the action they belong to
    ui.slots = { files: laEl("div.la-section"), compare: laEl("div.la-section"),
                 merge: laEl("div.la-section"), download: laEl("div.la-section") };

    ui.zero = laEl("button", {
        type: "button",
        title: "On: a label of class 0 counts as none: it doesn't vote, and a point labeled only 0 counts as unlabeled. " +
               "Off: class 0 (Never Classified) is a label like any other.",
        onclick: () => laSetRule({ zero: _la.rule.zero === "none" ? "label" : "none" }),
    }, "Treat class 0 as No Label");
    ui.unlabeled = laEl("button", {
        type: "button",
        title: "On: where any ledger labels a point, a ledger that leaves it unlabeled votes for class 0, " +
               "so a class that only one ledger painted can be outvoted. Use it only when every ledger covers " +
               "the same area, such as each contributor's whole-area ledger, not for tile ledgers, whose " +
               "unlabeled points can lie outside their tile. Turns off Treat class 0 as No Label. " +
               "Off: a ledger without a label for a point doesn't vote on it.",
        onclick: () => laSetRule({ unlabeled: _la.rule.unlabeled === "background" ? "abstain" : "background" }),
    }, "Unlabeled votes as class 0");
    ui.compareBtn  = laEl("button.brush-action-btn.brush-btn-primary", { type: "button", onclick: laCompare }, "Compare");
    ui.compareHint = laEl("div.la-hint.la-center");
    ui.results     = laEl("section.la-section");

    ui.mode = laSeg("mode", [
        ["consensus", "Consensus", "Majority vote among the ledgers that label a point"],
        ["priority",  "Priority",  "The highest ledger in the list that labels a point wins"],
    ]);
    ui.ties = laSeg("ties", [
        ["conflict", "Conflict",       "Ties get the Conflict class, to adjudicate"],
        ["priority", "Priority order", "Ties go to the class of the highest ledger in the list"],
    ]);
    ui.tiesField = laField("Ties", ui.ties);
    ui.conflictInput = laEl("input", {
        type: "number", min: "0", max: "255", step: "1", title: "Class value written for ties",
        oninput: () => {
            const raw = ui.conflictInput.value.trim();
            _la.rule.conflictClass = raw === "" ? null : Number(raw);
            laRender();
        },
        onblur: () => laRender(),
    });
    ui.conflictField = laField("Conflict class", laEl("div.la-conflict", null,
        ui.conflictInput,
        laEl("span.la-swatch", { style: `background:${LA_CONFLICT_COLOR}` }),
        laEl("span.la-conflict-name", null, LA_CONFLICT_NAME)));
    ui.conflictHint = laEl("div.la-hint");
    ui.priorityHint = laEl("div.la-hint", null, "Priority follows the list order: the ledger at the top wins.");
    ui.preview      = laEl("div.la-section");

    ui.mergeBtn     = laEl("button.brush-action-btn.brush-btn-primary", { type: "button", onclick: laMerge,
                           title: "Merge the ledgers and show the result in the viewer in place of your ledger" }, "Merge");
    ui.mergeHint    = laEl("div.la-hint.la-center");
    ui.merged       = laEl("div.la-section");
    ui.downloadBtn  = laEl("button.brush-action-btn.brush-btn-success", { type: "button", onclick: laDownload }, "Download merged ledger");
    ui.downloadHint = laEl("div.la-hint.la-center");

    panel.append(
        laEl("div.brush-header", null,
            laEl("span.brush-title", null, "Ledger Analysis"),
            laEl("button.brush-close", { type: "button", title: "Close", onclick: laClosePanel }, "×")),
        laEl("div.la-intro", null,
            "Compares ledger files point by point and merges them into a new ledger file. " +
            "View shows one of them in place of the ledger you are painting, which comes back when you stop viewing."),
        laEl("section.la-section", null,
            laEl("div.la-section-head", null,
                laEl("span.brush-label", null, "Ledgers"), ui.count,
                laEl("div.la-head-actions", null, ui.addBtn, ui.clearBtn)),
            ui.list, ui.viewNote, ui.slots.files),
        ui.clouds,
        laEl("div.la-section", null, laEl("div.la-seg", null, ui.zero, ui.unlabeled), ui.compareBtn, ui.compareHint, ui.slots.compare),
        ui.results,
        laEl("div.brush-divider"),
        laEl("section.la-section", null,
            laEl("span.brush-label", null, "Merge"),
            laField("Mode", ui.mode), ui.tiesField, ui.conflictField, ui.conflictHint, ui.priorityHint,
            ui.preview),
        laEl("div.la-section", null,
            ui.mergeBtn, ui.mergeHint, ui.slots.merge, ui.merged,
            ui.downloadBtn, ui.downloadHint, ui.slots.download,
            laEl("div.la-hint", null,
                "Merge shows the merged ledger in the viewer in place of yours, and Download saves it as a file. " +
                "To adjudicate, Merge, hide every class except Conflict, brush over the conflicts, and save with the brush panel's Export.")));

    // Ledger files can be dropped anywhere on the panel. A file drag is always taken, busy or not:
    // left alone, the browser would open a dropped .csv in place of the viewer.
    const isFileDrag = (e) => !!e.dataTransfer?.types?.includes("Files");
    panel.addEventListener("dragover", (e) => {
        if (!isFileDrag(e)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = _la.busy ? "none" : "copy";
        ui.list.classList.toggle("la-dropping", !_la.busy);
    });
    panel.addEventListener("dragleave", (e) => {
        if (!panel.contains(e.relatedTarget)) ui.list.classList.remove("la-dropping");
    });
    panel.addEventListener("drop", (e) => {
        if (!isFileDrag(e)) return;
        e.preventDefault();
        ui.list.classList.remove("la-dropping");
        laAddFiles([...e.dataTransfer.files]);   // ignored while busy
    });

    document.body.appendChild(panel);
    requestAnimationFrame(() => panel.classList.add("open"));
    viewer.scene.addEventListener("pointcloud_added", laRender);
    laRender();
}

function laClosePanel() {
    const panel = _la.panel;
    if (!panel) return;
    _la.busy?.cancel?.();
    laSetView(null);       // closing the panel gives the brush its own ledger back
    viewer.scene.removeEventListener("pointcloud_added", laRender);
    _la.panel = _la.ui = null;
    panel.classList.remove("open");
    setTimeout(() => panel.remove(), 300);
}

function laRender() {
    if (!_la.panel) return;
    laRenderLedgers();
    laRenderClouds();
    laRenderActions();
    laRenderResults();
    laRenderMerge();
    laRenderMerged();
    laRenderSlots();
}

function laRenderSlots() {
    for (const [slot, box] of Object.entries(_la.ui.slots)) {
        const busy = _la.busy?.slot === slot ? _la.busy : null;
        laFill(box,
            busy && laEl("div.la-progress", null,
                laEl("div.brush-stroke-spinner"),
                laEl("span", null, busy.label),
                busy.cancel && laEl("button.la-link-btn", { type: "button", onclick: () => busy.cancel() }, "Cancel")),
            _la.notices.filter(n => n.slot === slot).map(n => laEl(`div.la-notice.la-${n.kind}`, null, n.text)));
        box.hidden = box.childElementCount === 0;
    }
}

// Tuple position of each input in the last Compare, by input id
function laResultPositions() {
    return new Map((_la.result?.inputIds || []).map((id, pos) => [id, pos]));
}

function laRenderLedgers() {
    const ui = _la.ui, n = _la.inputs.length, busy = !!_la.busy;
    ui.count.textContent = n ? String(n) : "";
    ui.addBtn.disabled = busy;
    ui.clearBtn.disabled = busy;
    ui.clearBtn.hidden = n === 0;

    const viewed = _la.inputs.find(x => x.id === _la.view?.id);
    ui.viewNote.hidden = !viewed;
    if (viewed) {
        laFill(ui.viewNote, "Showing ", laEl("strong", null, laDisplayNames().get(viewed.id)),
            " in place of your ledger. Press View again or close this panel to get yours back. " +
            "Brush strokes and imports made meanwhile go into the view and are dropped with it.");
    }

    if (n === 0) {
        laFill(ui.list, laEl("div.la-empty", null,
            "Drop ledger files here or use ", laEl("b", null, "+ Add…"), ".", laEl("br"),
            "Potree-only exports (.gz) or older .csv files, two or more."));
        return;
    }
    const names = laDisplayNames(), pos = laResultPositions(), stats = _la.result?.stats;
    laFill(ui.list, _la.inputs.map((input, i) => {
        const s = input.summary, p = pos.get(input.id);
        const about = [input.meta.contributor ? input.fileName : null,
                       input.meta.tile ? `tile ${input.meta.tile}` : null,
                       laDate(input.meta.generated)].filter(Boolean).join(" · ");
        const counts = [`${laFmt(s.nodes)} node${s.nodes === 1 ? "" : "s"}`, `${laFmt(s.bulk)} bulk`, `${laFmt(s.points)} per-point`];
        if (s.clouds > 1) counts.unshift(`${s.clouds} clouds`);
        const viewing = _la.view?.id === input.id;
        const inScene = [...input.clouds.keys()].some(name => viewer.scene.pointclouds.some(pc => pc.name === name));
        return laEl(`div.la-row${viewing ? ".la-viewing" : ""}`, null,
            laEl("span.la-rank", { title: "Priority" }, String(i + 1)),
            laEl("div.la-row-main", null,
                laEl("span.la-name", { title: input.fileName }, names.get(input.id)),
                about && laEl("span.la-sub", { title: about }, about),
                laEl("span.la-sub.la-wrap", { title: "bulk: #all entries, each covering a node's whole subtree; per-point: single overrides" },
                    laJoin(counts)),
                stats && p !== undefined && laEl("span.la-sub", null,
                    "labels ", laEl("strong", null, `${laFmt(stats.labeled[p])} points`))),
            laEl("span.la-controls", null,
                laEl("button.la-view-btn", {
                    type: "button", "aria-pressed": String(viewing), disabled: busy || (!inScene && !viewing),
                    title: viewing ? "Stop viewing and give the brush its own ledger back"
                         : inScene ? "Show this ledger in the viewer in place of yours"
                         : "None of its clouds is in this scene",
                    onclick: () => laSetView(viewing ? null : input.id),
                }, "View"),
                laEl("button.la-icon-btn", { type: "button", title: "Raise priority", disabled: busy || i === 0, onclick: () => laMove(input.id, -1) }, "↑"),
                laEl("button.la-icon-btn", { type: "button", title: "Lower priority", disabled: busy || i === n - 1, onclick: () => laMove(input.id, 1) }, "↓"),
                laEl("button.la-icon-btn.la-remove", { type: "button", title: "Remove", disabled: busy, onclick: () => laRemove(input.id) }, "×")));
    }));
}

function laRenderClouds() {
    const rows = laCloudRows(), n = _la.inputs.length;
    const note = laDatasetNote();
    const { clashes, table } = laClassTable(_la.inputs);
    _la.ui.clouds.hidden = rows.length === 0;
    laFill(_la.ui.clouds,
        laEl("span.brush-label", null, "Clouds"),
        ...rows.map(r => laEl("div.la-cloud", { title: r.name },
            laEl(`span.la-dot${r.ok ? "" : ".la-warn"}`),
            laEl("span.la-cloud-name", null, r.name),
            laEl(`span.la-cloud-status${r.ok ? "" : ".la-warn"}`, null, `${r.count} of ${n} ledgers · ${r.status}`))),
        note ? laEl("div.la-hint.la-warn", null, note) : null,
        clashes.length ? laEl("div.la-hint.la-warn", null,
            `The ledgers name ${clashes.length === 1 ? "class" : "classes"} ${clashes.join(", ")} differently; ` +
            `the merge keeps ${clashes.map(v => `“${laClassName(v, table)}”`).join(", ")} from the highest ledger.`) : null);
}

function laRenderActions() {
    const ui = _la.ui, busy = !!_la.busy;
    const compareWhy = laCompareBlocker(), downloadWhy = laDownloadBlocker(), mergeWhy = laMergeBlocker();

    ui.compareBtn.disabled = busy || !!compareWhy;
    const skipped = laCloudRows().filter(r => !r.ok).map(r => r.name);
    ui.compareHint.textContent = busy ? "" : compareWhy
        || (skipped.length ? `Compare skips ${skipped.join(", ")}.` : "");
    ui.compareHint.hidden = !ui.compareHint.textContent;

    ui.mergeBtn.disabled = busy || !!mergeWhy;
    ui.mergeHint.textContent = busy ? "" : mergeWhy || "";
    ui.mergeHint.hidden = !ui.mergeHint.textContent;

    ui.downloadBtn.disabled = busy || !!downloadWhy;
    // When both are blocked for one reason, the Merge button's hint already says it
    ui.downloadHint.textContent = busy || downloadWhy === mergeWhy ? "" : downloadWhy || "";
    ui.downloadHint.hidden = !ui.downloadHint.textContent;
}

function laRenderResults() {
    const box = _la.ui.results, r = _la.result;
    box.hidden = !r;
    if (!r) { laFill(box); return; }

    const s = r.stats;
    const byId = new Map(_la.inputs.map(i => [i.id, i]));
    const names = laDisplayNames();
    const { table } = laClassTable(_la.inputs);
    const who = (pos) => {
        const id = r.inputIds[pos];
        return [laEl("span.la-badge", null, String(_la.inputs.indexOf(byId.get(id)) + 1)), names.get(id)];
    };
    const row = (label, value, pct, indent) => laEl("tr", null,
        laEl(`td.la-name-cell${indent ? `.la-indent${indent}` : ""}`, null, label),
        laEl("td.la-num", null, laFmt(value)),
        laEl("td.la-pct", null, pct ?? ""));

    const parts = [
        laEl("div.la-section-head", null,
            laEl("span.brush-label", null, "Agreement"),
            laEl("div.la-head-actions", null,
                laEl("button.la-link-btn", {
                    type: "button", disabled: !!_la.busy, onclick: laExportAnalysis,
                    title: "Save this analysis as a JSON file: every statistic, every pair's confusion matrix, " +
                           "the label histogram they come from, and the merge preview",
                }, "Export JSON"))),
        laEl("table.la-table", null, laEl("tbody", null,
            row("Points labeled", s.any),
            row("by one ledger only", s.byOne, laPct(s.byOne, s.any), 1),
            row("by two or more", s.byMany, laPct(s.byMany, s.any), 1),
            row("all agree", s.agree, laPct(s.agree, s.byMany), 2),
            row("disagree", s.disagree, laPct(s.disagree, s.byMany), 2))),
    ];

    const PAIRS_SHOWN = 8;
    parts.push(laEl("div.la-subhead", null, "Pairs, on the points both label"));
    if (s.pairs.length === 0) {
        parts.push(laEl("div.la-hint", null, "No two ledgers label the same points."));
    } else {
        parts.push(laEl("table.la-table", null,
            laEl("thead", null, laEl("tr", null,
                laEl("th", null, ""), laEl("th.la-num", null, "points"),
                laEl("th.la-num", null, "agree"), laEl("th.la-num", { title: "Cohen's kappa: agreement corrected for chance" }, "κ"))),
            laEl("tbody", null, s.pairs.slice(0, PAIRS_SHOWN).map(p => laEl("tr", null,
                laEl("td.la-name-cell", null, who(p.i), " ↔ ", who(p.j)),
                laEl("td.la-num", null, laFmt(p.both)),
                laEl("td.la-num", null, laPct(p.agree, p.both)),
                laEl("td.la-num", null, Number.isFinite(p.kappa) ? p.kappa.toFixed(2) : "—"))))));
        if (s.pairs.length > PAIRS_SHOWN) {
            parts.push(laEl("div.la-hint", null, `${s.pairs.length - PAIRS_SHOWN} more pairs overlap less.`));
        }
    }

    parts.push(laMatrixView(r, table));

    if (s.confusions.length) {
        parts.push(laEl("div.la-subhead", null, "Most disagreed classes"));
        parts.push(laEl("table.la-table", null, laEl("tbody", null, s.confusions.slice(0, 5).map(c => laEl("tr", null,
            laEl("td.la-name-cell", null, `${laClassName(c.a, table)} ↔ ${laClassName(c.b, table)}`),
            laEl("td.la-num", null, laFmt(c.count)))))));
    }
    const took = r.seconds === undefined ? ""
        : r.seconds < 0.1 ? " in under 0.1 s"
        : ` in ${r.seconds < 10 ? r.seconds.toFixed(1) : Math.round(r.seconds)} s`;
    parts.push(laEl("div.la-hint", null, `Compared ${r.clouds.join(", ")}${took}.`));
    laFill(box, parts);
}

// Sequential blue, steps 600 → 100 of the dataviz reference ramp, anchored dark for the panel:
// the smallest counts sit nearest the surface, the largest are lightest. Checked with the ramp
// validator against the panel surface (monotone, ΔL ≥ 0.06 between steps, darkest step 2.2:1),
// and each step carries the in-cell ink that reads best on it by APCA.
const LA_HEAT     = ["#184f95", "#256abf", "#3987e5", "#6da7ec", "#9ec5f4", "#cde2fb"];
const LA_HEAT_INK = ["#ffffff", "#ffffff", "#ffffff", "#0b0b0b", "#0b0b0b", "#0b0b0b"];
// At most three digits and one decimal, "173K" or "4.8K", so a row of cells fits the panel
const laCompact = new Intl.NumberFormat(undefined, {
    notation: "compact", maximumFractionDigits: 1, maximumSignificantDigits: 3, roundingPriority: "lessPrecision",
}).format;

/**
 * The confusion matrix of one pair of ledgers, rows the first and columns the second, with
 * "none" for points one labels and the other doesn't. Cells are shaded on a log scale, since
 * agreement usually outnumbers disagreement by orders of magnitude, and carry their counts;
 * hovering or focusing a cell spells it out underneath. With more than two ledgers a picker
 * chooses the pair, the one with the most overlap first.
 */
function laMatrixView(r, table) {
    const n = r.inputIds.length, names = laDisplayNames();
    const rank = (pos) => _la.inputs.findIndex(i => i.id === r.inputIds[pos]) + 1;
    const who  = (pos) => [laEl("span.la-badge", null, String(rank(pos))), names.get(r.inputIds[pos])];
    const overlap = new Map(r.stats.pairs.map(p => [`${p.i},${p.j}`, p.both]));
    const pairs = [];
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) pairs.push([i, j]);
    pairs.sort((x, y) => (overlap.get(y.join(",")) || 0) - (overlap.get(x.join(",")) || 0));
    let [a, b] = (_la.matrixPair || []).map(id => r.inputIds.indexOf(id));
    if (!(a >= 0 && b >= 0)) [a, b] = pairs[0];

    const box = laEl("div.la-section", null, laEl("div.la-subhead", null, "Confusion matrix"));
    if (n > 2) {
        const pick = laEl("select.brush-select.la-pair", {
            title: "Pair of ledgers",
            onchange: () => {
                const [i, j] = pick.value.split(",").map(Number);
                _la.matrixPair = [r.inputIds[i], r.inputIds[j]];
                laRenderResults();
            },
        }, pairs.map(([i, j]) => laEl("option", { value: `${i},${j}` },
            `${rank(i)} ${names.get(r.inputIds[i])} ↔ ${rank(j)} ${names.get(r.inputIds[j])} · ${laFmt(overlap.get(`${i},${j}`) || 0)} shared`)));
        pick.value = `${a},${b}`;
        box.append(pick);
    }

    const m = laConfusion(r.tuples, a, b);
    if (m.total === 0) {
        box.append(laEl("div.la-hint", null, "These two label no points in the compared clouds."));
        return box;
    }
    const counts = [];
    for (const x of m.axis) for (const y of m.axis) if (m.count(x, y)) counts.push(m.count(x, y));
    const lo = Math.min(...counts), hi = Math.max(...counts);
    const shade = (v) => hi > lo
        ? Math.min(LA_HEAT.length - 1, Math.floor(Math.log(v / lo) / Math.log(hi / lo) * LA_HEAT.length))
        : LA_HEAT.length - 1;
    const said = (c) => c === LA_NONE ? "has no label" : `says ${laClassName(c, table)}`;
    const classLabel = (c, short) => c === LA_NONE
        ? laEl("span.la-none", null, short ? "–" : "none")
        : [laEl("span.la-axis-swatch", { style: `background:${table.get(c)?.color ?? "#cccccc"}` }),
           short ? String(c) : laClassName(c, table)];
    const axisTitle = (c) => c === LA_NONE ? "no label" : `${c} · ${laClassName(c, table)}`;

    const readout = laEl("div.la-readout");
    const idle = () => laFill(readout, "Rows: ", who(a), ". Columns: ", who(b), ". Hover or focus a cell for its count.");
    const cell = (x, y) => {
        if (x === LA_NONE && y === LA_NONE) return laEl("td");
        const v = m.count(x, y);
        if (!v) return laEl("td.la-zero");
        const k = shade(v);
        const show = () => laFill(readout, laEl("strong", null, `${laFmt(v)} points`), ` (${laPct(v, m.total)}): `,
            who(a), ` ${said(x)}, `, who(b), ` ${said(y)}.`);
        return laEl("td.la-cell", { tabIndex: 0, style: `background:${LA_HEAT[k]};color:${LA_HEAT_INK[k]}`,
                                    onpointerenter: show, onfocus: show }, laCompact(v));
    };
    const grid = laEl("table.la-matrix", {
        onpointerleave: idle,
        onfocusout: (e) => { if (!grid.contains(e.relatedTarget)) idle(); },
    },
        laEl("thead", null, laEl("tr", null, laEl("th"),
            m.axis.map(y => laEl("th", { title: axisTitle(y) }, classLabel(y, true))))),
        laEl("tbody", null, m.axis.map(x => laEl("tr", null,
            laEl("th", { title: axisTitle(x) }, classLabel(x, false)),
            m.axis.map(y => cell(x, y))))));
    idle();
    box.append(laEl("div.la-matrix-wrap", null, grid), readout,
        laEl("div.la-scale", null, laCompact(lo), LA_HEAT.map(c => laEl("i", { style: `background:${c}` })),
            `${laCompact(hi)} points per cell, log scale`));
    return box;
}

function laRenderMerge() {
    const ui = _la.ui, rule = _la.rule;
    for (const [seg, key] of [[ui.mode, "mode"], [ui.ties, "ties"]]) {
        for (const b of seg.children) b.setAttribute("aria-pressed", String(b.dataset.value === rule[key]));
    }
    ui.zero.setAttribute("aria-pressed", String(rule.zero === "none"));
    ui.unlabeled.setAttribute("aria-pressed", String(rule.unlabeled === "background"));
    const toConflict = rule.mode === "consensus" && rule.ties === "conflict";
    ui.tiesField.hidden = rule.mode !== "consensus";
    ui.conflictField.hidden = ui.conflictHint.hidden = !toConflict;
    ui.priorityHint.hidden = toConflict;
    if (toConflict) {
        const value = laConflictClass(), problem = laConflictProblem();
        if (document.activeElement !== ui.conflictInput) ui.conflictInput.value = Number.isFinite(value) ? String(value) : "";
        ui.conflictInput.classList.toggle("la-invalid", !!problem);
        ui.conflictHint.classList.toggle("la-error", !!problem);
        ui.conflictHint.textContent = problem
            || `Ties are written as class ${value} and listed as “${LA_CONFLICT_NAME}”.`;
    }
    laRenderPreview();
}

// The last merge, under the Merge button: what it was made from, and View to show or stop showing it
function laRenderMerged() {
    const ui = _la.ui, m = _la.merged;
    ui.merged.hidden = !m;
    if (!m) { laFill(ui.merged); return; }
    const viewing = _la.view?.id === m.id, busy = !!_la.busy;
    const inScene = [...m.clouds.keys()].some(name => viewer.scene.pointclouds.some(pc => pc.name === name));
    const s = m.summary;
    const counts = [`${laFmt(s.nodes)} node${s.nodes === 1 ? "" : "s"}`, `${laFmt(s.bulk)} bulk`, `${laFmt(s.points)} per-point`];
    if (s.clouds > 1) counts.unshift(`${s.clouds} clouds`);
    laFill(ui.merged,
        laEl(`div.la-row${viewing ? ".la-viewing" : ""}`, null,
            laEl("div.la-row-main", null,
                laEl("span.la-name", null, "Merged ledger"),
                laEl("span.la-sub.la-wrap", null, `${m.inputCount} ledgers · ${laRuleText(m.rule)}`),
                laEl("span.la-sub.la-wrap", { title: "bulk: #all entries, each covering a node's whole subtree; per-point: single overrides" },
                    laJoin(counts)),
                m.key !== laMergeKey() && laEl("span.la-sub.la-wrap.la-warn", null,
                    "The ledgers or settings have changed since. Merge again to update it.")),
            laEl("span.la-controls", null,
                laEl("button.la-view-btn", {
                    type: "button", "aria-pressed": String(viewing), disabled: busy || (!inScene && !viewing),
                    title: viewing ? "Stop viewing and give the brush its own ledger back"
                         : inScene ? "Show the merged ledger in the viewer in place of yours"
                         : "None of its clouds is in this scene",
                    onclick: () => laSetView(viewing ? null : m.id),
                }, "View"))),
        viewing && laEl("div.la-notice.la-info", null,
            "Showing the merged ledger in place of yours. Press View again or close this panel to get yours back. " +
            "Brush strokes and imports made meanwhile go into it and are dropped with it; the brush panel's Export saves them."));
}

function laRenderPreview() {
    const box = _la.ui.preview, r = _la.result;
    if (!r) {
        laFill(box, laEl("div.la-hint", null, "Compare first to preview what the merge decides."));
        return;
    }
    const rule = laEffectiveRule(), n = r.inputIds.length;
    const rank = r.inputIds.map(id => _la.inputs.findIndex(i => i.id === id));
    const p = laPreview(r.tuples, rank, rule, n);
    const names = laDisplayNames();
    const toConflict = rule.mode === "consensus" && rule.ties === "conflict";

    const labels = [
        ["single",      "Labeled by one ledger"],
        ["agree",       "All labelers agree"],
        ["majority",    "Majority wins"],
        ["priority",    "Disagree, top ledger wins"],
        ["tiePriority", "Tie, top ledger wins"],
        ["tieConflict", `Tie → ${LA_CONFLICT_NAME} (class ${rule.conflictClass})`],
    ];
    const total = Object.values(p.how).reduce((a, b) => a + b, 0);
    const decided = labels.filter(([k]) => p.how[k] > 0 || (k === "tieConflict" && toConflict));

    laFill(box,
        laEl("div.la-subhead", null, "Preview"),
        laEl("table.la-table", null, laEl("tbody", null, decided.map(([k, label]) => laEl("tr", null,
            laEl(`td.la-name-cell${k === "tieConflict" ? ".la-strong" : ""}`, null, label),
            laEl("td.la-num", null, laFmt(p.how[k])),
            laEl("td.la-pct", null, laPct(p.how[k], total)))))),
        laEl("table.la-table", null,
            laEl("thead", null, laEl("tr", null,
                laEl("th", null, "Per ledger"), laEl("th.la-num", null, "kept"), laEl("th.la-num", null, "overruled"),
                toConflict ? laEl("th.la-num", null, "to Conflict") : null)),
            laEl("tbody", null, _la.inputs.map((input, i) => {
                const pos = r.inputIds.indexOf(input.id);
                const labeled = p.kept[pos] + p.overruled[pos] + p.conflicted[pos];
                return laEl("tr", null,
                    laEl("td.la-name-cell", null, laEl("span.la-badge", null, String(i + 1)), names.get(input.id)),
                    laEl("td.la-num", null, laPct(p.kept[pos], labeled)),
                    laEl("td.la-num", null, laFmt(p.overruled[pos])),
                    toConflict ? laEl("td.la-num", null, laFmt(p.conflicted[pos])) : null);
            }))));
}