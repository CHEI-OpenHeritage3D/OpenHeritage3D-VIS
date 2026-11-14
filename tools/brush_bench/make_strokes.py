#!/usr/bin/env python3
"""Turn captured brush centers into strokes.json.

    python3 make_strokes.py --captures captures.jsonl --plan plan.json -o strokes.json
    python3 make_strokes.py ... --naive-from results/ref/runs.jsonl   # check hidden strokes

Captures come from __bench.capture("label") (run.mjs capture <dataset>). A capture made on a
Work Distribution tile URL carries that URL's `volumes` and the tile's geometry; it is a *tile
capture* and only feeds clip and tile-initialization strokes. Every other capture is a *main
capture* and gets one stroke per multiplier of its leaf extent.

plan.json (see plan.example.json):
  multipliers   radii as multiples of the leaf extent at the center, e.g. [1, 4, 16, 64, 256]
  wholeCloud    "first" (one per dataset, at its first main capture), "each", or false: a sphere
                that encloses the octree root, so the whole cloud. Excluded from fits.
  fit           fraction of the view height the sphere fills (default 0.4)
  hidden        {"<main capture>": [multipliers]}: the same strokes with one absent class hidden
  clip          {"<tile capture>": [multipliers]}: strokes through the tile URL, each with a
                no-clip twin at the same center and radius (sampled like clip) for the
                clip-vs-none comparison; "clipPairs": false leaves the twins out
  tileInit      ["<tile capture>"]: one sphere enclosing the whole tile, at its center
  conditions    [stroke ids] for the throttled-network and laptop runs
  trace         [stroke ids] for trace mode
  anchor        stroke id run at the start and end of every session

Every stroke's camera keeps its capture's view direction, backed off along it until the sphere
fills `fit` of the view height. Edit a stroke's camera by hand to give it its own.
"""
import argparse
import json
import math
import pathlib
import sys

HERE = pathlib.Path(__file__).resolve().parent
NAIVE_ROW = ("nodes: total (visited + enclosed)", "nodes: total (visited + enclosed + covered)")
HIDDEN_NAIVE_LIMIT = 50_000


def load_jsonl(path):
    out = []
    for i, line in enumerate(pathlib.Path(path).read_text().splitlines(), 1):
        if line.strip():
            try:
                out.append(json.loads(line))
            except json.JSONDecodeError as e:
                sys.exit(f"{path}:{i}: {e}")
    return out


def fmt_mult(m):
    return f"{m:g}".replace(".", "p")


def unit(v):
    n = math.sqrt(sum(x * x for x in v))
    if n == 0:
        raise ValueError("zero-length view direction")
    return [x / n for x in v]


def fit_camera(center, camera, radius, fit):
    """Captured view direction; distance so the sphere's image is `fit` of the view height."""
    d = unit([t - p for p, t in zip(camera["position"], camera["target"])])
    half = math.radians(camera.get("fov") or 60) / 2
    alpha = math.atan(fit * math.tan(half))           # angular radius of the sphere's image
    dist = radius / math.sin(alpha)
    return {"position": [c - dist * x for c, x in zip(center, d)], "target": list(center)}


