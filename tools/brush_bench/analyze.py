#!/usr/bin/env python3
"""Analyse brush benchmark results (tools/brush_bench). Medians and ranges over samples, never means.

    python3 analyze.py [--results results] [--out analysis] [--reference ref]

Reads results/<machine>/runs.jsonl and sessions.jsonl. Uses runs with status "ok" and role
"main"; leaves out warm-up rounds, software-GL runs and runs from flagged sessions (anchor
stroke drifted > 20%), and says how many it left out. Writes CSV tables, summary.md and, when
matplotlib is installed, fig_nodes_vs_radius.{png,svg}.

  1. nodes inspected vs naive against radius / leaf extent (full mode), log-log, fits without
     the whole-cloud strokes
  2. latency per dataset (lean, reference machine, normal network, condition none)
  3. clip and hidden vs none on the same center and radius
  4. large strokes on one dataset (default lacounty)
  5. conditions: throttled network and other machines vs the reference
  6. traces: main-thread time in the stroke split into brush / Potree / other / idle
"""
import argparse
import csv
import json
import math
import pathlib
import statistics
import sys
from collections import defaultdict

HERE = pathlib.Path(__file__).resolve().parent
NAIVE_ROWS = ("nodes: total (visited + enclosed)", "nodes: total (visited + enclosed + covered)")


# ── Loading ──────────────────────────────────────────────────────────────────

def load_jsonl(path):
    out = []
    if path.exists():
        for line in path.read_text().splitlines():
            if line.strip():
                try:
                    out.append(json.loads(line))
                except json.JSONDecodeError:
                    pass
    return out


def load(results, include_flagged, include_software):
    runs, sessions = [], {}
    for mdir in sorted(p for p in results.iterdir() if p.is_dir()):
        runs += [r for r in load_jsonl(mdir / "runs.jsonl") if r.get("type") == "run"]
        for s in load_jsonl(mdir / "sessions.jsonl"):
            sessions[s["sessionId"]] = s
    flagged = {sid for sid, s in sessions.items() if s.get("flagged")}
    kept, dropped = [], defaultdict(int)
    for r in runs:
        if r.get("role", "main") != "main":
            dropped["anchor/pilot role"] += 1
        elif r.get("status") != "ok":
            dropped[f"status {r.get('status')}"] += 1
        elif r.get("discard"):
            dropped["warm-up round"] += 1
        elif r.get("softwareGL") and not include_software:
            dropped["software GL"] += 1
        elif r.get("sessionId") in flagged and not include_flagged:
            dropped["flagged session"] += 1
        else:
            kept.append(r)
    return kept, sessions, dropped


# ── Small helpers ────────────────────────────────────────────────────────────

def med(xs):
    xs = [x for x in xs if x is not None]
    return statistics.median(xs) if xs else None


def rng(xs):
    xs = [x for x in xs if x is not None]
    return (min(xs), max(xs)) if xs else (None, None)


def mr(xs, scale=1.0, digits=0):
    """'median [min-max]' text."""
    m = med(xs)
    if m is None:
        return "–"
    lo, hi = rng(xs)
    f = lambda v: f"{v * scale:,.{digits}f}"
    return f"{f(m)} [{f(lo)}–{f(hi)}]" if len([x for x in xs if x is not None]) > 1 else f(m)


def get(d, *path):
    for p in path:
        if d is None:
            return None
        d = d.get(p) if isinstance(d, dict) else None
    return d


def node_requests(r):
    req = r.get("requests") or {}
    return (get(req, "octree", "count") or 0) + (get(req, "copc", "count") or 0)


def heap_change(r):
    b, a = get(r, "heap", "beforeBytes"), get(r, "heap", "afterBytes")
    return a - b if a is not None and b is not None else None


def naive_of(p):
    return next((p[k] for k in NAIVE_ROWS if p.get(k) is not None), None)


def r_over_w(r):
    p = r.get("profile") or {}
    if p.get("radius / leaf extent") is not None:
        return p["radius / leaf extent"]
    s = r.get("stroke") or {}
    return s["radius"] / s["leafExtent"] if s.get("leafExtent") else s.get("multiplier")


def write_csv(path, header, rows):
    with path.open("w", newline="") as f:
        w = csv.writer(f)
        w.writerow(header)
        w.writerows(rows)


def md_table(header, rows):
    out = ["| " + " | ".join(header) + " |", "|" + "|".join("---" for _ in header) + "|"]
    out += ["| " + " | ".join("" if c is None else str(c) for c in row) + " |" for row in rows]
    return "\n".join(out)


