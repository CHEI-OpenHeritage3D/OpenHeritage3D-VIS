#!/usr/bin/env python3
"""Add (or remove) the benchmark hooks in libs/custom/brush_selection.js.

The hooks only act when the page was opened with ?bench=1, because only then
does bench.js define window.__bench:

  1. fillLoadedSubtree: window.__bench?.onEditFlag?.() after a resident node's
     classification buffer is flagged for upload (bulk-marked subtree).
  2. flushDirty: the same call once per flush that flags at least one buffer
     (per-point changes). Used for "time to first visible edit".
  3. reportStrokeProfile: window.__lastStrokeProfile = Object.fromEntries(rows),
     so full-mode runs can read the profiler's rows. Runs only when
     window.BRUSH_PROFILE is on.

Each snippet must match exactly once. Line endings are preserved (CRLF files
stay CRLF). `node --check` runs after writing.

    python3 patch_hooks.py              # print the diff, write nothing
    python3 patch_hooks.py --apply      # write it
    python3 patch_hooks.py --revert     # print the diff that removes the hooks
    python3 patch_hooks.py --revert --apply
    python3 patch_hooks.py --file /some/copy/brush_selection.js --apply
"""
import argparse
import difflib
import hashlib
import pathlib
import subprocess
import sys

DEFAULT_FILE = pathlib.Path(__file__).resolve().parents[2] / "libs" / "custom" / "brush_selection.js"

# (description, original, hooked). Written with "\n"; converted to the file's line ending.
EDITS = [
    (
        "fillLoadedSubtree: flag a bulk-marked resident node",
        "            classAttr.array.fill(classification);\n"
        "            classAttr.needsUpdate = true;\n"
        "        }\n",
        "            classAttr.array.fill(classification);\n"
        "            classAttr.needsUpdate = true;\n"
        "            window.__bench?.onEditFlag?.();\n"
        "        }\n",
    ),
    (
        "flushDirty: flag per-point changes",
        "      if (_dirtyAttrs.size === 0) return;\n",
        "      if (_dirtyAttrs.size === 0) return;\n"
        "      window.__bench?.onEditFlag?.();\n",
    ),
    (
        "reportStrokeProfile: expose the profiler rows",
        '    console.log("[brush] stroke profile");\n',
        "    window.__lastStrokeProfile = Object.fromEntries(rows);\n"
        '    console.log("[brush] stroke profile");\n',
    ),
]


def sha256(b: bytes) -> str:
    return hashlib.sha256(b).hexdigest()


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--file", type=pathlib.Path, default=DEFAULT_FILE)
    ap.add_argument("--apply", action="store_true", help="write the change (default: print the diff only)")
    ap.add_argument("--revert", action="store_true", help="remove the hooks instead of adding them")
    args = ap.parse_args()

    raw = args.file.read_bytes()
    text = raw.decode("utf-8")              # brush_selection.js is UTF-8; fail loudly otherwise
    crlf = text.count("\r\n")
    lf = text.count("\n")
    if crlf and crlf != lf:
        sys.exit(f"{args.file}: mixed line endings ({crlf} CRLF of {lf} lines); not touching it")
    eol = "\r\n" if crlf else "\n"

    new = text
    for desc, before, after in EDITS:
        old_s, new_s = (after, before) if args.revert else (before, after)
        old_s, new_s = old_s.replace("\n", eol), new_s.replace("\n", eol)
        n_old, n_new = new.count(old_s), new.count(new_s)
        if n_old == 0 and n_new == 1:
            print(f"already {'removed' if args.revert else 'applied'}: {desc}")
            continue
        assert n_old == 1, f"{desc}: expected exactly 1 match, found {n_old}"
        assert n_new == 0, f"{desc}: target text already present {n_new} time(s)"
        new = new.replace(old_s, new_s, 1)

    if new == text:
        print("nothing to do")
        return 0

    diff = difflib.unified_diff(
        text.splitlines(keepends=True), new.splitlines(keepends=True),
        fromfile=f"a/{args.file.name}", tofile=f"b/{args.file.name}", n=3)
    sys.stdout.writelines(line.replace("\r\n", "\n") for line in diff)

    out = new.encode("utf-8")
    print(f"\nline endings: {'CRLF' if crlf else 'LF'}")
    print(f"sha256 before: {sha256(raw)}")
    print(f"sha256 after:  {sha256(out)}")
    if not args.apply:
        print("dry run: nothing written (add --apply)")
        return 0

    args.file.write_bytes(out)
    res = subprocess.run(["node", "--check", str(args.file)], capture_output=True, text=True)
    if res.returncode != 0:
        args.file.write_bytes(raw)
        sys.exit(f"node --check failed, original restored:\n{res.stderr}")
    print(f"written: {args.file} (node --check ok)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
