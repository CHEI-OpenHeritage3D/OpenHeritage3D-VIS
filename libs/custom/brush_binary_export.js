/**
 * brush_binary_export.js
 *
 * Binary ledger serialization for the Classification Brush.
 * Drop-in alongside brush_panel.js — uses the same brushEdits ledger,
 * isAllEntry/getOverrides helpers, and mergeNodeEdit merge semantics.
 *
 * Container layout
 * ────────────────
 *   <text header>\n
 *   <binary body>
 * ...with the whole thing gzipped via CompressionStream.
 *
 *   #FORMAT,browser-binary-v1
 *   #METADATA … #END_METADATA           (same block as the CSV export)
 *   #CLASSIFICATIONS … #END_CLASSIFICATIONS   (only when custom)
 *   #CLASSMAP,0,64,65,66,67,68,69       (slot i holds class id i+1; 0 = no edit)
 *   #BINARY,<byteLength>
 *
 * Body (little-endian)
 * ────────────────────
 *   u32                       pointcloud count
 *   per pointcloud:
 *     u16 + utf8              name
 *     u32                     node count
 *     per node:
 *       u8 + ascii            node name ("r", "r0", "r034"…)
 *       u8                    flags: bit0 = has #all baseline, bit1 = has runs
 *       [u8]                  baseline class id      (if bit0)
 *       [u32 + bytes]         run stream byte length (if bit1)
 *
 *   Run stream: repeating (u8 classId, varint runLength).
 *   classId 0 means "no override" — a gap. Cursor advances by runLength.
 *   Sum of run lengths == maxPIndex + 1 for that node. The decoder needs
 *   nothing from the octree hierarchy.
 */

const BRUSH_BINARY_MAGIC = "#FORMAT,browser-binary-v1";

// ── varint ───────────────────────────────────────────────────

function _writeVarint(out, v) {
    while (v >= 0x80) { out.push((v & 0x7f) | 0x80); v >>>= 7; }
    out.push(v);
}

// ── Growable byte sink ───────────────────────────────────────
// Plain arrays of small ints are fine here; the body is ~2 MB for a
// 12.8M-override ledger, so a single Uint8Array.from() at the end is cheap.

class ByteSink {
    constructor() { this.parts = []; this.cur = []; this.len = 0; }
    push(b) { this.cur.push(b); if (this.cur.length >= 1 << 16) this._seal(); }
    pushBytes(arr) { this._seal(); this.parts.push(arr); this.len += arr.length; }
    u8(v)  { this.push(v & 0xff); this.len++; }
    u16(v) { this.push(v & 0xff); this.push((v >>> 8) & 0xff); this.len += 2; }
    u32(v) { this.push(v & 0xff); this.push((v >>> 8) & 0xff);
             this.push((v >>> 16) & 0xff); this.push((v >>> 24) & 0xff); this.len += 4; }
    varint(v) { const before = this.cur.length; _writeVarint(this.cur, v);
                this.len += this.cur.length - before;
                if (this.cur.length >= 1 << 16) this._seal(); }
    _seal() { if (this.cur.length) { this.parts.push(Uint8Array.from(this.cur)); this.cur = []; } }
    toUint8Array() {
        this._seal();
        const out = new Uint8Array(this.len);
        let o = 0;
        for (const p of this.parts) { out.set(p, o); o += p.length; }
        return out;
    }
}

// ── Class map ────────────────────────────────────────────────
// Built from what the ledger actually contains, not from CLASSIFICATIONS,
// so an imported ledger referencing an unlisted class still round-trips.

function buildClassMap() {
    const seen = new Set();
    for (const [, pcEdits] of brushEdits) {
        for (const [, entry] of pcEdits) {
            if (isAllEntry(entry)) seen.add(entry.classification);
            const ov = getOverrides(entry);
            if (ov) for (const edit of ov.values()) seen.add(edit.classification);
        }
    }
    const list = [...seen].sort((a, b) => a - b);
    if (list.length > 255) throw new Error(`Too many distinct classes (${list.length}) for a u8 class map.`);
    const toId = new Uint8Array(256);           // class value -> slot id (1-based)
    list.forEach((v, i) => { toId[v] = i + 1; });
    return { list, toId };
}

// ── Encode ───────────────────────────────────────────────────

let _scratch = new Uint8Array(1 << 16);
function _scratchFor(n) {
    if (_scratch.length < n) _scratch = new Uint8Array(1 << (32 - Math.clz32(n - 1)));
    _scratch.fill(0, 0, n);
    return _scratch;
}

