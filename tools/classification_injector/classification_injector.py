#!/usr/bin/env python3
"""
classification_injector.py

Author: Aviral Agarwal
ALERTCalifornia, Cultural Heritage Engineering Initiative (UC San Diego)

Applies classification edits exported from the OH3D Potree brush tool
to original LAS/LAZ files. Supports the two-tier edit format:

  1. AABBs     - bulk regions where every point within a bounding box
                 receives a uniform classification (from implicit ledger entries).
  2. Overrides - individual points matched by world-space position via
                 KD-tree nearest-neighbor lookup (from explicit/hybrid ledger entries).

AABBs are applied first; overrides are applied second and take precedence.
This mirrors the ledger semantics: implicit regions define a baseline,
and per-point overrides correct boundary points on top.

The brush tool's "Full Export" (CSV format "python") is the only export
this script consumes. The "Browser Export" (CSV format "browser") has no
world-space positions and is meant for re-importing into the viewer only;
if pointed at a browser-format CSV, this script will skip it with a warning.

Usage:
    python classification_injector.py <las_path> <edits_csv> [options]

    <las_path> can be a single .las/.laz file or a folder of tiles.
    <edits_csv> can be a single CSV or a folder of CSVs (all are merged).

Examples:
    python classification_injector.py ./las_tiles classification_edits.csv
    python classification_injector.py ./las_tiles ./csv_folder
    python classification_injector.py scan.las edits.csv --tolerance 0.05
    python classification_injector.py ./las_tiles edits.csv --output-dir ./modified
    python classification_injector.py ./las_tiles edits.csv --dry-run

Dependencies:
    pip install laspy numpy scipy
"""

import argparse
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


# ---------------------------------------------------------------
#  Parse edits CSV ("python" / full-export format)
# ---------------------------------------------------------------

def parse_edits(csv_path):
    """Parse a Full-Export CSV produced by the brush tool's exportPythonCSV().

    Expected structure (section markers on their own line):
        #FORMAT,python
        #METADATA ... #END_METADATA
        #CLASSIFICATIONS ... #END_CLASSIFICATIONS   (optional, ignored here)
        #AABBS
        pc,node,classification,min_x,min_y,min_z,max_x,max_y,max_z
        ...
        #END_AABBS
        #OVERRIDES
        pc,classification,x,y,z
        ...
        #END_OVERRIDES

    Returns:
        aabbs:     list of dicts {pc, node, classification, min_xyz, max_xyz}
        overrides: list of dicts {pc, classification, x, y, z}
        metadata:  dict of metadata key-value pairs
    """
    aabbs = []
    overrides = []
    metadata = {}

    section = None          # None | "metadata" | "aabbs" | "overrides"
    header_seen = False     # skip the column-header line in each section

    with open(csv_path, mode="r", newline="", encoding="utf-8-sig") as f:
        for raw_line in f:
            line = raw_line.strip()
            if not line:
                continue

            # -- Section markers --
            if line.startswith("#FORMAT,"):
                fmt = line.split(",", 1)[1].strip()
                if fmt == "browser":
                    print(f"  Warning: {csv_path.name} is a browser-format CSV (no positions).")
                    print(f"           Use the 'Full Export' from the brush panel instead.")
                    return [], [], {}
                continue
            if line == "#METADATA":
                section = "metadata"
                continue
            if line == "#END_METADATA":
                section = None
                continue
            if line == "#AABBS":
                section = "aabbs"
                header_seen = False
                continue
            if line == "#END_AABBS":
                section = None
                continue
            if line == "#OVERRIDES":
                section = "overrides"
                header_seen = False
                continue
            if line == "#END_OVERRIDES":
                section = None
                continue

            # -- Skip comment lines (includes #CLASSIFICATIONS block) --
            if line.startswith("#"):
                continue

            # -- Parse by section --
            if section == "metadata":
                idx = line.index(",") if "," in line else -1
                if idx != -1:
                    metadata[line[:idx].strip()] = line[idx + 1:].strip()
                continue

            if section == "aabbs":
                if not header_seen:
                    header_seen = True
                    if line.startswith("pc,"):
                        continue
                parts = [p.strip() for p in line.split(",")]
                if len(parts) < 9:
                    continue
                try:
                    aabbs.append({
                        "pc":             parts[0],
                        "node":           parts[1],
                        "classification": int(parts[2]),
                        "min_xyz":        np.array([float(parts[3]), float(parts[4]), float(parts[5])]),
                        "max_xyz":        np.array([float(parts[6]), float(parts[7]), float(parts[8])]),
                    })
                except ValueError:
                    continue
                continue

            if section == "overrides":
                if not header_seen:
                    header_seen = True
                    if line.startswith("pc,"):
                        continue
                parts = [p.strip() for p in line.split(",")]
                if len(parts) < 5:
                    continue
                try:
                    overrides.append({
                        "pc":             parts[0],
                        "classification": int(parts[1]),
                        "x":              float(parts[2]),
                        "y":              float(parts[3]),
                        "z":              float(parts[4]),
                    })
                except ValueError:
                    continue
                continue

            # Anything outside a recognized section is ignored (e.g. stray
            # blank markers). The legacy pre-section browser dump format
            # (bracketed pointcloud/node markers, no world positions) can't
            # be converted to LAS edits at all, so it is not handled here.

    return aabbs, overrides, metadata


# ---------------------------------------------------------------
#  Apply edits to a single LAS file
# ---------------------------------------------------------------

