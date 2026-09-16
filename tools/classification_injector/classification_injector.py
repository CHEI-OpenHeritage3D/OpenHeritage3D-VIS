#!/usr/bin/env python3
"""
classification_injector.py

Author: Aviral Agarwal
ALERTCalifornia, Cultural Heritage Engineering Initiative (UC San Diego)

Applies classification edits exported from the OH3D Potree brush tool
to original LAS/LAZ files. Consumes the World-Space Export (#FORMAT,world-v1),
plain or gzipped, and the older "python" format for backward compatibility.

The edit file has two tiers:

  1. AABBs     - bulk regions where every point within a bounding box
                 receives a uniform classification (implicit ledger entries).
                 Each carries the octree depth it came from.
  2. Overrides - individual points matched by world-space position via
                 KD-tree nearest-neighbour lookup (explicit/hybrid entries).

Application order: AABBs by ascending depth, then overrides. Depth ordering
matters because a deeper region overrides the ancestor it sits inside, and
the ledger routinely contains both. Sorting is done globally across all input
files, not per file, so merged contributions apply the same way they render
in the viewer.

The Potree ledger export (#FORMAT,browser* ) carries no world positions and
cannot be applied here; this script skips it with a warning.

Usage:
    python classification_injector.py <las_path> <edits> [options]

    <las_path> can be a single .las/.laz file or a folder of tiles.
    <edits>    can be a single .csv/.csv.gz or a folder of them (all merged).

Examples:
    python classification_injector.py ./las_tiles edits.csv.gz
    python classification_injector.py ./las_tiles ./edit_folder
    python classification_injector.py scan.las edits.csv.gz --tolerance 0.05
    python classification_injector.py ./las_tiles edits.csv.gz --output-dir ./modified
    python classification_injector.py ./las_tiles edits.csv.gz --dry-run

Dependencies:
    pip install laspy numpy scipy
"""

import argparse
import gzip
import sys
import time
from pathlib import Path

try:
    import numpy as np
    import laspy
    from scipy.spatial import cKDTree
except ImportError as e:
    print(f"Missing dependency: {e.name}")
    print("Run: pip install laspy numpy scipy")
    sys.exit(1)


EDIT_SUFFIXES = (".csv", ".csv.gz", ".gz")


def open_edits(path):
    """Open a plain or gzipped edit file as text."""
    if path.suffix == ".gz":
        return gzip.open(path, mode="rt", encoding="utf-8-sig", newline="")
    return open(path, mode="r", encoding="utf-8-sig", newline="")


# ---------------------------------------------------------------
#  Parse edit file
# ---------------------------------------------------------------