/**
 * Dense-scatter + RLE one node's overrides.
 * Scattering into a dense array is what sorts the indices — Potree 2.0
 * Morton-orders points within a node, so a brush stroke lands as a
 * contiguous run and the RLE collapses it. Iterating the Map directly
 * would emit paint order, which is spatially random.
 */
function encodeNodeRuns(overrides, toId) {
    let maxIdx = -1;
    for (const pIndex of overrides.keys()) if (pIndex > maxIdx) maxIdx = pIndex;
    const n = maxIdx + 1;

    const dense = _scratchFor(n);
    for (const [pIndex, edit] of overrides) dense[pIndex] = toId[edit.classification];

    const runs = [];
    let runVal = dense[0], runLen = 1;
    for (let i = 1; i < n; i++) {
        const v = dense[i];
        if (v === runVal) { runLen++; continue; }
        runs.push(runVal); _writeVarint(runs, runLen);
        runVal = v; runLen = 1;
    }
    runs.push(runVal); _writeVarint(runs, runLen);
    return Uint8Array.from(runs);
}

function encodeLedgerBody(toId) {
    const sink = new ByteSink();
    sink.u32(brushEdits.size);

    for (const [pcName, pcEdits] of brushEdits) {
        const nameBytes = new TextEncoder().encode(pcName);
        sink.u16(nameBytes.length);
        sink.pushBytes(nameBytes);
        sink.u32(pcEdits.size);

        for (const [nodeName, entry] of pcEdits) {
            const nb = new TextEncoder().encode(nodeName);
            sink.u8(nb.length);
            sink.pushBytes(nb);

            const isAll     = isAllEntry(entry);
            const overrides = getOverrides(entry);
            const hasRuns   = !!(overrides && overrides.size > 0);

            sink.u8((isAll ? 1 : 0) | (hasRuns ? 2 : 0));
            if (isAll) sink.u8(toId[entry.classification]);
            if (hasRuns) {
                const runs = encodeNodeRuns(overrides, toId);
                sink.u32(runs.length);
                sink.pushBytes(runs);
            }
        }
    }
    return sink.toUint8Array();
}

