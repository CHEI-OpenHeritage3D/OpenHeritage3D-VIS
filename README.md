# OpenHeritage3D-VIS

*A browser-based Potree viewer template for cultural heritage point clouds — with a classification brush, zone-based navigation, tiled downloads, and oriented-image panoramas layered on top of stock [Potree](https://github.com/potree/potree).*

[![License: BSD-2-Clause](https://img.shields.io/badge/License-BSD--2--Clause-blue.svg)](LICENSE)
[![Built on Potree](https://img.shields.io/badge/built%20on-Potree-6a5acd.svg)](https://github.com/potree/potree)

![Hero screenshot — viewer overview](docs/media/hero-overview.png)

This repository is developed by the [Cultural Heritage Engineering Initiative (CHEI)](https://alertcalifornia.org) at UC San Diego and is published alongside an academic paper describing its classification workflow. See [Citing this work](#citing-this-work).

---

## Table of Contents

1. [What this is](#what-this-is)
2. [Feature overview](#feature-overview)
3. [⭐ Classification Brush](#-classification-brush)
4. [Zone-Based Navigation](#zone-based-navigation)
5. [Layer Map — alternate datasets per zone](#layer-map--alternate-datasets-per-zone)
6. [Point Cloud Download Tool](#point-cloud-download-tool)
7. [Oriented Images / 360° Panorama Mode](#oriented-images--360-panorama-mode)
8. [Transform Controls & Tools Menu](#transform-controls--tools-menu)
9. [Shareable Camera Links](#shareable-camera-links)
10. [Floating Panel System](#floating-panel-system)
11. [Getting Started](#getting-started)
12. [Classification Ledger → LAS Patch Script](#classification-ledger--las-patch-script)
13. [Architecture Notes](#architecture-notes)
14. [Repository Layout](#repository-layout)
15. [Citing This Work](#citing-this-work)
16. [License](#license)

---

## What this is

[Potree](https://github.com/potree/potree) is an open-source WebGL point cloud renderer built for out-of-core streaming of massive octree-organized datasets. This repository is a **template built on top of a patched Potree core** (see [Architecture Notes](#architecture-notes)), adding a set of tools written for cultural heritage documentation workflows — annotating, navigating, and distributing terrestrial/aerial LiDAR and photogrammetry scans of heritage sites.

Everything here is static, client-side JavaScript. There is no backend, no database, no accounts — a viewer instance is just this repository served over HTTP, pointed at one or more Potree octrees.

## Feature overview

| Feature | Summary |
|---|---|
| [Classification Brush](#-classification-brush) | Paint LAS/LAZ classification codes directly onto the point cloud in-browser, with an edit ledger that can be exported and applied back to the source files. |
| [Zones](#zone-based-navigation) | Camera-collision-triggered regions that show/hide point clouds and annotations as you move through a site. |
| [Layer Map](#layer-map--alternate-datasets-per-zone) | Toggle between alternate scans/datasets (e.g. different capture dates or sensors) covering the same physical space. |
| [Download Tool](#point-cloud-download-tool) | Export any clipped selection as tiled LAS files, entirely in-browser, with a level-of-detail cap. |
| [Oriented Images](#oriented-images--360-panorama-mode) | Lock the camera to a photo's captured pose and cross-fade it against the point cloud. |
| [360° Panoramas](#oriented-images--360-panorama-mode) | Spherical panorama markers rendered with photo-sphere-viewer. |
| [Transform Controls](#transform-controls--tools-menu) | Move/rotate/scale a loaded point cloud with an on-screen gizmo (registration / alignment). |
| [Shareable Links](#shareable-camera-links) | Camera pose and zone/visibility state round-trip through the URL. |

---

## ⭐ Classification Brush

![Classification brush demo](docs/media/brush-paint-demo.gif)

The classification brush is the centerpiece of this template and the subject of the paper this repository accompanies. It lets a user reclassify LAS/LAZ points (ground, building, vegetation, noise, custom site-specific classes, …) by painting directly on the rendered point cloud, without ever downloading the source data — classification happens against Potree's already-streamed octree nodes in the browser.

**How edits are tracked.** Every edit is recorded in an in-memory *ledger*, keyed by point cloud and octree node, using one of three entry shapes:

- **Implicit** — an entire node is marked with a single classification (used when a brush stroke fully covers a node's bounding box; the node doesn't need to be loaded to be marked).
- **Per-point override** — an explicit map of individual point indices to classifications (used at stroke boundaries, where only part of a node is affected).
- **Hybrid** — an implicit baseline classification for the node, plus per-point overrides on top of it.

Potree's node-naming convention (child node names are prefixes of their parent, e.g. `r0` → `r03` → `r031`) lets a coarse implicit mark at one level of the octree apply as the baseline for every node loaded beneath it later, without re-walking the tree.

**Traversal strategy.** A brush stroke's bounding volume is matched against the octree in three tiers, so that reclassifying a large region never requires loading it:

1. **Prune** — nodes whose bounding box doesn't intersect the stroke are skipped entirely.
2. **Full containment** — nodes fully inside the stroke are marked implicitly, with no node load required.
3. **Boundary** — nodes that only partially overlap the stroke are loaded and inspected per-point.

Reconciliation with newly streamed-in geometry is event-driven, hooked into Potree's own node-load completion callback, so edits apply the instant a node finishes loading rather than on a polling timer.

**Safety and cleanup features:**

- A per-class visibility gate prevents a bulk edit from silently overwriting points in a classification the user has currently hidden.
- A post-stroke promotion pass compacts per-point overrides back into implicit node-level marks where a stroke ends up covering a full node, keeping the ledger small.
- Large clip volumes can be split into an *N×N* grid of sub-tiles (A1, A2, B1, …) for distributing classification work across multiple contributors or sessions.

**Import / export.** The ledger can be exported as CSV in two formats:

- **Browser export** — a compact re-importable dump (no world coordinates) for continuing work in another session, or merging edits from multiple contributors. Supports importing several CSVs at once.
- **Full export** — AABBs for implicit regions plus world-space `(x, y, z)` coordinates for every explicit override. This is the format consumed by the [classification ledger → LAS patch script](#classification-ledger--las-patch-script) to apply edits back to the original LAS/LAZ files.

![Ledger export/import demo](docs/media/brush-ledger-export-import.gif)
![Tiled work distribution demo](docs/media/brush-work-distribution.gif)

---

## Zone-Based Navigation

![Zone transition demo](docs/media/zone-transition.gif)

A **zone** bundles a name, one or more trigger bounding boxes, a list of point clouds to show/hide, and optional annotations for points of interest inside it (e.g. individual artifacts or architectural features within a room). Zones activate automatically as the camera crosses their trigger volume, so moving through a multi-scan site swaps in the relevant point clouds without a manual toggle.

A read-only zone/annotation browser tree lets users search by name and jump straight to a location — selecting a result flies the camera there and the corresponding zone activates on arrival.

![Zone search demo](docs/media/zone-search.gif)

Zones are visualized with animated, glowing beacon markers (pulsing wireframe icosahedra) so points of interest are visible from a distance before the camera triggers the zone itself.

![Zone beacon demo](docs/media/zone-beacon.gif)

## Layer Map — alternate datasets per zone

![Layer map demo](docs/media/layer-map-toggle.gif)

Within a zone, the Layer Map panel lets a user define selectable sub-regions and toggle between alternate point cloud layers covering the same physical space — for example switching between scans from different capture dates, sensors, or processing passes without leaving the viewer.

## Point Cloud Download Tool

![Tiled download demo](docs/media/download-tiled-export.gif)

Clip a region of the scene with Potree's native selection tools, then export it as one or more LAS files — entirely client-side, no server round-trip. Large selections are automatically split into a grid of tiles sized to stay within a practical per-file point budget, with tile counts on each axis chosen to preserve the selection's aspect ratio.

A Level-of-Detail slider caps how deep the export walks the octree, trading point density for file size and export time.

When available, the File System Access API is used so every tile lands directly in one user-chosen folder; browsers without that API fall back to staggered individual downloads. Each export is accompanied by a JSON manifest recording what was selected, tiling parameters, and provenance metadata.

## Oriented Images / 360° Panorama Mode

![Oriented image mode demo](docs/media/oriented-image-mode.gif)

Clicking an oriented image marker locks the camera to that photo's captured pose and opens a panel with:

- An opacity slider that cross-fades the photograph against the point cloud behind it (composited as a post-process overlay, so lowering opacity reveals the actual geometry rather than a background color).
- Previous/next navigation through the image set without leaving image mode.
- Download of the original full-resolution photo.
- Full keyboard control — arrow keys to navigate, `Space` to momentarily peek behind the photo, `[`/`]` to nudge opacity, `W` to cycle preset opacity levels, `Esc` to exit.

![Oriented image opacity peek demo](docs/media/oriented-image-peek.gif)

Separately, 360° spherical panoramas are placed as markers (a rotating wireframe torus with a themed hover card) and opened in a [photo-sphere-viewer](https://photo-sphere-viewer.js.org/) panel for full panoramic viewing.

![360 panorama demo](docs/media/panorama-360-demo.gif)

## Transform Controls & Tools Menu

![Transform controls demo](docs/media/transform-controls.gif)

An on-screen gizmo for moving, rotating, and scaling a loaded point cloud in place — useful for manually aligning a newly registered scan against existing data.

A "Tools" menu in the toolbar gathers quick actions that don't warrant a permanent toolbar button of their own — zone creation, volume download, and point cloud transform, among others.

![Tools menu demo](docs/media/misc-tools-menu.gif)

## Shareable Camera Links

Camera position/target, active zone, and point-cloud visibility state round-trip through URL query parameters. Moving the camera updates the URL (debounced), so copying the current address reproduces the same view — including which zone and point clouds are active — for anyone who opens it.

![Shareable link demo](docs/media/shareable-link.gif)

## Floating Panel System

All of the side panels above (zones, download, layer map, transform, oriented images, tools) share a lightweight window-manager layer: every panel is draggable by its titlebar, resizable from eight edge/corner handles, and auto-placed so opening a new panel stacks it down the right edge and wraps into a new column rather than burying whatever's already open.

---

## Getting Started

This repository ships two HTML entry points:

- **`index.html`** — the entry point used for archived deployments, which loads its dataset, title, and licensing terms from external metadata rather than being edited directly.
- **`standalone.html`** — a barebones entry point for pointing this template at your own data. Start here.

To run a viewer locally:

```bash
git clone https://github.com/CHEI-OpenHeritage3D/OpenHeritage3D-VIS.git
cd OpenHeritage3D-VIS
python3 -m http.server 8080
# open http://localhost:8080/standalone.html
```

Open `standalone.html` and edit the `Potree.loadPointCloud(...)` call near the top of the script block to point at your own dataset's `metadata.json`:

```js
Potree.loadPointCloud("https://your-host/path/to/metadata.json", "my point cloud", e => {
    let pointcloud = e.pointcloud;
    viewer.scene.addPointCloud(pointcloud);
    viewer.scene.view.position.set(0, 0, 0);
    viewer.scene.view.lookAt(new THREE.Vector3(0, 0, 0));
});
```

`standalone.html` loads the same custom tooling as `index.html` (zones, classification brush, download tool, oriented images, transform controls, etc.) with no external metadata dependency, no license gate, and no zone/classification-ledger auto-loading — it's a clean starting point for a new deployment. See the comment block at the top of the file for the full list of what was intentionally left out.

## Classification Ledger → LAS Patch Script

The classification brush's edits live only in the browser until they're applied back to the source LAS/LAZ files. [`tools/classification_injector/`](tools/classification_injector/) contains a standalone Python script that does exactly that, using the brush tool's **Full Export** CSV:

```bash
cd tools/classification_injector
pip install -r requirements.txt
python classification_injector.py ./las_tiles classification_edits.csv
```

It applies implicit regions (AABBs) first, then per-point overrides on top — overrides take precedence, mirroring the ledger semantics in the viewer itself. Overrides are matched to LAS points by nearest-neighbor lookup within a configurable tolerance (KD-tree accelerated), since floating-point round-tripping through the browser can introduce sub-millimeter drift. `<las_path>` and `<edits_csv>` both accept either a single file or a folder (multiple CSVs are merged before being applied). See [`tools/classification_injector/README.md`](tools/classification_injector/README.md) for the full option reference, including `--dry-run` to preview match counts before writing anything.

## Architecture Notes

- **Client-side only.** No backend, no accounts, no server-side state — a deployment is this repository plus one or more Potree octrees served as static files.
- **Patched Potree core.** The bundled `build/potree/potree.js` includes several modifications the custom tooling above depends on: an event fired on node-load completion (used by the classification brush to reconcile edits against newly streamed geometry), oriented-image mode events, and picking/geometry accessors used for point-accurate selection.
- **No installed dependencies for the viewer itself.** Everything under `libs/` (including the patched Potree build) is vendored; opening the HTML over any static file server is sufficient.

## Repository Layout

```
index.html              Archive-integrated entry point
standalone.html         Barebones entry point — start here for a new deployment
build/potree/           Patched Potree 2.0 build (BSD-2-Clause, see LICENSE)
libs/custom/            Custom viewer tooling (classification brush, zones, download, ...)
tools/classification_injector/   Python script: apply exported edits to LAS/LAZ
docs/media/             Screenshots, GIFs, and video assets referenced by this README
```

## Citing This Work

If you use this software, please cite it — a `CITATION.cff` is included, so GitHub's "Cite this repository" button (in the sidebar) will generate APA or BibTeX citations for you. If you use it in academic work, please also cite the accompanying paper once published (see `CITATION.cff` for details, to be filled in on publication).

## License

Released under the [BSD-2-Clause License](LICENSE), matching the license of the upstream Potree project this repository builds on. The bundled, modified Potree build under `build/potree/` remains separately BSD-2-Clause licensed — see [`build/potree/LICENSE`](build/potree/LICENSE).
