// Copies MapLibre's background worker into /public so the browser can load it.
// Next.js's bundler can't serve this file from node_modules, so we do it once after `npm install`.
import { copyFileSync } from "node:fs";

copyFileSync("node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs", "public/maplibre-gl-worker.mjs");