async function exportBrowserBinary() {
    const { list, toId } = buildClassMap();
    const body = encodeLedgerBody(toId);

    const header = buildMetadataBlock("browser-binary-v1")
        .map(l => (l === "#FORMAT,browser-binary-v1" ? l : l))
        .concat([`#CLASSMAP,${list.join(",")}`, `#BINARY,${body.length}`])
        .join("\n") + "\n";

    const blob = new Blob([header, body]);
    const gz   = await new Response(
        blob.stream().pipeThrough(new CompressionStream("gzip"))
    ).blob();

    const who  = getContributorName().replace(/[^\w\-]/g, "_");
    const tile = (getTileIndexes() || "").replace(/[^\w\-]/g, "_");
    const pcs  = [...brushEdits.keys()].join("_");
    const name = [pcs, tile, who, "ledger"].filter(Boolean).join("_") + ".gz";

    const url = URL.createObjectURL(gz);
    const a = document.createElement("a");
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// ── Decode ───────────────────────────────────────────────────

/**
 * A server that sets Content-Encoding: gzip on .gz files makes the browser
 * decompress transparently, so the bytes we get back may already be plain.
 * Sniff the gzip magic instead of assuming.
 */
async function maybeGunzip(buffer) {
    const u8 = new Uint8Array(buffer);
    if (u8.length < 2 || u8[0] !== 0x1f || u8[1] !== 0x8b) return u8;
    const blob = new Blob([u8]);
    const out  = await new Response(
        blob.stream().pipeThrough(new DecompressionStream("gzip"))
    ).arrayBuffer();
    return new Uint8Array(out);
}

function splitHeader(bytes) {
    // The header ends with the "#BINARY,<len>\n" line. It can hold UTF-8 (contributor, citation,
    // class names), and a string index counts UTF-16 units, not bytes, so the body offset is the
    // header's encoded length: the bytes exportBrowserBinary() wrote before the binary body.
    const probe = new TextDecoder("utf-8", { fatal: false })
        .decode(bytes.subarray(0, Math.min(bytes.length, 1 << 16)));
    const marker = probe.indexOf("#BINARY,");
    if (marker === -1) return null;
    const nl = probe.indexOf("\n", marker);
    if (nl === -1) return null;
    const header = probe.slice(0, nl);
    return { header, bodyOffset: new TextEncoder().encode(header).length + 1 };
}

function parseClassMap(header) {
    const line = header.split("\n").find(l => l.startsWith("#CLASSMAP,"));
    if (!line) throw new Error("Binary ledger is missing #CLASSMAP.");
    const list = line.slice(10).split(",").map(Number);
    const toClass = new Uint8Array(256);        // slot id -> class value
    list.forEach((v, i) => { toClass[i + 1] = v; });
    return toClass;
}

function decodeNodeRuns(view, off, byteLen, toClass) {
    const end = off + byteLen;
    const overrides = new Map();
    let cursor = 0;

    while (off < end) {
        const id = view[off++];
        let len = 0, shift = 0, b;
        do { b = view[off++]; len |= (b & 0x7f) << shift; shift += 7; } while (b & 0x80);

        if (id !== 0) {
            const classification = toClass[id];
            for (let i = 0; i < len; i++) overrides.set(cursor + i, { classification });
        }
        cursor += len;
    }
    return overrides;
}

function parseLedgerBinary(bytes) {
    const split = splitHeader(bytes);
    if (!split) throw new Error("Not a binary ledger — no #BINARY marker.");
    const toClass = parseClassMap(split.header);

    // Header may carry a custom classification table, same as the CSV path.
    const clsBlock = split.header.split("\n");
    const start = clsBlock.indexOf("#CLASSIFICATIONS");
    if (start !== -1) {
        const imported = [];
        for (let i = start + 1; i < clsBlock.length && clsBlock[i] !== "#END_CLASSIFICATIONS"; i++) {
            const f = clsBlock[i].indexOf(","), l = clsBlock[i].lastIndexOf(",");
            if (f === -1 || f === l) continue;
            imported.push({
                value: parseInt(clsBlock[i].slice(0, f)),
                name:  clsBlock[i].slice(f + 1, l),
                color: clsBlock[i].slice(l + 1),
            });
        }
        if (imported.length) {
            CLASSIFICATIONS = imported;
            syncClassificationsToViewer();
            rebuildClassificationGridUI();
        }
    }
    const contributor = split.header.split("\n").find(l => l.startsWith("contributor,"));
    if (contributor) setContributorName(contributor.slice(12).trim());

    const body = bytes.subarray(split.bodyOffset);
    const dv   = new DataView(body.buffer, body.byteOffset, body.byteLength);
    const dec  = new TextDecoder();
    let off = 0;

    const pcCount = dv.getUint32(off, true); off += 4;
    for (let p = 0; p < pcCount; p++) {
        const nameLen = dv.getUint16(off, true); off += 2;
        const pcName  = dec.decode(body.subarray(off, off + nameLen)); off += nameLen;
        const nodeCount = dv.getUint32(off, true); off += 4;

        if (!brushEdits.has(pcName)) brushEdits.set(pcName, new Map());
        const pcEdits = brushEdits.get(pcName);

        for (let n = 0; n < nodeCount; n++) {
            const nl = body[off++];
            const nodeName = dec.decode(body.subarray(off, off + nl)); off += nl;
            const flags = body[off++];

            let baseline = null;
            if (flags & 1) baseline = toClass[body[off++]];

            let overrides = null;
            if (flags & 2) {
                const runLen = dv.getUint32(off, true); off += 4;
                overrides = decodeNodeRuns(body, off, runLen, toClass); off += runLen;
            }

            let incoming;
            if (baseline !== null) {
                incoming = { all: true, classification: baseline };
                if (overrides) incoming.overrides = overrides;
            } else {
                incoming = overrides || new Map();
            }
            mergeNodeEdit(pcEdits, nodeName, incoming);   // same merge semantics as CSV import
        }
    }

    applyEditsToLoadedNodes();
    updateEditCount();
}

// ── Import entry point ───────────────────────────────────────
// Sniffs format so old text CSVs keep working unchanged.

async function importLedgerFile(file) {
    const bytes = await maybeGunzip(await file.arrayBuffer());
    const head  = new TextDecoder("utf-8", { fatal: false }).decode(bytes.subarray(0, 64));
    if (head.startsWith(BRUSH_BINARY_MAGIC)) parseLedgerBinary(bytes);
    else parseEditsCSV(new TextDecoder().decode(bytes));
}

async function importEditsAny(filePath) {
    if (filePath) {
        // Fetch from URL — the response blob exposes arrayBuffer(), same as a File.
        try {
            const res = await fetch(filePath);
            if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
            await importLedgerFile(await res.blob());
        } catch (err) {
            console.error(`Import failed for ${filePath}:`, err);
        }
        return;
    }
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".csv,.gz,.ohl";
    input.multiple = true;
    input.addEventListener("change", async (e) => {
        for (const file of Array.from(e.target.files)) {
            try { await importLedgerFile(file); }
            catch (err) { console.error(`Import failed for ${file.name}:`, err); }
        }
    });
    input.click();
}