def apply_edits_to_file(las_path, aabbs, override_xyz, override_class,
                        tolerance, output_path, dry_run=False):
    """Apply AABB bulk edits and per-point overrides to a single LAS file.

    AABBs are applied first (all points inside the box get the class).
    Overrides are applied second and take precedence.

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

    # -- Phase 1: AABBs (bulk regions) --
    for aabb in aabbs:
        # Quick reject: does the AABB overlap this file's extent at all?
        if np.any(aabb["min_xyz"] > las_max) or np.any(aabb["max_xyz"] < las_min):
            continue

        # Find all LAS points inside this AABB
        inside = np.all(
            (las_xyz >= aabb["min_xyz"]) & (las_xyz <= aabb["max_xyz"]),
            axis=1
        )
        count = np.count_nonzero(inside)
        if count == 0:
            continue

        if not dry_run:
            las.classification[inside] = aabb["classification"]
        aabb_matched += count

    # -- Phase 2: Overrides (per-point, KD-tree) --
    if len(override_xyz) > 0:
        # Filter overrides to those within this file's bounds (+ tolerance)
        padded_min = las_min - tolerance
        padded_max = las_max + tolerance
        in_bounds = np.all(
            (override_xyz >= padded_min) & (override_xyz <= padded_max),
            axis=1
        )
        candidate_indices = np.where(in_bounds)[0]

        if len(candidate_indices) > 0:
            tree = cKDTree(las_xyz)
            candidate_xyz = override_xyz[candidate_indices]
            candidate_class = override_class[candidate_indices]

            distances, indices = tree.query(candidate_xyz)

            for i in range(len(candidate_indices)):
                if distances[i] <= tolerance:
                    if not dry_run:
                        las.classification[indices[i]] = candidate_class[i]
                    override_matched += 1
                else:
                    override_skipped += 1

    # -- Write output --
    modified = aabb_matched > 0 or override_matched > 0
    if modified and not dry_run:
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
  %(prog)s ./las_tiles edits.csv
  %(prog)s ./las_tiles ./csv_folder
  %(prog)s ./las_tiles edits.csv --tolerance 0.05
  %(prog)s ./las_tiles edits.csv --output-dir ./modified
  %(prog)s ./las_tiles edits.csv --dry-run
        """
    )

    parser.add_argument("las_path", type=Path,
                        help="Single .las/.laz file or folder of tiles")
    parser.add_argument("edits_path", type=Path,
                        help="Single CSV or folder of CSVs exported from the brush tool")
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

    # -- Find and parse CSV(s) --
    if args.edits_path.is_file():
        csv_files = [args.edits_path]
    elif args.edits_path.is_dir():
        csv_files = sorted(args.edits_path.glob("*.csv"))
    else:
        print(f"Error: {args.edits_path} is not a file or directory.")
        sys.exit(1)

    if not csv_files:
        print(f"No .csv files found in {args.edits_path}")
        sys.exit(1)

    all_aabbs = []
    all_overrides = []

    for csv_path in csv_files:
        print(f"Parsing {csv_path.name}...")
        aabbs, overrides, metadata = parse_edits(csv_path)
        all_aabbs.extend(aabbs)
        all_overrides.extend(overrides)

        contributor = metadata.get("contributor", "")
        tile = metadata.get("tile", "")
        info_parts = []
        if contributor:
            info_parts.append(f"by {contributor}")
        if tile:
            info_parts.append(f"tile {tile}")
        info = f" ({', '.join(info_parts)})" if info_parts else ""

        print(f"  {len(aabbs)} AABB regions, {len(overrides)} point overrides{info}")

    if not all_aabbs and not all_overrides:
        print("\nNo edits found across all CSVs.")
        sys.exit(0)

    # Prepare override arrays for vectorized operations
    if all_overrides:
        override_xyz = np.array([[o["x"], o["y"], o["z"]] for o in all_overrides])
        override_class = np.array([o["classification"] for o in all_overrides], dtype=np.uint8)
    else:
        override_xyz = np.empty((0, 3))
        override_class = np.empty(0, dtype=np.uint8)

    print(f"\nTotals: {len(all_aabbs)} AABB regions, {len(all_overrides)} point overrides")
    print(f"Processing {len(las_files)} LAS file(s)...\n")

    # -- Set up output directory --
    output_dir = args.output_dir
    if output_dir:
        output_dir.mkdir(parents=True, exist_ok=True)

    # -- Process each file --
    total_aabb = 0
    total_override = 0
    total_skipped = 0
    files_modified = 0
    start_time = time.time()

    if args.dry_run:
        print("-- DRY RUN (no files will be written) --\n")

    for las_path in las_files:
        stem = las_path.stem
        ext = las_path.suffix
        out_dir = output_dir or las_path.parent
        output_path = out_dir / f"{stem}{args.suffix}{ext}"

        aabb_matched, override_matched, override_skipped, num_points = apply_edits_to_file(
            las_path, all_aabbs, override_xyz, override_class,
            args.tolerance, output_path, args.dry_run
        )

        total_aabb += aabb_matched
        total_override += override_matched
        total_skipped += override_skipped

        modified = aabb_matched > 0 or override_matched > 0
        if modified:
            files_modified += 1
            status = "WRITTEN" if not args.dry_run else "WOULD WRITE"
            parts = []
            if aabb_matched:
                parts.append(f"{aabb_matched:,} via AABB")
            if override_matched:
                parts.append(f"{override_matched:,} via override")
            if override_skipped:
                parts.append(f"{override_skipped:,} skipped")
            detail = ", ".join(parts)
            print(f"  {las_path.name}: {detail} ({num_points:,} pts) -> {status}")
        else:
            print(f"  {las_path.name}: no matching edits, skipped")

    # -- Summary --
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