def parse_edits(path):
    """Parse a World-Space Export.

    Returns:
        aabbs:     list of (depth, classification, min_xyz, max_xyz)
        overrides: (xyz float64 array of shape (n, 3), class uint8 array)
        metadata:  dict of metadata key-value pairs

    Accepts both the current world-v1 layout and the older "python" layout,
    distinguished by field count:

        AABBs      world-v1: depth,class,minx,miny,minz,maxx,maxy,maxz   (8)
                   python:   pc,node,class,minx,miny,minz,maxx,maxy,maxz (9)
        Overrides  world-v1: class,x,y,z                                 (4)
                   python:   pc,class,x,y,z                              (5)
    """
    aabbs = []
    ov_cls, ov_x, ov_y, ov_z = [], [], [], []
    metadata = {}

    section = None          # None | "metadata" | "aabbs" | "overrides"

    with open_edits(path) as f:
        for raw_line in f:
            line = raw_line.strip()
            if not line:
                continue

            # -- Section markers --
            if line.startswith("#FORMAT,"):
                fmt = line.split(",", 1)[1].strip()
                if fmt.startswith("browser"):
                    print(f"  Warning: {path.name} is a Potree ledger export (no world positions).")
                    print(f"           Use the World-Space Export from the brush panel instead.")
                    return [], (np.empty((0, 3)), np.empty(0, dtype=np.uint8)), {}
                continue
            if line == "#METADATA":      section = "metadata";  continue
            if line == "#END_METADATA":  section = None;        continue
            if line == "#AABBS":         section = "aabbs";     continue
            if line == "#END_AABBS":     section = None;        continue
            if line == "#OVERRIDES":     section = "overrides"; continue
            if line == "#END_OVERRIDES": section = None;        continue

            # -- Comments and the #CLASSIFICATIONS block --
            if line.startswith("#"):
                continue

            if section == "metadata":
                if "," in line:
                    key, _, value = line.partition(",")
                    metadata[key.strip()] = value.strip()
                continue

            if section == "aabbs":
                parts = line.split(",")
                try:
                    if len(parts) >= 9:                 # legacy: pc,node,class,...
                        depth = len(parts[1]) - 1       # node name encodes depth
                        cls   = int(parts[2])
                        nums  = [float(v) for v in parts[3:9]]
                    elif len(parts) == 8:               # world-v1: depth,class,...
                        depth = int(parts[0])
                        cls   = int(parts[1])
                        nums  = [float(v) for v in parts[2:8]]
                    else:
                        continue
                except ValueError:
                    continue                            # header row or malformed
                aabbs.append((
                    depth, cls,
                    np.array(nums[0:3], dtype=np.float64),
                    np.array(nums[3:6], dtype=np.float64),
                ))
                continue

            if section == "overrides":
                parts = line.split(",")
                try:
                    if len(parts) >= 5:                 # legacy: pc,class,x,y,z
                        cls = int(parts[1]); vals = parts[2:5]
                    elif len(parts) == 4:               # world-v1: class,x,y,z
                        cls = int(parts[0]); vals = parts[1:4]
                    else:
                        continue
                    x, y, z = (float(v) for v in vals)
                except ValueError:
                    continue                            # header row or malformed
                ov_cls.append(cls); ov_x.append(x); ov_y.append(y); ov_z.append(z)
                continue

    xyz = (np.column_stack((ov_x, ov_y, ov_z)).astype(np.float64)
           if ov_cls else np.empty((0, 3), dtype=np.float64))
    cls = np.array(ov_cls, dtype=np.uint8) if ov_cls else np.empty(0, dtype=np.uint8)
    return aabbs, (xyz, cls), metadata


# ---------------------------------------------------------------
#  Apply edits to a single LAS file
# ---------------------------------------------------------------

