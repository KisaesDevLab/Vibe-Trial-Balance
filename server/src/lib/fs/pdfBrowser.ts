// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

/**
 * The Chromium that prints Statement Writer PDFs.
 *
 * Every other PDF in this app is pdfmake. The Statement Writer is the one
 * exception: its HTML renderer is shared with the browser's live preview, so
 * the PDF has to be printed by a browser for the two to match.
 *
 * Rules, each load-bearing on a Raspberry Pi:
 *   - `puppeteer-core`, never `puppeteer`: nothing is downloaded at install
 *     (there is no linux-arm64 Chrome for Testing build to download anyway).
 *     The executable is the system's Chromium.
 *   - Where it is: settings row `fs.chromium_path` > PUPPETEER_EXECUTABLE_PATH
 *     > the usual install locations. The setting is editable in Settings →
 *     PDF engine, because a self-hosted firm will not edit .env.
 *   - NEVER launched at boot and never a boot failure. A missing Chromium is
 *     a 503 `PDF_ENGINE_UNAVAILABLE` on the routes that need it; Word and
 *     Excel exports, the editor and the live preview keep working.
 *   - One browser, launched on first use and closed after it has been idle
 *     (a Chromium kept alive costs ~150 MB the Pi would rather have back).
 *   - One render job at a time, a short queue behind it, and a timeout that
 *     kills the browser rather than leaving a stuck page to hold memory.
 *   - Pages run with JavaScript OFF and every network request blocked: the
 *     HTML is server-built, but the accountant's letter is stored rich text,
 *     so even if markup slipped through it could neither run nor phone home.
 */

import { existsSync } from 'node:fs';
import type { Browser } from 'puppeteer-core';
import { db } from '../../db';

export const CHROMIUM_PATH_SETTING = 'fs.chromium_path';

export class PdfEngineError extends Error {
  constructor(public code: 'PDF_ENGINE_UNAVAILABLE' | 'PDF_BUSY' | 'PDF_TIMEOUT', public status: number, message: string) {
    super(message);
  }
}

const PROBE_PATHS: Readonly<Record<string, readonly string[]>> = {
  linux: ['/usr/bin/chromium-browser', '/usr/bin/chromium', '/usr/lib/chromium/chromium', '/snap/bin/chromium', '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable'],
  darwin: ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Chromium.app/Contents/MacOS/Chromium', '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'],
  win32: [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  ],
};

export type ChromiumSource = 'setting' | 'env' | 'detected';
export interface ChromiumLocation { path: string; source: ChromiumSource }

export interface ResolveInput {
  setting?: string | null;
  env?: string | null;
  platform?: string;
  exists?: (path: string) => boolean;
}

/**
 * Pure. A configured path that does not exist is NOT skipped in favour of a
 * detected one: the admin named a browser, and silently printing with a
 * different one would hide the misconfiguration. It resolves to null and the
 * status card says which path is missing.
 */
export function resolveChromiumPath(input: ResolveInput): ChromiumLocation | null {
  const exists = input.exists ?? existsSync;
  const setting = input.setting?.trim();
  if (setting) return exists(setting) ? { path: setting, source: 'setting' } : null;
  const env = input.env?.trim();
  if (env) return exists(env) ? { path: env, source: 'env' } : null;
  for (const p of PROBE_PATHS[input.platform ?? process.platform] ?? []) {
    if (exists(p)) return { path: p, source: 'detected' };
  }
  return null;
}

export const INSTALL_HINT = 'Install Chromium on the server (Debian / Raspberry Pi OS: "sudo apt install chromium"; the official Docker image includes it), or set its path in Settings → PDF engine.';

async function readPathSetting(): Promise<string | null> {
  try {
    const row = await db('settings').where({ key: CHROMIUM_PATH_SETTING }).first('value');
    return (row?.value as string | undefined)?.trim() || null;
  } catch {
    // A settings read must never be what breaks a render that env could serve.
    return null;
  }
}

export interface PdfEngineStatus {
  available: boolean;
  path: string | null;
  source: ChromiumSource | null;
  /** The configured path when it is set but missing. */
  configuredPath: string | null;
  message: string;
}

export async function pdfEngineStatus(): Promise<PdfEngineStatus> {
  const setting = await readPathSetting();
  const env = process.env.PUPPETEER_EXECUTABLE_PATH ?? null;
  const loc = resolveChromiumPath({ setting, env });
  const configuredPath = setting || env?.trim() || null;
  if (loc) {
    return { available: true, path: loc.path, source: loc.source, configuredPath, message: 'Chromium found.' };
  }
  return {
    available: false, path: null, source: null, configuredPath,
    message: configuredPath
      ? `No Chromium at the configured path (${configuredPath}). ${INSTALL_HINT}`
      : `Chromium is not installed on this server, so PDFs of financial statements cannot be produced. ${INSTALL_HINT}`,
  };
}

