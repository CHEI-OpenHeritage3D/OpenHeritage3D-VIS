#!/usr/bin/env python3
"""
rc_calibration_to_potree.py

Author: Aviral Agarwal
Cultural Heritage Engineering Initiative (UC San Diego)

Converts a RealityCapture "Internal/External camera parameters" CSV export

    #name,x,y,alt,heading,pitch,roll,f,px,py,k1,k2,k3,k4,t1,t2

into the cameraParams XML read by Potree's OrientedImageLoader: a
<calibrations> file with one <calibration id="..."> block per image, listed
in the same order as the image rows of the matching imageParams (camera
reference) file. The loader pairs calibration k with image row k and checks
the ids.

Output uses the Agisoft Metashape calibration convention, the same one as the
per-image calibration XMLs Metashape exports, so every oriented-image set in
the viewer carries one convention:

    <f>         focal length, pixels
    <cx> <cy>   principal point offset from the image centre, pixels (y down)
    <k1>..<k4>  radial distortion on focal-normalised coordinates (X/Z, Y/Z)
    <p1> <p2>   tangential distortion, Metashape order (p1 pairs with r^2 + 2x^2)

Terms that are zero are left out, as Metashape does.

RealityCapture values are relative to a 36 mm frame. With L the longer image
side in pixels (--normalize width uses the width instead):

    f  = f35 * L / 36
    cx = px * L,   cy = py * L
    k1..k4 copied unchanged
    p1 = t1,       p2 = t2

The principal point, radial and tangential mapping follow Fraunhofer camorph's
RealityCapture reader. camorph normalises by the image width; the default here
is the longer side, which reproduces the focal lengths already in the D6VP4Z
camera XMLs and matches the 35 mm convention. The two only differ for portrait
images. The tangential mapping has not been checked against data with non-zero
t1/t2, so the script warns when it meets any.

Image sizes are read from the image files (Pillow). By default they are looked
up next to the reference file, which is where the viewer loads them from.

Usage:
    python rc_calibration_to_potree.py <cal_csv> -o <out_xml> [options]

Examples:
    # Calibrations for the images of one reference file, ids from a .lst
    python rc_calibration_to_potree.py exterior_cal.csv \\
        --reference exterior_photos_camera_reference.txt \\
        --lst exterior_7_cmon_already.lst \\
        -o exterior_photos_cameras_distortion.xml

    # Every CSV row, in CSV order, ids taken from the CSV name column
    python rc_calibration_to_potree.py cameras.csv --images ./images -o cameras.xml

Dependencies:
    pip install Pillow
"""

import argparse
import csv
import math
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from xml.sax.saxutils import quoteattr

try:
    from PIL import Image
except ImportError as e:
    print(f"Missing dependency: {e.name}")
    print("Run: pip install Pillow")
    sys.exit(1)


RC_COLUMNS = ["name", "x", "y", "alt", "heading", "pitch", "roll",
              "f", "px", "py", "k1", "k2", "k3", "k4", "t1", "t2"]

FRAME_MM = 36.0            # RealityCapture's 35 mm frame, long side

CORNER_LIMIT = 0.10        # radial distortion moving the image corner by more than 10% of its radius


# ---------------------------------------------------------------
#  Parse inputs
# ---------------------------------------------------------------

def parse_rc_csv(path):
    """Parse a RealityCapture camera CSV into a list of dicts.

    Column positions come from the "#name,..." header line when there is one,
    otherwise the standard RC_COLUMNS order is assumed. Missing distortion
    columns read as 0.
    """
    columns = RC_COLUMNS
    cameras = []

    with open(path, mode="r", encoding="utf-8-sig", newline="") as f:
        for parts in csv.reader(f):
            if not parts or not parts[0].strip():
                continue
            if parts[0].startswith("#"):
                if parts[0].strip().lower() == "#name":
                    columns = [p.strip().lstrip("#").lower() for p in parts]
                continue

            row = dict(zip(columns, (p.strip() for p in parts)))
            if not all(row.get(key) for key in ("f", "px", "py")):
                sys.exit(f"{path.name}: camera row {len(cameras)} has no f/px/py: {parts}")

            cam = {"name": row.get("name", "")}
            for key in ("f", "px", "py", "k1", "k2", "k3", "k4", "t1", "t2"):
                cam[key] = float(row[key]) if row.get(key) else 0.0
            cameras.append(cam)

    return cameras