def apply_edits_to_file(las_path, aabbs, override_xyz, override_class,
                        tolerance, output_path, dry_run=False):
    """Apply AABB bulk edits, then per-point overrides, to one LAS file.

    AABBs arrive pre-sorted shallow-to-deep, so applying them in order lets a
    deeper region overwrite the ancestor containing it. Overrides go last and
    take precedence over both.

    Returns (aabb_matched, override_matched, override_skipped, total_points).
    """
    las = laspy.read(str(las_path))
    las_xyz = np.column_stack((las.x, las.y, las.z))
    total_points = len(las.points)

    las_min = las_xyz.min(axis=0)
    las_max = las_xyz.max(axis=0)

    aabb_matched = 0
    override_matched = 0
    override_skipped = 0

    classification = np.asarray(las.classification)

    # -- Phase 1: AABBs --
    # Testing every AABB against every point is O(points x boxes), which at
    # ~13k boxes and millions of points per tile is the dominant cost. Sorting
    # the points once on X lets each box binary-search down to the slice that
    # can possibly contain it, so only Y and Z are tested per candidate.
    if aabbs:
        order = np.argsort(las_xyz[:, 0], kind="stable")
        xs = las_xyz[order, 0]

        for depth, cls, box_min, box_max in aabbs:
            if np.any(box_min > las_max) or np.any(box_max < las_min):
                continue

            lo = np.searchsorted(xs, box_min[0], side="left")
            hi = np.searchsorted(xs, box_max[0], side="right")
            if hi <= lo:
                continue

            cand = order[lo:hi]
            pts = las_xyz[cand]
            inside = (
                (pts[:, 1] >= box_min[1]) & (pts[:, 1] <= box_max[1]) &
                (pts[:, 2] >= box_min[2]) & (pts[:, 2] <= box_max[2])
            )
            hits = cand[inside]
            if hits.size == 0:
                continue

            if not dry_run:
                classification[hits] = cls
            aabb_matched += int(hits.size)

    # -- Phase 2: Overrides --
    if len(override_xyz) > 0:
        padded_min = las_min - tolerance
        padded_max = las_max + tolerance
        in_bounds = np.all(
            (override_xyz >= padded_min) & (override_xyz <= padded_max),
            axis=1
        )
        candidate_indices = np.flatnonzero(in_bounds)

        if candidate_indices.size > 0:
            tree = cKDTree(las_xyz)
            distances, indices = tree.query(override_xyz[candidate_indices])

            ok = distances <= tolerance
            if not dry_run and ok.any():
                classification[indices[ok]] = override_class[candidate_indices][ok]
            override_matched = int(ok.sum())
            override_skipped = int((~ok).sum())

    # -- Write output --
    modified = aabb_matched > 0 or override_matched > 0
    if modified and not dry_run:
        las.classification = classification
        las.write(str(output_path))

    return aabb_matched, override_matched, override_skipped, total_points


