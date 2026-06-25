import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { handleProxy } from './handler.js';
import { createRateLimiter } from './rate-limit.js';
import {
  ALLOWED_ORIGINS,
  EXTRA_ORIGINS_ENV,
  RATE_LIMIT_CAPACITY,
  RATE_LIMIT_REFILL_PER_SEC,
  resolveAllowedOrigins,
} from './config.js';

const rateLimiter = createRateLimiter({
  capacity: RATE_LIMIT_CAPACITY,
  refillPerSec: RATE_LIMIT_REFILL_PER_SEC,
});

// Hardcoded allow-list plus any PROXY_EXTRA_ORIGINS (unset in production).
const allowedOrigins = resolveAllowedOrigins(process.env);

// Cloud Run injects PORT (8080). Fall back to 8787 for local dev.
const port = Number(process.env.PORT ?? 8787);

function toRequest(req: IncomingMessage): Request {
  const host = req.headers.host ?? 'localhost';
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value === undefined) continue;
    headers.set(key, Array.isArray(value) ? value.join(', ') : value);
  }
  return new Request(`http://${host}${req.url ?? '/'}`, {
    method: req.method,
    headers,
  });
}

async function writeResponse(res: ServerResponse, response: Response): Promise<void> {
  res.statusCode = response.status;
  response.headers.forEach((value, key) => res.setHeader(key, value));
  const buffer = Buffer.from(await response.arrayBuffer());
  res.end(buffer);
}

const server = createServer((req, res) => {
  handleProxy(toRequest(req), { rateLimiter, allowedOrigins })
    .then((response) => writeResponse(res, response))
    .catch(() => {
      res.statusCode = 500;
      res.end('internal error');
    });
});

server.listen(port, () => {
  // Coarse startup log only; never logs target URLs.
  console.log(`a14y scan-proxy listening on :${port}`);
  const extra = allowedOrigins.length - ALLOWED_ORIGINS.length;
  if (extra > 0) console.log(`  + ${extra} extra CORS origin(s) from ${EXTRA_ORIGINS_ENV}`);
});