def by_stroke(runs):
    g = defaultdict(list)
    for r in runs:
        g[r["strokeId"]].append(r)
    return g


def loglog_fit(xs, ys):
    pts = [(math.log(x), math.log(y)) for x, y in zip(xs, ys) if x and y and x > 0 and y > 0]
    if len(pts) < 2:
        return None
    mx = sum(p[0] for p in pts) / len(pts)
    my = sum(p[1] for p in pts) / len(pts)
    sxx = sum((p[0] - mx) ** 2 for p in pts)
    if sxx == 0:
        return None
    return sum((p[0] - mx) * (p[1] - my) for p in pts) / sxx


# ── 1. nodes vs radius ───────────────────────────────────────────────────────

def nodes_vs_radius(runs, out, md):
    full = [r for r in runs if r["mode"] == "full" and r["condition"] == "none" and r.get("profile")]
    rows, per_ds = [], defaultdict(list)
    for sid, rs in sorted(by_stroke(full).items()):
        r = rs[-1]
        p = r["profile"]
        naive, insp, impl = naive_of(p), p.get("↳ explicit per-point"), p.get("↳ bulk-marked implicit")
        cls, ipts = p.get("points: classified"), p.get("↳ implicit (bulk subtrees)")
        share = 100 * ipts / cls if cls and ipts is not None else None
        rw = r_over_w(r)
        whole = r["stroke"].get("wholeCloud")
        rows.append([r["dataset"], sid, r["stroke"]["radius"], rw, naive, insp, impl,
                     None if share is None else round(share, 1), whole])
        per_ds[r["dataset"]].append((rw, naive, insp, whole))
    write_csv(out / "nodes_vs_radius.csv",
              ["dataset", "stroke", "radius_m", "r_over_w", "naive_nodes", "inspected_nodes", "implicit_nodes", "implicit_point_share_pct", "whole_cloud"], rows)

    fits = []
    for ds, pts in sorted(per_ds.items()):
        use = [p for p in pts if not p[3]]
        sn = loglog_fit([p[0] for p in use], [p[1] for p in use])
        si = loglog_fit([p[0] for p in use], [p[2] for p in use])
        rws = [p[0] for p in use if p[0]]
        fits.append([ds, len(use), f"{min(rws):.3g}–{max(rws):.3g}" if rws else "–",
                     None if sn is None else round(sn, 2), None if si is None else round(si, 2),
                     None if sn is None or si is None else round(sn - si, 2)])
    write_csv(out / "fits.csv", ["dataset", "strokes", "r_over_w_range", "slope_naive", "slope_inspected", "difference"], fits)
    md.append("## 1. Nodes inspected vs naive\n\nFull mode, condition none. Slopes are log-log least squares "
              "against radius / leaf extent, whole-cloud strokes excluded.\n")
    md.append(md_table(["dataset", "strokes", "r/w", "slope naive", "slope inspected", "difference"], fits))

    try:
        import matplotlib
        matplotlib.use("Agg")
        import matplotlib.pyplot as plt
    except ImportError:
        md.append("\n(matplotlib not installed: no figure; the data is in nodes_vs_radius.csv)\n")
        return
    fig, ax = plt.subplots(figsize=(6.5, 4.5))
    colors = plt.rcParams["axes.prop_cycle"].by_key()["color"]
    for i, (ds, pts) in enumerate(sorted(per_ds.items())):
        c = colors[i % len(colors)]
        pts = sorted(p for p in pts if p[0])
        ax.plot([p[0] for p in pts], [p[1] for p in pts], "o--", color=c, mfc="none", label=f"{ds} naive")
        ax.plot([p[0] for p in pts if p[2]], [p[2] for p in pts if p[2]], "o-", color=c, label=f"{ds} inspected")
    ax.set_xscale("log")
    ax.set_yscale("log")
    ax.axvline(math.sqrt(3) / 2, color="0.6", lw=0.8, ls=":")
    ax.set_xlabel("brush radius / leaf extent at center")
    ax.set_ylabel("nodes per stroke")
    ax.legend(fontsize=7, ncol=2)
    fig.tight_layout()
    for ext in ("png", "svg"):
        fig.savefig(out / f"fig_nodes_vs_radius.{ext}", dpi=200)
    md.append("\nFigure: fig_nodes_vs_radius.png\n")


# ── 2. latency ───────────────────────────────────────────────────────────────