# ---------------------------------------------------------------
#  Main
# ---------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(
        description="Apply classification edits from the OH3D brush tool to LAS/LAZ files.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  %(prog)s ./las_tiles edits.csv.gz
  %(prog)s ./las_tiles ./edit_folder
  %(prog)s ./las_tiles edits.csv.gz --tolerance 0.05
  %(prog)s ./las_tiles edits.csv.gz --output-dir ./modified
  %(prog)s ./las_tiles edits.csv.gz --dry-run
        """
    )

    parser.add_argument("las_path", type=Path,
                        help="Single .las/.laz file or folder of tiles")
    parser.add_argument("edits_path", type=Path,
                        help="Single .csv/.csv.gz or folder of them, exported from the brush tool")
    parser.add_argument("--tolerance", type=float, default=0.01,
                        help="Max distance (meters) to match an override to a LAS point (default: 0.01)")
    parser.add_argument("--output-dir", type=Path, default=None,
                        help="Output directory for modified files (default: same as input)")
    parser.add_argument("--suffix", type=str, default="_modified",
                        help='Suffix for output filenames (default: _modified). Use "" to overwrite.')
    parser.add_argument("--dry-run", action="store_true",
                        help="Report matches without writing any files")

    args = parser.parse_args()

    # -- Find LAS files --
    if args.las_path.is_file():
        las_files = [args.las_path]
    elif args.las_path.is_dir():
        las_files = sorted(
            list(args.las_path.glob("*.las")) + list(args.las_path.glob("*.laz"))
        )
    else:
        print(f"Error: {args.las_path} is not a file or directory.")
        sys.exit(1)

    if not las_files:
        print(f"No .las or .laz files found in {args.las_path}")
        sys.exit(1)

    # -- Find edit files --
    if args.edits_path.is_file():
        edit_files = [args.edits_path]
    elif args.edits_path.is_dir():
        edit_files = sorted(
            p for p in args.edits_path.iterdir()
            if p.is_file() and p.name.endswith(EDIT_SUFFIXES)
        )
    else:
        print(f"Error: {args.edits_path} is not a file or directory.")
        sys.exit(1)

    if not edit_files:
        print(f"No .csv or .csv.gz files found in {args.edits_path}")
        sys.exit(1)

    all_aabbs = []
    xyz_parts, cls_parts = [], []

    for path in edit_files:
        print(f"Parsing {path.name}...")
        aabbs, (xyz, cls), metadata = parse_edits(path)
        all_aabbs.extend(aabbs)
        if len(xyz):
            xyz_parts.append(xyz)
            cls_parts.append(cls)

        contributor = metadata.get("contributor", "")
        tile = metadata.get("tile", "")
        info_parts = []
        if contributor:
            info_parts.append(f"by {contributor}")
        if tile:
            info_parts.append(f"tile {tile}")
        info = f" ({', '.join(info_parts)})" if info_parts else ""

        print(f"  {len(aabbs)} AABB regions, {len(xyz)} point overrides{info}")

    override_xyz = np.vstack(xyz_parts) if xyz_parts else np.empty((0, 3))
    override_class = (np.concatenate(cls_parts) if cls_parts
                      else np.empty(0, dtype=np.uint8))

    if not all_aabbs and len(override_xyz) == 0:
        print("\nNo edits found across all input files.")
        sys.exit(0)

    # Global depth sort. Within one exported file the rows already arrive in
    # this order, but merging several contributors concatenates their regions,
    # and a shallow box from a later file must not overwrite a deeper one from
    # an earlier file. Sorting here is what keeps the merge deterministic.
    all_aabbs.sort(key=lambda a: a[0])

    print(f"\nTotals: {len(all_aabbs)} AABB regions, {len(override_xyz)} point overrides")
    print(f"Processing {len(las_files)} LAS file(s)...\n")

    output_dir = args.output_dir
    if output_dir:
        output_dir.mkdir(parents=True, exist_ok=True)

    total_aabb = 0
    total_override = 0
    total_skipped = 0
    files_modified = 0
    start_time = time.time()

    if args.dry_run:
        print("-- DRY RUN (no files will be written) --\n")

    for las_path in las_files:
        out_dir = output_dir or las_path.parent
        output_path = out_dir / f"{las_path.stem}{args.suffix}{las_path.suffix}"

        aabb_matched, override_matched, override_skipped, num_points = apply_edits_to_file(
            las_path, all_aabbs, override_xyz, override_class,
            args.tolerance, output_path, args.dry_run
        )

        total_aabb += aabb_matched
        total_override += override_matched
        total_skipped += override_skipped

        if aabb_matched > 0 or override_matched > 0:
            files_modified += 1
            status = "WOULD WRITE" if args.dry_run else "WRITTEN"
            parts = []
            if aabb_matched:
                parts.append(f"{aabb_matched:,} via AABB")
            if override_matched:
                parts.append(f"{override_matched:,} via override")
            if override_skipped:
                parts.append(f"{override_skipped:,} skipped")
            print(f"  {las_path.name}: {', '.join(parts)} ({num_points:,} pts) -> {status}")
        else:
            print(f"  {las_path.name}: no matching edits, skipped")

    elapsed = time.time() - start_time
    print(f"\n{'-' * 54}")
    print(f"  Files scanned:       {len(las_files)}")
    print(f"  Files modified:      {files_modified}")
    print(f"  Points via AABB:     {total_aabb:,}")
    print(f"  Points via override: {total_override:,}")
    print(f"  Overrides skipped:   {total_skipped:,}")
    print(f"  Time:                {elapsed:.1f}s")
    print(f"{'-' * 54}")

    if total_skipped > 0 and not args.dry_run:
        pct = total_skipped / (total_override + total_skipped) * 100
        print(f"\n  {pct:.1f}% of overrides exceeded the {args.tolerance}m tolerance.")
        print(f"  Try increasing --tolerance if coordinate transforms introduce drift.")


if __name__ == "__main__":
    main()


# ---------------------------------------------------------------
#  Note on AABB counting
# ---------------------------------------------------------------
# aabb_matched counts points touched, not points finally classified by an
# AABB: a point inside nested regions is counted once per region, and a point
# later corrected by an override is still counted here. The number is a
# coverage indicator, not a partition of the cloud.
