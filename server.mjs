// Zero-dependency static file server for Pokémon Code Adventure.
//   npm start            → http://127.0.0.1:8378
//
// Also importable: the Electron desktop shell (desktop/main.cjs) calls
// startStaticServer() to serve this same directory on an ephemeral port.
// CLI behaviour is unchanged when the file is run directly.
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { join, normalize, extname, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const ROOT = dirname(fileURLToPath(import.meta.url));
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

export function createStaticServer(root = ROOT) {
  return createServer(async (req, res) => {
    try {
      const url = new URL(req.url, "http://localhost");
      let path = decodeURIComponent(url.pathname);
      if (path === "/") path = "/index.html";
      const file = normalize(join(root, path));
      if (!file.startsWith(root)) { res.writeHead(403); return res.end("Forbidden"); }
      const info = await stat(file).catch(() => null);
      if (!info || !info.isFile()) { res.writeHead(404); return res.end("Not found"); }
      const body = await readFile(file);
      res.writeHead(200, { "content-type": TYPES[extname(file)] ?? "application/octet-stream" });
      res.end(body);
    } catch (e) {
      res.writeHead(500); res.end(String(e));
    }
  });
}

/**
 * Start the static server. Resolves with { server, port, url } once
 * listening. port 0 (the default for embedders) picks a free port.
 */
export function startStaticServer({ root = ROOT, port = 0, host = "127.0.0.1" } = {}) {
  const server = createStaticServer(root);
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => {
      const actual = server.address().port;
      resolve({ server, port: actual, url: `http://${host}:${actual}` });
    });
  });
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const port = Number(process.env.PORT ?? 8378);
  startStaticServer({ port }).then(({ url }) => {
    console.log(`Pokémon Code Adventure → ${url}`);
  });
}