def latency(runs, ref, out, md):
    lean = [r for r in runs if r["mode"] == "lean" and r["machine"]["label"] == ref
            and r["network"] == "normal" and r["condition"] == "none"]
    rows = []
    for sid, rs in sorted(by_stroke(lean).items(), key=lambda kv: (kv[1][0]["dataset"], kv[1][0]["stroke"]["radius"])):
        r0 = rs[0]
        rows.append([r0["dataset"], sid, f"{r0['stroke']['radius']:.4g}", len(rs),
                     mr([get(r, "timing", "firstVisibleEditMs") for r in rs]),
                     mr([get(r, "timing", "completionMs") for r in rs]),
                     mr([get(r, "frames", "p95Ms") for r in rs], digits=1),
                     mr([node_requests(r) for r in rs]),
                     mr([heap_change(r) for r in rs], scale=1 / 2 ** 20, digits=1)])
    header = ["dataset", "stroke", "radius m", "n", "first visible edit ms", "completion ms", "frame p95 ms", "node requests", "heap change MiB"]
    write_csv(out / "latency.csv", header, rows)
    md.append(f"\n## 2. Latency (lean, machine {ref}, normal network, condition none)\n\nmedian [min–max] over samples.\n")
    md.append(md_table(header, rows))


# ── 3. clip and hidden vs none ───────────────────────────────────────────────

def conditions_vs_none(runs, ref, out, md):
    sel = [r for r in runs if r["machine"]["label"] == ref and r["network"] == "normal"]
    lean, full = by_stroke([r for r in sel if r["mode"] == "lean"]), by_stroke([r for r in sel if r["mode"] == "full"])
    rows = []
    for sid in sorted(set(lean) | set(full)):
        cond = (lean.get(sid) or full.get(sid))[0]["condition"]
        if cond == "none":
            continue
        base = sid.rsplit("-", 1)[0]          # "<label>-x<m>-clip" → "<label>-x<m>"
        bl, cl = lean.get(base, []), lean.get(sid, [])
        bf, cf = (full.get(base) or [None])[-1], (full.get(sid) or [None])[-1]
        mb, mc = med([get(r, "timing", "completionMs") for r in bl]), med([get(r, "timing", "completionMs") for r in cl])
        pb, pc = (bf or {}).get("profile") or {}, (cf or {}).get("profile") or {}
        rows.append([cond, sid, base, mr([get(r, "timing", "completionMs") for r in bl]), mr([get(r, "timing", "completionMs") for r in cl]),
                     None if not mb or mc is None else f"{mc / mb:.2f}",
                     mr([node_requests(r) for r in bl]), mr([node_requests(r) for r in cl]),
                     pb.get("↳ explicit per-point"), pc.get("↳ explicit per-point"),
                     pb.get("↳ bulk-marked implicit"), pc.get("↳ bulk-marked implicit"), naive_of(pb)])
    header = ["condition", "stroke", "none twin", "none completion ms", "condition completion ms", "ratio",
              "none node req", "condition node req", "none inspected", "condition inspected", "none implicit", "condition implicit", "naive"]
    write_csv(out / "clip_hidden_vs_none.csv", header, rows)
    md.append(f"\n## 3. Clip and hidden vs none (machine {ref}, normal network)\n")
    md.append(md_table(header, rows) if rows else "(no clip or hidden runs)")


# ── 4. large strokes ─────────────────────────────────────────────────────────

def large_strokes(runs, ds_cfg, dataset, out, md):
    big = ds_cfg.get(dataset, {}).get("largeStrokeRadius")
    is_big = lambda r: r["dataset"] == dataset and (big is None or r["stroke"]["radius"] >= big
                                                   or r["stroke"].get("tileInit") or r["stroke"].get("wholeCloud"))
    full, lean = by_stroke([r for r in runs if r["mode"] == "full" and is_big(r)]), by_stroke([r for r in runs if r["mode"] == "lean" and is_big(r) and r["network"] == "normal"])
    rows = []
    for sid in sorted(set(full) | set(lean)):
        f = (full.get(sid) or [None])[-1] or {}
        p = f.get("profile") or {}
        cls, ipts = p.get("points: classified"), p.get("↳ implicit (bulk subtrees)")
        naive, insp = naive_of(p), p.get("↳ explicit per-point")
        ls = lean.get(sid, [])
        rows.append([sid, f"{(f or ls[0])['stroke']['radius']:.4g}", (f or ls[0])["condition"], cls,
                     None if not cls or ipts is None else f"{100 * ipts / cls:.1f}", p.get("nodes: force-loaded"),
                     mr([get(r, "timing", "completionMs") for r in ls]), mr([get(r, "heap", "peakBytes") for r in ls], scale=1 / 2 ** 20, digits=0),
                     get(f, "ledgerSize", "gzipBytes"), get(f, "ledger", "entries"), naive, insp,
                     None if naive is None or insp is None else naive - insp])
    header = ["stroke", "radius m", "condition", "points classified", "implicit share %", "nodes loaded",
              "completion ms (lean)", "peak heap MiB (lean)", "ledger gzip bytes", "ledger entries", "naive nodes", "inspected nodes", "naive nodes avoided"]
    write_csv(out / f"large_{dataset}.csv", header, rows)
    md.append(f"\n## 4. Large strokes on {dataset}\n")
    md.append(md_table(header, rows) if rows else f"(no large {dataset} strokes)")


