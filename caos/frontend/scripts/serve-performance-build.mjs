import { createServer } from "node:http";
import { readFileSync, statSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";
import { gzipSync } from "node:zlib";

const root = resolve(process.argv[2] || "out");
const port = Number(process.argv[3] || 4175);
const cache = new Map();

const types = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".txt": "text/x-component; charset=utf-8",
  ".woff2": "font/woff2",
};

function resolveFile(urlPath) {
  const pathname = decodeURIComponent(new URL(urlPath, "http://localhost").pathname);
  const relative = normalize(pathname).replace(/^[/\\]+/, "");
  const routePayload = relative.endsWith(".txt")
    ? join(root, relative.slice(0, -4), "index.txt")
    : null;
  const candidates = [join(root, relative), join(root, relative, "index.html"), routePayload].filter(Boolean);
  for (const candidate of candidates) {
    if (!candidate.startsWith(root)) continue;
    try {
      if (statSync(candidate).isFile()) return candidate;
    } catch {}
  }
  return null;
}

createServer((request, response) => {
  const file = resolveFile(request.url || "/");
  if (!file) {
    response.writeHead(404, { "content-type": "application/json; charset=utf-8" });
    response.end("{}");
    return;
  }

  const raw = readFileSync(file);
  const metadata = statSync(file);
  const compressible = /\.(?:css|html|js|json|svg|txt)$/.test(file);
  const acceptsGzip = /(?:^|,)\s*gzip(?:\s*;|\s*,|$)/i.test(request.headers["accept-encoding"] || "");
  const headers = {
    "cache-control": "no-store",
    "content-type": types[extname(file)] || "application/octet-stream",
    vary: "Accept-Encoding",
  };

  if (compressible && acceptsGzip) {
    let cached = cache.get(file);
    if (!cached || cached.mtimeMs !== metadata.mtimeMs || cached.size !== metadata.size) {
      cached = {
        body: gzipSync(raw, { level: 6 }),
        mtimeMs: metadata.mtimeMs,
        size: metadata.size,
      };
      cache.set(file, cached);
    }
    const body = cached.body;
    response.writeHead(200, { ...headers, "content-encoding": "gzip", "content-length": body.length });
    response.end(body);
    return;
  }

  response.writeHead(200, { ...headers, "content-length": raw.length });
  response.end(raw);
}).listen(port, "127.0.0.1", () => {
  process.stdout.write(`gzip performance server: http://127.0.0.1:${port}\n`);
});
