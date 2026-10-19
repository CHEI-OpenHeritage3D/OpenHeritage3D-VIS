<?php
/**
 * potree_clouds.php — the Potree 2.0 point clouds in a dataset's potree/ folder
 *
 * Directory listings are off on this server (/mnt/oh3d_store/.htaccess has
 * IndexIgnore *), so a page can't see which clouds a dataset holds. A dataset
 * without config.js is set up from this list (libs/custom/default_zone.js).
 *
 *   GET ?dir=/archive_temp/oh3d_store/oh3d-vis/datasets/D6C31M/potree/
 *   → {"clouds": ["D6C31M_photogrammetry_terrestrial/metadata.json", "D6C31M_thermography/metadata.json"]}
 *
 * `dir` is the folder's URL path on this site. Only folders named "potree"
 * under ALLOWED_ROOT are read, and all that comes back is the path of each
 * folder in it that holds a metadata.json, relative to it.
 */

header("Content-Type: application/json");
header("Cache-Control: no-store");

const ALLOWED_ROOT = "/mnt/oh3d_store/";
const MAX_DEPTH = 3;        // potree/a/b/c/metadata.json at most
const MAX_CLOUDS = 1000;

function fail($status, $message) {
    http_response_code($status);
    echo json_encode(["error" => $message]);
    exit;
}

// Folders holding a metadata.json, as "<path>/metadata.json". An octree folder holds no other clouds,
// so the walk doesn't go into one.
function findClouds($dir, $rel, $depth, &$clouds) {
    $entries = @scandir($dir);
    if ($entries === false) return;
    foreach ($entries as $name) {
        if ($name[0] === "." || count($clouds) >= MAX_CLOUDS) continue;
        $sub = "$dir/$name";
        if (!is_dir($sub)) continue;
        if (is_file("$sub/metadata.json")) $clouds[] = "$rel$name/metadata.json";
        else if ($depth < MAX_DEPTH) findClouds($sub, "$rel$name/", $depth + 1, $clouds);
    }
}

$dir = $_GET["dir"] ?? "";
if ($dir === "" || $dir[0] !== "/") fail(400, "dir must be a URL path on this site");

// realpath() resolves .. and symlinks (archive_temp/oh3d_store is one), so the checks see the real folder.
$path = realpath($_SERVER["DOCUMENT_ROOT"] . $dir);
if ($path === false || strpos($path . "/", ALLOWED_ROOT) !== 0 || basename($path) !== "potree" || !is_dir($path)) {
    fail(404, "no such dataset folder");
}

$clouds = [];
findClouds($path, "", 1, $clouds);
sort($clouds, SORT_NATURAL | SORT_FLAG_CASE);
echo json_encode(["clouds" => $clouds], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