def parse_lst(path):
    """Image list (RealityCapture / Bundler .lst): one file name per camera row."""
    names = []
    with open(path, mode="r", encoding="utf-8-sig") as f:
        for line in f:
            line = line.strip()
            if line:
                names.append(Path(line.split()[0].replace("\\", "/")).name)
    return names


JS_FLOAT_PREFIX = re.compile(r"\s*[+-]?(?:Infinity|\d+\.?\d*(?:[eE][+-]?\d+)?|\.\d+(?:[eE][+-]?\d+)?)")


def parse_reference_ids(path):
    """Image ids of a camera reference file, in the order the viewer sees them.

    Mirrors OrientedImageLoader.loadImageParams: the first line is always a
    header, '#' lines are skipped, a line is split on runs of tabs if it has a
    tab, else on ',' if it has one, else on whitespace, and it is an image row
    when JavaScript's parseFloat reads a number from its second column (a
    leading-digits prefix is enough). Rows the loader later skips for having
    < 7 columns still count, because calibrations are matched on row position.

    A space-separated file cannot hold image names with spaces, and a
    comma-separated one names with commas; those rows come apart in the split
    and are dropped or read with a wrong id.
    """
    ids = []
    with open(path, mode="r", encoding="utf-8-sig") as f:
        lines = f.read().splitlines()

    for line in lines[1:]:
        if line.startswith("#"):
            continue
        if "\t" in line:
            tokens = re.split(r"\t+", line)
        elif "," in line:
            tokens = line.split(",")
        else:
            tokens = re.split(r"\s+", line)
        if len(tokens) > 1 and JS_FLOAT_PREFIX.match(tokens[1]):
            ids.append(tokens[0])

    return ids


# ---------------------------------------------------------------
#  Convert
# ---------------------------------------------------------------

def image_size(path):
    """(width, height) of an image file, and whether EXIF says it is rotated 90 degrees."""
    with Image.open(path) as im:
        orientation = im.getexif().get(0x0112, 1)
        return im.size, orientation in (5, 6, 7, 8)


def to_calibration(cam, width, height, normalize):
    """RealityCapture intrinsics -> Metashape-convention calibration fields."""
    scale = max(width, height) if normalize == "long" else width

    return {
        "width": width,
        "height": height,
        "f": cam["f"] * scale / FRAME_MM,
        "cx": cam["px"] * scale,
        "cy": cam["py"] * scale,
        "k1": cam["k1"],
        "k2": cam["k2"],
        "k3": cam["k3"],
        "k4": cam["k4"],
        "p1": cam["t1"],
        "p2": cam["t2"],
    }


def corner_check(cal):
    """Radial distortion at the image corner, and whether it folds over before it.

    Returns (shift, folds). shift is the relative radial displacement at the
    corner. folds is True when r * (1 + k1 r^2 + ... + k4 r^8) stops increasing
    inside the image, so two radii map to one and the model cannot be inverted
    there. Either usually means the polynomial was extrapolated past the area
    the solve had tie points in.
    """
    r_corner = math.hypot(cal["width"] / 2, cal["height"] / 2) / cal["f"]
    k1, k2, k3, k4 = cal["k1"], cal["k2"], cal["k3"], cal["k4"]

    shift = k1 * r_corner**2 + k2 * r_corner**4 + k3 * r_corner**6 + k4 * r_corner**8
    folds = any(1 + 3 * k1 * r**2 + 5 * k2 * r**4 + 7 * k3 * r**6 + 9 * k4 * r**8 <= 0
                for r in (r_corner * j / 100 for j in range(101)))
    return shift, folds


def write_calibrations(path, entries):
    """entries: list of (id, calibration dict). Zero terms are omitted."""
    date = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    out = ['<?xml version="1.0" encoding="UTF-8"?>', "<calibrations>"]

    for image_id, cal in entries:
        out.append(f"  <calibration id={quoteattr(image_id)}>")
        out.append("    <projection>frame</projection>")
        out.append(f"    <width>{cal['width']}</width>")
        out.append(f"    <height>{cal['height']}</height>")
        out.append(f"    <f>{cal['f']!r}</f>")
        for tag in ("cx", "cy", "k1", "k2", "k3", "k4", "p1", "p2"):
            if cal[tag] != 0.0:
                out.append(f"    <{tag}>{cal[tag]!r}</{tag}>")
        out.append(f"    <date>{date}</date>")
        out.append("  </calibration>")

    out.append("</calibrations>")
    path.write_text("\n".join(out) + "\n", encoding="utf-8")


