# rc_calibration_to_potree.py

Converts a RealityCapture **Internal/External camera parameters** CSV
(`#name,x,y,alt,heading,pitch,roll,f,px,py,k1,k2,k3,k4,t1,t2`) into the
calibrations XML that Potree's `OrientedImageLoader` reads as `cameraParams`.
It writes one `<calibration id="...">` per image, in the same order as the
image rows of the camera reference (`imageParams`) file it will be paired
with. The loader matches calibration *k* to image row *k* and checks the ids.

Unlike the older width/height/f-only XMLs, the output keeps the principal
point and lens distortion.

## Install

```bash
pip install -r requirements.txt
```

## Run

```bash
python rc_calibration_to_potree.py exterior_cal.csv \
    --reference exterior_photos_camera_reference.txt \
    --lst exterior_7_cmon_already.lst \
    -o exterior_photos_cameras_distortion.xml
```

## Usage

```bash
# Only the images of one reference file, in its row order (recommended)
python rc_calibration_to_potree.py cal.csv --reference ref.txt -o out.xml

# Images were renamed after RealityCapture: line i of the .lst names CSV row i
python rc_calibration_to_potree.py cal.csv --reference ref.txt --lst images.lst -o out.xml

# No reference file: every CSV row, ids from the CSV name column
python rc_calibration_to_potree.py cal.csv --images ./images -o out.xml

# Normalise by image width instead of the longer side (see below)
python rc_calibration_to_potree.py cal.csv --reference ref.txt --normalize width -o out.xml
```

Image sizes are read from the image files, by default from the reference
file's folder, which is where the viewer loads them from. A missing image is
an error, because a skipped calibration would shift every later pairing. An
existing output file is only replaced with `--force`.

## Output convention

Fields follow Agisoft Metashape's calibration convention, so these files and
Metashape's per-image calibration exports hold the same quantities:

| Tag | Meaning |
|---|---|
| `f` | focal length, pixels |
| `cx`, `cy` | principal point offset from the image centre, pixels, y down |
| `k1`..`k4` | radial distortion on focal-normalised coordinates (X/Z, Y/Z) |
| `p1`, `p2` | tangential distortion, Metashape order (`p1` pairs with r² + 2x²) |

Zero terms are left out.

## Conversion from RealityCapture

RealityCapture expresses intrinsics relative to a 36 mm frame. With `L` the
longer image side in pixels:

```
f  = f35 * L / 36
cx = px * L          cy = py * L
k1..k4 unchanged     p1 = t1, p2 = t2
```

- **Focal length.** This reproduces the `f` values already in the D6VP4Z
  camera XMLs exactly.
- **Principal point, radial and tangential terms.** These follow Fraunhofer
  camorph's RealityCapture reader.
- **Portrait images.** camorph normalises by image width rather than the
  longer side; `--normalize width` switches to that. The two differ only for
  portrait images. If portrait photos come out scaled wrong against the point
  cloud while landscape ones fit, try `width`.
- **Tangential terms.** The t1/t2 → p1/p2 mapping is unverified (D6VP4Z has
  no non-zero t1/t2), so the script warns when it writes any.

## Warnings

- **Corner distortion.** The script flags an image when its radial model
  moves the image corner by more than 10% of the corner's radius, or folds
  over inside the image (stops increasing, so it cannot be inverted). Both
  usually mean the polynomial was extrapolated beyond where the solve had
  tie points. Check those images, and clamp or skip distortion for them when
  rendering.
- **EXIF rotation.** Images with a 90° EXIF rotation are reported. Browsers
  display them with width and height swapped.

## Requirements

- Python 3.8+
- `Pillow` (see `requirements.txt`)
