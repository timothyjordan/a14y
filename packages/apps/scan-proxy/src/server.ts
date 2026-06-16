import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { handleProxy } from './handler.js';
import { createRateLimiter } from './rate-limit.js';
import { RATE_LIMIT_CAPACITY, RATE_LIMIT_REFILL_PER_SEC } from './config.js';

const rateLimiter = createRateLimiter({
  capacity: RATE_LIMIT_CAPACITY,
  refillPerSec: RATE_LIMIT_REFILL_PER_SEC,
});

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
  handleProxy(toRequest(req), { rateLimiter })
    .then((response) => writeResponse(res, response))
    .catch(() => {
      res.statusCode = 500;
      res.end('internal error');
    });
});

server.listen(port, () => {
  // Coarse startup log only; never logs target URLs.
  console.log(`a14y scan-proxy listening on :${port}`);
});
