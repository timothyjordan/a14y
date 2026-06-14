export type ValidationResult =
  | { ok: true; url: URL }
  | { ok: false; reason: string };

const BLOCKED_HOSTNAMES = new Set(['localhost', '0.0.0.0', '::', '[::]']);

/**
 * Validate a user-supplied target URL before the proxy will fetch it.
 *
 * Guards against the obvious SSRF vectors: non-http(s) schemes, non-default
 * ports (port scanning), and literal addresses inside loopback / private /
 * link-local ranges or cloud-metadata hosts. This checks the literal host in
 * the URL; it does not resolve DNS, so a public name that resolves to a
 * private IP (DNS rebinding) is out of scope here — the deploy runs with no
 * VPC connector, so the proxy has no route to private networks anyway.
 */
export function validateTargetUrl(raw: string | null): ValidationResult {
  if (!raw) return { ok: false, reason: 'missing url parameter' };

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, reason: 'invalid url' };
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return { ok: false, reason: 'unsupported protocol' };
  }

  // Only default web ports. Blocks using the proxy to scan arbitrary ports.
  if (url.port && url.port !== '80' && url.port !== '443') {
    return { ok: false, reason: 'non-default port not allowed' };
  }

  const host = stripBrackets(url.hostname.toLowerCase());
  if (
    BLOCKED_HOSTNAMES.has(host) ||
    host.endsWith('.local') ||
    host.endsWith('.internal')
  ) {
    return { ok: false, reason: 'blocked host' };
  }
  if (isPrivateOrLoopbackIp(host)) {
    return { ok: false, reason: 'blocked host' };
  }

  return { ok: true, url };
}

function stripBrackets(host: string): string {
  return host.startsWith('[') && host.endsWith(']') ? host.slice(1, -1) : host;
}

function isPrivateOrLoopbackIp(host: string): boolean {
  const v4 = parseIpv4(host);
  if (v4) return isPrivateIpv4(v4);

  if (host.includes(':')) {
    // IPv6 literal.
    if (host === '::1') return true; // loopback
    // IPv4-mapped (::ffff:a.b.c.d) — check the embedded v4.
    const mapped = host.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) {
      const inner = parseIpv4(mapped[1]);
      if (inner) return isPrivateIpv4(inner);
    }
    const head = host.slice(0, 4);
    if (head.startsWith('fc') || head.startsWith('fd')) return true; // ULA fc00::/7
    if (head >= 'fe80' && head <= 'febf') return true; // link-local fe80::/10
  }

  return false;
}

function parseIpv4(host: string): [number, number, number, number] | null {
  const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return null;
  const octets = m.slice(1, 5).map((n) => Number(n)) as [number, number, number, number];
  if (octets.some((o) => o > 255)) return null;
  return octets;
}

function isPrivateIpv4([a, b]: [number, number, number, number]): boolean {
  if (a === 0) return true; // 0.0.0.0/8 ("this network")
  if (a === 10) return true; // 10.0.0.0/8
  if (a === 127) return true; // loopback 127.0.0.0/8
  if (a === 169 && b === 254) return true; // link-local / metadata 169.254.0.0/16
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
  if (a === 192 && b === 168) return true; // 192.168.0.0/16
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT 100.64.0.0/10
  return false;
}