# ── 5. conditions ────────────────────────────────────────────────────────────

def conditions(runs, ref, out, md):
    lean = [r for r in runs if r["mode"] == "lean"]
    cond_ids = {r["strokeId"] for r in lean if (r["machine"]["label"] != ref or r["network"] != "normal")}
    combos = sorted({(r["machine"]["label"], r["network"]) for r in lean if r["strokeId"] in cond_ids})
    combos = [(ref, "normal")] + [c for c in combos if c != (ref, "normal")]
    g = defaultdict(list)
    for r in lean:
        if r["strokeId"] in cond_ids:
            g[(r["strokeId"], r["machine"]["label"], r["network"])].append(r)
    rows = []
    for sid in sorted(cond_ids):
        row = [sid]
        for m, n in combos:
            rs = g.get((sid, m, n), [])
            fv = [get(r, "timing", "firstVisibleEditMs") for r in rs]
            row += [mr(fv), mr([get(r, "timing", "completionMs") for r in rs]),
                    ("yes" if med(fv) is not None and med(fv) < 1000 else "no") if rs else "–"]
        rows.append(row)
    header = ["stroke"] + [f"{m}/{n} {k}" for m, n in combos for k in ("first visible edit ms", "completion ms", "first edit < 1 s")]
    write_csv(out / "conditions.csv", header, rows)
    md.append("\n## 5. Conditions (lean)\n\n'first edit < 1 s' compares the median with 1 s.\n")
    md.append(md_table(header, rows) if rows else "(no throttled or other-machine runs)")


# ── 6. traces ────────────────────────────────────────────────────────────────

def trace_split(path):
    """Main-thread time between the bench:t0 and bench:t1 marks, split by V8 CPU-profile samples:
    brush = any frame from brush_selection.js on the stack (what the brush runs, including the
    three.js and Potree calls it makes); potree = otherwise any frame from potree.js (render
    loop, visibility, load callbacks); idle = (idle); other = the rest ((program), GC, other JS)."""
    data = json.loads(pathlib.Path(path).read_text())
    ev = data["traceEvents"] if isinstance(data, dict) else data
    marks = {e["name"]: e for e in ev if e.get("name") in ("bench:t0", "bench:t1")}
    if len(marks) != 2:
        return None
    t0, t1, pid = marks["bench:t0"]["ts"], marks["bench:t1"]["ts"], marks["bench:t0"]["pid"]
    tid = marks["bench:t0"]["tid"]
    profiles = {e["id"]: e for e in ev if e.get("name") == "Profile" and e.get("pid") == pid and e.get("tid") == tid}
    if not profiles:
        return None
    nodes, samples = {}, []
    for pid_ in profiles:
        t = profiles[pid_]["args"]["data"]["startTime"]
        for e in ev:
            if e.get("name") != "ProfileChunk" or e.get("id") != pid_ or e.get("pid") != pid:
                continue
            d = e["args"]["data"]
            for n in d.get("cpuProfile", {}).get("nodes", []):
                nodes[n["id"]] = n
            for sid_, dt in zip(d.get("cpuProfile", {}).get("samples", []), d.get("timeDeltas", [])):
                t += dt
                samples.append((t, sid_))
    samples.sort()
    cache = {}

    def category(nid):
        if nid in cache:
            return cache[nid]
        n, cat, leaf = nodes.get(nid), None, nodes.get(nid, {}).get("callFrame", {}).get("functionName", "")
        saw_potree = False
        while n is not None:
            url = n.get("callFrame", {}).get("url", "")
            if url.split("?")[0].endswith("brush_selection.js"):
                cat = "brush"
                break
            if url.split("?")[0].endswith("potree.js"):
                saw_potree = True
            n = nodes.get(n.get("parent"))
        if cat is None:
            cat = "potree" if saw_potree else ("idle" if leaf == "(idle)" else "other")
        cache[nid] = cat
        return cat

    # parent links: the profile lists children, not parents
    for n in list(nodes.values()):
        for c in n.get("children", []):
            if c in nodes:
                nodes[c]["parent"] = n["id"]
    totals = defaultdict(float)
    for (t, nid), (t_next, _) in zip(samples, samples[1:] + [(samples[-1][0], None)] if samples else []):
        if t0 <= t < t1:
            totals[category(nid)] += max(0.0, min(t_next, t1) - t)
    span = t1 - t0
    return {k: totals[k] / span for k in ("brush", "potree", "other", "idle")} | {"windowMs": span / 1000, "sampledShare": sum(totals.values()) / span}