# ---------------------------------------------------------------
#  Main
# ---------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(
        description="Convert a RealityCapture camera CSV into a Potree oriented-image calibrations XML.")
    parser.add_argument("cal_csv", type=Path,
                        help="RealityCapture 'Internal/External camera parameters' CSV")
    parser.add_argument("-o", "--output", type=Path, required=True,
                        help="calibrations XML to write")
    parser.add_argument("--reference", type=Path,
                        help="camera reference (imageParams) file; its image rows set which images "
                             "are written and in what order (default: every CSV row, in CSV order)")
    parser.add_argument("--lst", type=Path,
                        help="image list whose line i names the image of CSV row i "
                             "(default: the CSV name column)")
    parser.add_argument("--images", type=Path,
                        help="folder holding the image files (default: the reference file's folder, "
                             "else the CSV's folder)")
    parser.add_argument("--normalize", choices=["long", "width"], default="long",
                        help="image side RealityCapture's 36 mm frame maps to (default: long)")
    parser.add_argument("--force", action="store_true",
                        help="overwrite the output file if it exists")
    args = parser.parse_args()

    if args.output.exists() and not args.force:
        sys.exit(f"{args.output} exists; pass --force to overwrite it")

    cameras = parse_rc_csv(args.cal_csv)
    print(f"{args.cal_csv.name}: {len(cameras)} camera rows")

    if args.lst:
        names = parse_lst(args.lst)
        if len(names) != len(cameras):
            sys.exit(f"{args.lst.name} lists {len(names)} images for {len(cameras)} CSV rows")
    else:
        names = [Path(cam["name"].replace("\\", "/")).name for cam in cameras]

    by_id = {}
    for name, cam in zip(names, cameras):
        if name in by_id:
            sys.exit(f"image id {name!r} appears twice")
        by_id[name] = cam

    if args.reference:
        ids = parse_reference_ids(args.reference)
        print(f"{args.reference.name}: {len(ids)} image rows")
        missing = [i for i in ids if i not in by_id]
        if missing:
            sys.exit(f"{len(missing)} reference image(s) have no CSV row: {', '.join(missing[:10])}")
    else:
        ids = names

    images_dir = args.images or (args.reference or args.cal_csv).parent

    entries, unreadable, rotated = [], [], []
    for image_id in ids:
        try:
            (width, height), is_rotated = image_size(images_dir / image_id)
        except OSError:
            unreadable.append(image_id)
            continue
        if is_rotated:
            rotated.append(image_id)
        entries.append((image_id, to_calibration(by_id[image_id], width, height, args.normalize)))

    if unreadable:
        # Every image row needs its calibration, or the loader pairs them up wrongly.
        sys.exit(f"{len(unreadable)} image(s) missing or unreadable in {images_dir}: "
                 f"{', '.join(unreadable[:10])}")

    write_calibrations(args.output, entries)

    count = lambda tags: sum(1 for _, cal in entries if any(cal[t] != 0.0 for t in tags))
    print(f"wrote {args.output.name}: {len(entries)} calibrations (normalised by {args.normalize} side)")
    print(f"  principal point (cx, cy): {count(['cx', 'cy'])}")
    print(f"  radial (k1..k4):          {count(['k1', 'k2', 'k3', 'k4'])}")
    print(f"  tangential (p1, p2):      {count(['p1', 'p2'])}")

    if count(["p1", "p2"]):
        print("  Warning: non-zero t1/t2 were written as p1/p2. That mapping follows camorph and")
        print("           has not been checked against real data; verify the alignment.")
    for image_id, cal in entries:
        shift, folds = corner_check(cal)
        if folds or abs(shift) > CORNER_LIMIT:
            print(f"  Warning: {image_id}: radial distortion moves the corner {shift:+.0%}"
                  f"{' and folds over inside the image' if folds else ''}; check the solve")
    if rotated:
        print(f"  Warning: {len(rotated)} image(s) carry an EXIF 90-degree rotation, so browsers show "
              f"them with width and height swapped: {', '.join(rotated[:10])}")


if __name__ == "__main__":
    main()
