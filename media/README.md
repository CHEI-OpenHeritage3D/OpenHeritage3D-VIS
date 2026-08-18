# docs/media/

Drop screenshots, GIFs, and videos here using the filenames already
referenced by the root [README.md](../../README.md) — the links will
resolve automatically once a file lands at that path. Nothing in this
folder is required for the viewer to run; it's documentation-only.

**Images / GIFs** — reference directly with standard Markdown:

```md
![Classification brush demo](docs/media/brush-paint-demo.gif)
```

**Videos (.mp4)** — GitHub's Markdown renderer won't autoplay an
inline `<video>` tag from a repo-relative path, so the common pattern
is a clickable thumbnail that links to the file:

```md
[![Watch: tiled download](docs/media/download-tiled-export-thumb.png)](docs/media/download-tiled-export.mp4)
```

Alternatively, drag the video into a GitHub PR/issue comment first —
GitHub uploads it to their CDN and gives you a `https://github.com/user-attachments/...`
URL that *does* play inline — then paste that URL into the README instead
of the local path.

Keep individual files reasonably small (a few MB); short looping GIFs
or 10–20s clips read better in a README than long recordings.
