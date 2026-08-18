# classification_injector.py

Applies classification edits made with the OH3D Potree brush tool to the
original LAS/LAZ files. Consumes the brush panel's **Full Export** CSV
(`#FORMAT,python`) — AABBs for implicit regions plus world-space `(x, y, z)`
coordinates for explicit per-point overrides. The **Browser Export** format
(`#FORMAT,browser`) has no world coordinates and is for re-importing into the
viewer only; pointing this script at one produces a warning and no edits.

## Install

```bash
pip install -r requirements.txt
```

## Run

```bash
python classification_injector.py ./las_tiles classification_edits.csv
```

## Usage

```bash
# Basic — writes *_modified.las alongside originals
python classification_injector.py ./las_tiles classification_edits.csv

# Tighter tolerance for matching overrides to LAS points
python classification_injector.py ./las_tiles classification_edits.csv --tolerance 0.005

# Output to a separate folder
python classification_injector.py ./las_tiles classification_edits.csv --output-dir ./modified

# Overwrite originals in place (no suffix)
python classification_injector.py ./las_tiles classification_edits.csv --suffix ""

# Preview match counts without writing anything
python classification_injector.py ./las_tiles classification_edits.csv --dry-run
```

`las_path` and `edits_csv` each accept either a single file or a folder.
A folder of CSVs is merged before being applied — useful when several
contributors each exported their own edits for the same dataset.

## How edits are applied

1. **AABBs first.** Every LAS point falling inside an exported bounding box
   is set to that region's classification.
2. **Overrides second, and they win.** Each override's world position is
   matched to the nearest LAS point via a KD-tree; if the nearest point is
   within `--tolerance` meters (default `0.01`), it's reclassified. This
   tolerance exists because floating-point coordinates round-trip through
   the browser (draw call precision, `matrixWorld` transforms) and can pick
   up a small amount of drift — points that fail to match within tolerance
   are reported as skipped rather than silently misapplied.

## Requirements

- Python 3.8+
- `laspy`, `numpy`, `scipy` (see `requirements.txt`)