// ─── Lifecycle ───────────────────────────────────────────────────────────

const IDLE_CLOSE_MS = 90_000;
const JOB_TIMEOUT_MS = 120_000;
const MAX_QUEUED = 3;

let browser: Browser | null = null;
let browserPath: string | null = null;
let idleTimer: NodeJS.Timeout | null = null;
let running = false;
const waiting: Array<() => void> = [];

async function closeBrowser(): Promise<void> {
  const b = browser;
  browser = null;
  browserPath = null;
  if (idleTimer) { clearTimeout(idleTimer); idleTimer = null; }
  if (!b) return;
  try {
    await b.close();
  } catch {
    // A browser that will not close politely is killed.
    try { b.process()?.kill('SIGKILL'); } catch { /* already gone */ }
  }
}

async function getBrowser(): Promise<Browser> {
  const status = await pdfEngineStatus();
  if (!status.available || !status.path) throw new PdfEngineError('PDF_ENGINE_UNAVAILABLE', 503, status.message);
  // The admin pointed the setting at a different browser: use that one.
  if (browser && (browserPath !== status.path || !browser.connected)) await closeBrowser();
  if (!browser) {
    // Required lazily so a server without the optional browser never pays
    // for loading the driver at boot.
    const puppeteer = (await import('puppeteer-core')).default;
    try {
      browser = await puppeteer.launch({
        headless: true,
        executablePath: status.path,
        // --no-sandbox: the container runs as a non-root user without the
        // kernel namespaces Chromium's sandbox wants. The pages it prints
        // have JavaScript off and no network, which is the real boundary.
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
      });
      browserPath = status.path;
    } catch (err) {
      throw new PdfEngineError('PDF_ENGINE_UNAVAILABLE', 503, `Chromium at ${status.path} could not be started (${err instanceof Error ? err.message.split('\n')[0] : 'unknown error'}). ${INSTALL_HINT}`);
    }
  }
  return browser;
}

/** HTML → PDF bytes. Paper, orientation and margins come from the document's own CSS @page rule. */
export type RenderHtml = (html: string) => Promise<Uint8Array>;

async function htmlToPdf(b: Browser, html: string): Promise<Uint8Array> {
  const page = await b.newPage();
  try {
    await page.setJavaScriptEnabled(false);
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const url = req.url();
      if (url.startsWith('data:') || url.startsWith('about:')) void req.continue();
      else void req.abort();
    });
    await page.setContent(html, { waitUntil: 'load' });
    await page.evaluateHandle('document.fonts.ready').catch(() => undefined);
    return await page.pdf({ preferCSSPageSize: true, printBackground: true });
  } finally {
    await page.close().catch(() => undefined);
  }
}

/**
 * Run one render job (which may print several documents) with the shared
 * browser. Jobs run one at a time; a fourth waiting job is refused rather
 * than queued, because each waiter is an HTTP request held open in front of
 * a ~100 s proxy timeout.
 */
export async function withPdfBrowser<T>(job: (render: RenderHtml) => Promise<T>): Promise<T> {
  if (running) {
    if (waiting.length >= MAX_QUEUED) {
      throw new PdfEngineError('PDF_BUSY', 503, 'The PDF engine is busy with other documents. Try again in a moment.');
    }
    await new Promise<void>((resolve) => waiting.push(resolve));
  }
  running = true;
  if (idleTimer) { clearTimeout(idleTimer); idleTimer = null; }
  let timer: NodeJS.Timeout | null = null;
  try {
    const b = await getBrowser();
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new PdfEngineError('PDF_TIMEOUT', 503, 'The PDF took too long to produce and was cancelled. Try again; if it keeps happening, the server may be short of memory.')), JOB_TIMEOUT_MS);
    });
    return await Promise.race([job((html) => htmlToPdf(b, html)), timeout]);
  } catch (err) {
    // After a timeout or a crashed page the browser's state is unknown.
    if (!(err instanceof PdfEngineError) || err.code === 'PDF_TIMEOUT') await closeBrowser();
    throw err;
  } finally {
    if (timer) clearTimeout(timer);
    running = false;
    const next = waiting.shift();
    if (next) next();
    else if (browser) {
      idleTimer = setTimeout(() => { void closeBrowser(); }, IDLE_CLOSE_MS);
      idleTimer.unref();
    }
  }
}

/** Launch and print one page — the Settings card's "Test" button. */
export async function testPdfEngine(): Promise<{ ok: true; bytes: number }> {
  const bytes = await withPdfBrowser((render) => render('<!doctype html><html><body><p>Statement Writer PDF engine test</p></body></html>'));
  return { ok: true, bytes: bytes.length };
}

export async function shutdownPdfBrowser(): Promise<void> {
  await closeBrowser();
}