def whole_cloud_radius(center, corners):
    """Radius whose sphere holds every corner of the octree root box (world space)."""
    return 1.001 * max(math.dist(center, c) for c in corners)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--captures", default=HERE / "captures.jsonl")
    ap.add_argument("--plan", default=HERE / "plan.json")
    ap.add_argument("--datasets", default=HERE / "datasets.json")
    ap.add_argument("-o", "--out", default=HERE / "strokes.json")
    ap.add_argument("--naive-from", help="runs.jsonl with full-mode results: check hidden strokes' naive counts")
    ap.add_argument("--drop-over-limit", action="store_true", help=f"drop hidden strokes whose naive count is >= {HIDDEN_NAIVE_LIMIT}")
    args = ap.parse_args()

    datasets = json.loads(pathlib.Path(args.datasets).read_text())
    datasets.pop("_comment", None)
    plan = json.loads(pathlib.Path(args.plan).read_text())
    captures = load_jsonl(args.captures)
    fit = plan.get("fit", 0.4)
    mults = plan.get("multipliers", [1, 4, 16, 64, 256])
    warnings = []

    by_label = {}
    for c in captures:
        if c["label"] in by_label:
            warnings.append(f"capture {c['label']} appears more than once; using the last one")
        by_label[c["label"]] = c
        if c.get("dataset") not in datasets:
            sys.exit(f"capture {c['label']}: unknown dataset {c.get('dataset')!r}")
        want = datasets[c["dataset"]].get("pointcloud")
        if want and want != c["pointcloud"]:
            warnings.append(f"capture {c['label']}: cloud {c['pointcloud']!r}, dataset says {want!r}")
        if c.get("viewport") and c["viewport"][:2] != [1600, 900]:
            warnings.append(f"capture {c['label']}: captured at {c['viewport']}, runs use 1600x900")

    def stroke(cap, radius, sid, condition="none", **extra):
        ds = datasets[cap["dataset"]]
        center = extra.pop("center", cap["center"])
        s = {
            "id": sid,
            "dataset": cap["dataset"],
            "pointcloud": cap["pointcloud"],
            "captureLabel": cap["label"],
            "condition": condition,
            "center": center,
            "radius": radius,
            "leafExtent": cap["leafExtent"],
            "leafDepth": cap["leafDepth"],
            "camera": fit_camera(center, cap["camera"], radius, fit),
            "cameraSource": f"capture direction, sphere fills {fit:g} of view height",
            "sets": ["main"],
        }
        s.update(extra)
        if condition == "clip":
            s["volumes"] = cap["volumes"]
        large = ds.get("largeStrokeRadius")
        if ds.get("largeStrokeTimeoutMin") and ((large is not None and radius >= large) or s.get("wholeCloud") or s.get("tileInit")):
            s["timeoutMin"] = ds["largeStrokeTimeoutMin"]
        return s

    strokes = []
    main_caps = [c for c in by_label.values() if not c.get("volumes")]
    tile_caps = {c["label"]: c for c in by_label.values() if c.get("volumes")}

    seen_ds = set()
    for cap in main_caps:
        for m in mults:
            strokes.append(stroke(cap, m * cap["leafExtent"], f"{cap['label']}-x{fmt_mult(m)}", multiplier=m))
        mode = plan.get("wholeCloud", "first")
        if mode == "each" or (mode == "first" and cap["dataset"] not in seen_ds):
            r = whole_cloud_radius(cap["center"], cap["rootCorners"])
            strokes.append(stroke(cap, r, f"{cap['label']}-whole", wholeCloud=True, multiplier=r / cap["leafExtent"]))
        seen_ds.add(cap["dataset"])

    for label, ms in plan.get("hidden", {}).items():
        cap = by_label.get(label)
        if not cap:
            sys.exit(f"plan.hidden: no capture {label}")
        for m in ms:
            strokes.append(stroke(cap, m * cap["leafExtent"], f"{label}-x{fmt_mult(m)}-hidden", "hidden", multiplier=m))

    for label, ms in plan.get("clip", {}).items():
        cap = tile_caps.get(label)
        if not cap:
            sys.exit(f"plan.clip: {label} is not a capture made on a tile URL")
        tile = cap.get("tile") or {}
        if not tile or tile.get("error"):
            sys.exit(f"plan.clip: capture {label} has no single tile volume ({tile.get('error')})")
        if not tile.get("inside"):
            warnings.append(f"clip {label}: the center is outside its tile")
        for m in ms:
            r = m * cap["leafExtent"]
            if r <= tile["wallDistance"]:
                warnings.append(f"clip {label}-x{fmt_mult(m)}: radius {r:.4g} doesn't reach the tile wall ({tile['wallDistance']:.4g} away)")
            strokes.append(stroke(cap, r, f"{label}-x{fmt_mult(m)}-clip", "clip", multiplier=m))
            if plan.get("clipPairs", True):
                # The same stroke without the tile, for the clip-vs-none comparison; sampled like clip.
                strokes.append(stroke(cap, r, f"{label}-x{fmt_mult(m)}", multiplier=m, samplesAs="clip"))

    for label in plan.get("tileInit", []):
        cap = tile_caps.get(label)
        if not cap or not cap.get("tile") or cap["tile"].get("error"):
            sys.exit(f"plan.tileInit: {label} is not a capture made on a tile URL with one tile volume")
        r = 1.001 * cap["tile"]["halfDiagonal"]
        strokes.append(stroke(cap, r, f"{label}-tile", "clip", center=cap["tile"]["center"], tileInit=True,
                              multiplier=r / cap["leafExtent"]))

    ids = {s["id"]: s for s in strokes}
    if len(ids) != len(strokes):
        sys.exit("duplicate stroke ids")
    for key in ("conditions", "trace"):
        for sid in plan.get(key, []):
            if sid not in ids:
                sys.exit(f"plan.{key}: no stroke {sid}")
            ids[sid]["sets"].append(key)
    if plan.get("anchor"):
        if plan["anchor"] not in ids:
            sys.exit(f"plan.anchor: no stroke {plan['anchor']}")
        ids[plan["anchor"]]["anchor"] = True

    if args.naive_from:
        naive = {}
        for r in load_jsonl(args.naive_from):
            p = r.get("profile") or {}
            v = next((p[k] for k in NAIVE_ROW if p.get(k) is not None), None)
            if r.get("type") == "run" and r.get("mode") == "full" and r.get("status") == "ok" and v is not None:
                naive[r["strokeId"]] = v
        keep = []
        for s in strokes:
            if s["condition"] == "hidden":
                base = s["id"][: -len("-hidden")]
                n = naive.get(base)
                if n is None:
                    warnings.append(f"{s['id']}: no full-mode naive count for {base} yet")
                elif n >= HIDDEN_NAIVE_LIMIT:
                    warnings.append(f"{s['id']}: naive count {n:,} >= {HIDDEN_NAIVE_LIMIT:,}" + ("; dropped" if args.drop_over_limit else ""))
                    if args.drop_over_limit:
                        continue
            keep.append(s)
        strokes = keep

    strokes.sort(key=lambda s: (s["dataset"], s["captureLabel"], s["condition"], s["radius"]))
    pathlib.Path(args.out).write_text(json.dumps(strokes, indent=1) + "\n")
    counts = {}
    for s in strokes:
        counts[(s["dataset"], s["condition"])] = counts.get((s["dataset"], s["condition"]), 0) + 1
    print(f"{len(strokes)} strokes -> {args.out}")
    for (d, c), n in sorted(counts.items()):
        print(f"  {d:12s} {c:7s} {n}")
    for w in warnings:
        print("warning:", w)


if __name__ == "__main__":
    main()
