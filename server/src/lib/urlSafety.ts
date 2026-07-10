// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

/**
 * URL / host safety helpers for server-side `fetch` calls that are driven by
 * admin-supplied configuration (OCR base URL, Ollama URL, OpenAI-compat proxy).
 *
 * Threat model: a malicious or compromised admin points the server at
 *   http://169.254.169.254/latest/meta-data/iam/security-credentials/
 * and the server happily grabs cloud instance credentials. This would be a
 * full-blown server-side request forgery (SSRF) to the IMDS.
 *
 * On the other hand, the whole point of this project is a self-hosted Pi
 * deployment running llama.cpp / Ollama on the loopback or on another node
 * of the same LAN. So we *cannot* blanket-block private IPs — that would
 * break the primary install. The policy instead:
 *
 *   - Always block known cloud metadata / link-local service endpoints.
 *   - Always block the broadcast/unspecified addresses.
 *   - Require http(s):// scheme.
 *   - Everything else — loopback, RFC1918, public — is permitted.
 *
 * Operators who need extra hardening can set `STRICT_AI_URL_SAFETY=true` to
 * additionally block all private / loopback / link-local ranges (IPv4 + IPv6).
 */

import dns from 'node:dns/promises';
import net from 'node:net';

const STRICT = process.env.STRICT_AI_URL_SAFETY === 'true';

// IPv4 /32 endpoints that should never be a legitimate upstream.
// 169.254.169.254 — AWS / GCP / Azure (older) instance metadata service
// 100.100.100.200 — Alibaba Cloud IMDS
// 192.0.0.192 — Oracle Cloud IMDS
// 169.254.170.2 — ECS task metadata
const IPV4_METADATA_BLOCKLIST = new Set([
  '169.254.169.254',
  '169.254.170.2',
  '100.100.100.200',
  '192.0.0.192',
  '0.0.0.0',
  '255.255.255.255',
]);

// IPv6 endpoints to block outright.
const IPV6_METADATA_BLOCKLIST = new Set([
  'fd00:ec2::254',   // AWS IPv6 IMDS
  '::',              // unspecified
]);

function inIPv4Range(ip: string, cidr: string): boolean {
  const [netAddr, bitsStr] = cidr.split('/');
  const bits = Number(bitsStr);
  const ipLong = ipv4ToLong(ip);
  const netLong = ipv4ToLong(netAddr);
  if (ipLong === null || netLong === null) return false;
  const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
  return (ipLong & mask) === (netLong & mask);
}
function ipv4ToLong(ip: string): number | null {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some((n) => isNaN(n) || n < 0 || n > 255)) return null;
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}

function isPrivateIPv4(ip: string): boolean {
  return (
    inIPv4Range(ip, '10.0.0.0/8') ||
    inIPv4Range(ip, '172.16.0.0/12') ||
    inIPv4Range(ip, '192.168.0.0/16') ||
    inIPv4Range(ip, '127.0.0.0/8') ||
    inIPv4Range(ip, '169.254.0.0/16') ||
    inIPv4Range(ip, '0.0.0.0/8')
  );
}

function isPrivateIPv6(ip: string): boolean {
  const lower = ip.toLowerCase();
  return (
    lower === '::1' ||
    lower.startsWith('fc') ||
    lower.startsWith('fd') ||
    lower.startsWith('fe8') ||
    lower.startsWith('fe9') ||
    lower.startsWith('fea') ||
    lower.startsWith('feb')
  );
}

/**
 * Resolve the URL's host to its IPs and decide whether the fetch should be
 * permitted. Throws a descriptive Error if the target is blocked.
 *
 * Always enforced:
 *   - http / https scheme only
 *   - host must resolve
 *   - no resolved IP in the metadata blocklist
 *
 * Extra when STRICT_AI_URL_SAFETY=true:
 *   - no resolved IP in any private / loopback / link-local range
 */
export async function assertSafeOutboundUrl(rawUrl: string): Promise<void> {
  let u: URL;
  try {
    u = new URL(rawUrl);
  } catch {
    throw new Error('Invalid URL.');
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') {
    throw new Error(`Unsupported URL scheme "${u.protocol}". Only http:// and https:// are allowed.`);
  }
  const host = u.hostname;
  if (!host) throw new Error('URL is missing a host.');

  // If the host is already a literal IP we can check it without DNS.
  const ipsToCheck: string[] = [];
  if (net.isIP(host)) {
    ipsToCheck.push(host);
  } else {
    try {
      const resolved = await dns.lookup(host, { all: true });
      for (const r of resolved) ipsToCheck.push(r.address);
    } catch {
      throw new Error(`Unable to resolve host "${host}".`);
    }
  }
  for (const ip of ipsToCheck) {
    const v = net.isIP(ip);
    if (v === 4) {
      if (IPV4_METADATA_BLOCKLIST.has(ip)) {
        throw new Error(`URL resolves to a blocked cloud-metadata address (${ip}).`);
      }
      if (STRICT && isPrivateIPv4(ip)) {
        throw new Error(`URL resolves to a private address (${ip}); set STRICT_AI_URL_SAFETY=false to allow.`);
      }
    } else if (v === 6) {
      if (IPV6_METADATA_BLOCKLIST.has(ip.toLowerCase())) {
        throw new Error(`URL resolves to a blocked cloud-metadata address (${ip}).`);
      }
      if (STRICT && isPrivateIPv6(ip)) {
        throw new Error(`URL resolves to a private IPv6 address (${ip}); set STRICT_AI_URL_SAFETY=false to allow.`);
      }
    }
  }
}
