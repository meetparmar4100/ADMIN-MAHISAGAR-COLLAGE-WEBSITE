import { readdir, readFile, mkdir, writeFile, rm } from "node:fs/promises";
import { extname, join } from "node:path";

const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".pdf": "application/pdf",
  ".mp4": "video/mp4",
};
const assets = {};
async function collect(directory, prefix = "") {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.name.startsWith(".")) continue;
    const file = join(directory, entry.name);
    const route = prefix + "/" + entry.name;
    if (entry.isDirectory()) await collect(file, route);
    else assets[route] = [types[extname(file)] ?? "application/octet-stream", (await readFile(file)).toString("base64")];
  }
}
await collect("dist");
const worker = await readFile("worker/index.js", "utf-8");
await rm("dist", { recursive: true });
await mkdir("dist/server", { recursive: true });
await writeFile("dist/server/index.js", worker.replace('import assets from "./assets.js";', () => "const assets = " + JSON.stringify(assets) + ";"));
