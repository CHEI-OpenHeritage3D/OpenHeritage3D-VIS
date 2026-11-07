# las-laz-js (trimmed)

The LAS/LAZ writer behind the download panel (`libs/custom/potree_point_download.js`).

- **Upstream:** [las-laz-js](https://github.com/brentbuffham/las-laz-js) 0.22.0 by Brent Buffham, MIT AND Apache-2.0 (see `LICENSE`, `LICENSE-APACHE`, `NOTICE`)
- **Tarball:** https://registry.npmjs.org/las-laz-js/-/las-laz-js-0.22.0.tgz
- **Integrity:** `sha512-AFtQ25fSLBwUCxQ3ikcBqeVrY95YRNTyoN/BEbL/+xzz8nf+NerZoMTOueaGi2nJzE3R2wCWaFwTRNPMMkzDdg==`

## What is here

Only what `src/write/writeLas.js` needs to write LAS and LAZ: 29 of the package's 108 source files. The panel imports `src/write/writeLas.js` directly. There is no `src/index.js`.

All files are unchanged from 0.22.0 except one:

- `src/laz/chunkWorker.js` keeps only the `compress` job. Upstream it is the worker for all of the library's parallel jobs, and its imports pulled in about 50 more modules. Any other job sent to it gets an error reply.

Removed: the reader (`LasReader.js`, `io/`, `read/windows.js`) and the tiles, index, facets, fragments, filter, colour, register and most of the `ops` modules, as well as `README.md`, `CHANGELOG.md` and `package.json`. The full API is documented in the upstream README.

## Updating

1. Unpack the new tarball.
2. Copy `src/write/writeLas.js` and every module it imports, following imports recursively. Do not follow `src/laz/chunkWorker.js`.
3. Copy `src/laz/compressChunk.js` and its imports in the same way.
4. Redo the compress-only `chunkWorker.js`, starting from upstream's `compress()` and `cache()`.
5. Then rerun the LAZ round-trip and download-panel tests.
