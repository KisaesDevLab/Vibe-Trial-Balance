# Vibe Trial Balance — Full License Audit Prompt for Claude Code

Paste the entire contents of this file into a Claude Code session to run a
thorough 10-section manual audit. Run this before major releases, when
accepting external contributions, or after adding multiple dependencies.

---

## AUDIT INSTRUCTIONS

You are performing a comprehensive license compliance audit of
**vibe-tb** — a self-hosted accounting/tax-workpaper application
served over a network (Raspberry Pi 5, Nginx). The project license is
**PolyForm Internal Use License 1.0.0**. Work through all 10 sections below.
For each section, report findings with severity (CRITICAL / HIGH / MEDIUM /
LOW / PASS).

Reference file: `scripts/license-policy.json` — the authoritative policy.

---

### Section 1 — LICENSE File

1. Check whether `LICENSE` exists in the project root.
2. Confirm it contains the full PolyForm Internal Use License 1.0.0 text with
   the licensor preamble (Licensor: Kisaes LLC, Software: Vibe Trial Balance).
3. Confirm the `NOTICE` file exists with correct copyright and attribution.

**Expected result:** `LICENSE` exists, contains full PolyForm Internal Use
1.0.0 text with the Kisaes LLC licensor preamble.

---

### Section 2 — Source File Headers

1. Count all `.ts` and `.tsx` files under `client/src/` and `server/src/`.
2. For each file, check for a license header comment at the top.
   Minimum acceptable header:
   ```
   // Copyright 2025-2026 Kisaes LLC
   // Licensed under the PolyForm Internal Use License 1.0.0.
   // You may not distribute this software. See LICENSE for terms.
   ```
3. List any files missing headers.
4. Note: generated files (e.g. Vite build output, migration auto-generators)
   are exempt.

**Expected result:** All hand-written source files have PolyForm Internal Use
headers.

---

### Section 3 — License Notices and No-Distribution

The PolyForm Internal Use License does not permit distributing the software in
any form. Verify that licensing notices are present and that the project does
not advertise or facilitate distribution to third parties.

1. Search `client/src/` for any UI component, page, or footer that references
   the license or links to the canonical source code repository.
2. Check whether the LICENSE text is accessible to users of the application.
3. Check `CLAUDE.md` and `README.md` for documented compliance and the absence
   of any "redistribute" / "open source" language.

**Expected result:** A visible license/source link exists in the application
UI footer (or About page). README and CLAUDE.md describe the no-distribution
clause and the supplemental Commercial License for client-facing access.

---

### Section 4 — Client Dependency Audit

1. Run `cd client && npx license-checker --excludePrivatePackages --json`
2. Cross-reference every unique license against `scripts/license-policy.json`.
3. Flag anything in the `denied` list as CRITICAL.
4. Flag anything in the `reviewRequired` list as MEDIUM.
5. Note `caniuse-lite` (CC-BY-4.0) — this is a dev/build-time dependency and
   does not ship to users; classify as LOW / acceptable.

**Known packages to verify manually:**
- `xlsx@0.18.5` — confirm LICENSE file in node_modules shows Apache-2.0 text
- `xlsx-js-style@1.2.0` — confirm Apache-2.0

---

### Section 5 — Server Dependency Audit

1. Run `cd server && npx license-checker --excludePrivatePackages --json`
2. Same cross-reference process as Section 4.
3. Pay specific attention to the following known issues:

   **buffers@0.1.1** — CRITICAL for investigation:
   - Check `server/node_modules/buffers/package.json` for a `license` field.
   - Check `server/node_modules/buffers/` for a LICENSE file.
   - Check the README for any license mention.
   - If no license found anywhere: this package has no explicit license granted,
     meaning use is technically not permitted under copyright law.
   - Dependency chain: `exceljs → unzipper → binary → buffers`
   - Recommended action: evaluate whether `exceljs` can be replaced or whether
     a newer version of the chain resolves this.

   **BlueOak-1.0.0** (jackspeak, minipass, sax, path-scurry, package-json-from-dist):
   - BlueOak-1.0.0 is a permissive license compatible with the PolyForm
     Internal Use License. Classify as PASS after confirming the text matches
     the BlueOak 1.0.0 standard.

   **MIT\*** (chainsaw, traverse, png-js):
   - The asterisk means license-checker found the MIT text in the README, not
     a separate LICENSE file. Check each package's README to confirm MIT terms.

   **jszip@3.10.1** — `(MIT OR GPL-3.0-or-later)`:
   - Dual-licensed. Elect MIT. Classify as PASS.

   **MIT/X11** (chainsaw, traverse):
   - Equivalent to MIT. Classify as PASS.

---

### Section 6 — Transitive Dependency Spot Check

For each HIGH-risk package found in Sections 4–5, trace the full dependency
chain using `npm why <package>` to understand whether it is:
- A runtime dependency (shipped to users / included in the server process)
- A dev/build dependency (never reaches production)

Dev-only dependencies that never reach the Pi server or the client bundle
carry significantly lower compliance risk.

---

### Section 7 — Vendored / Embedded Third-Party Code

1. Search the entire repository (excluding `node_modules/` and `.git/`) for:
   - Any directory named `vendor/`, `vendors/`, `third_party/`, `thirdparty/`
   - Any `.min.js` or `.min.css` files checked in to `client/src/` or `server/src/`
   - Any source files with a different copyright notice than the project's own
2. If found, verify each has a compatible license.

---

### Section 8 — Copyleft Dependency Check

PolyForm Internal Use is a source-available license, not copyleft. Verify that
no dependency carries copyleft obligations that would conflict with our
no-distribution model:

- AGPL-3.0 dependencies are NOT compatible (the network-use clause would
  effectively force AGPL terms on the whole product, conflicting with the
  PolyForm Internal Use license).
- GPL-2.0-only is NOT compatible.
- GPL-3.0-or-later requires review — acceptable if elected as a runtime
  dependency only and not statically linked.
- LGPL packages used as libraries (not modified and statically linked) are
  generally acceptable.
- Proprietary / commercial licenses are NOT compatible.

If any AGPL-3.0 or GPL-2.0-only package is found, classify as CRITICAL.

---

### Section 9 — AI Provider / SDK Compliance

This application integrates three AI providers. Verify:

1. `@anthropic-ai/sdk` — confirm MIT license in `server/node_modules/@anthropic-ai/sdk/`
2. `openai` — confirm Apache-2.0 in `server/node_modules/openai/`
3. `@modelcontextprotocol/sdk` — confirm MIT or Apache-2.0

These packages process sensitive financial data. Confirm their licenses permit
use in a PolyForm Internal Use licensed application without additional terms.

---

### Section 10 — Report

Produce a structured compliance report with the following format:

```
## License Audit Report — vibe-tb
Date: <today>
Auditor: Claude Code
Project License: PolyForm Internal Use License 1.0.0

### CRITICAL Issues (must fix before any distribution)
[list]

### HIGH Issues (must fix before production use by others)
[list]

### MEDIUM Issues (review required)
[list]

### LOW / Informational
[list]

### PASS (no action required)
[list]

### Required Immediate Actions
1. <action>
2. <action>
...

### Recommended Actions
1. <action>
...
```

After producing the report, ask: "Would you like me to implement any of the
required or recommended actions?"