def traces(runs, results, out, md):
    rows = []
    for r in runs:
        if r["mode"] != "trace" or not r.get("trace"):
            continue
        path = results / r["machine"]["label"] / r["trace"]
        if not path.exists():
            continue
        s = trace_split(path)
        if s is None:
            rows.append([r["strokeId"], r["machine"]["label"], "no marks/profile"] + [None] * 5)
            continue
        rows.append([r["strokeId"], r["machine"]["label"], f"{s['windowMs']:.0f}", f"{s['brush']:.3f}", f"{s['potree']:.3f}",
                     f"{s['other']:.3f}", f"{s['idle']:.3f}", f"{s['sampledShare']:.3f}"])
    header = ["stroke", "machine", "window ms", "brush", "potree", "other", "idle", "sampled share"]
    write_csv(out / "trace_split.csv", header, rows)
    md.append("\n## 6. Main-thread time during the stroke (trace mode, proportions only)\n\n"
              "brush: a brush_selection.js frame on the stack; potree: otherwise a potree.js frame; idle: (idle); other: the rest. "
              "Tracing slows the stroke, so use the proportions, not the times.\n")
    md.append(md_table(header, rows) if rows else "(no traces)")


# ── main ─────────────────────────────────────────────────────────────────────

def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--results", default=HERE / "results", type=pathlib.Path)
    ap.add_argument("--out", default=HERE / "analysis", type=pathlib.Path)
    ap.add_argument("--datasets", default=HERE / "datasets.json", type=pathlib.Path)
    ap.add_argument("--reference", help="reference machine label (default: the one with the most lean runs)")
    ap.add_argument("--large-dataset", default="lacounty")
    ap.add_argument("--include-flagged", action="store_true", help="keep runs from sessions whose anchor drifted > 20%%")
    ap.add_argument("--include-software-gl", action="store_true", help="keep software-GL (dev) runs")
    a = ap.parse_args()

    if not a.results.is_dir():
        sys.exit(f"{a.results}: no results directory")
    runs, sessions, dropped = load(a.results, a.include_flagged, a.include_software_gl)
    if not runs:
        sys.exit(f"no usable runs in {a.results} (left out: {dict(dropped)})")
    a.out.mkdir(parents=True, exist_ok=True)
    ds_cfg = json.loads(a.datasets.read_text()) if a.datasets.exists() else {}
    counts = defaultdict(int)
    for r in runs:
        if r["mode"] == "lean":
            counts[r["machine"]["label"]] += 1
    ref = a.reference or (max(counts, key=counts.get) if counts else runs[0]["machine"]["label"])

    md = ["# Brush benchmark analysis\n",
          f"{len(runs)} runs used; left out: {', '.join(f'{k} {v}' for k, v in sorted(dropped.items())) or 'none'}. Reference machine: {ref}.",
          f"Sessions: {len(sessions)}, flagged: {sum(1 for s in sessions.values() if s.get('flagged'))}.",
          f"Brush builds: {sorted({get(r, 'build', 'brush', 'sha256') or '?' for r in runs})}; Chrome: {sorted({r.get('chrome') or '?' for r in runs})}.\n"]
    nodes_vs_radius(runs, a.out, md)
    latency(runs, ref, a.out, md)
    conditions_vs_none(runs, ref, a.out, md)
    large_strokes(runs, ds_cfg, a.large_dataset, a.out, md)
    conditions(runs, ref, a.out, md)
    traces(runs, a.results, a.out, md)
    (a.out / "summary.md").write_text("\n".join(md) + "\n")
    print(f"wrote {a.out}/summary.md and CSVs ({len(runs)} runs)")


if __name__ == "__main__":
    main()
