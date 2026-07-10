# CLAUDE.md License Compliance Block

Paste the section below into CLAUDE.md (at the top, after the project title,
before the Workflow Rules section).

---

## License Compliance (PolyForm Small Business 1.0.0)

This project is licensed under the **PolyForm Small Business License 1.0.0**.
Enforce these rules in every coding session:

### When adding dependencies
- Check the license before running `npm install`. Allowed: MIT, Apache-2.0,
  BSD-2-Clause, BSD-3-Clause, ISC, BlueOak-1.0.0, Unlicense.
- Review required before adding: LGPL-*, MPL-2.0, GPL-3.0-or-later, CC-BY-4.0.
- Never add: GPL-2.0-only, SSPL-1.0, AGPL-3.0, Proprietary, Commercial.
- After installing, run `npx license-checker --excludePrivatePackages --summary`
  in the relevant workspace and confirm no new denied licenses appear.
- Update `scripts/license-policy.json` if a new package needs a `knownIssues`
  entry.

### Source file headers
- Every new `.ts` or `.tsx` file created under `client/src/` or `server/src/`
  must begin with:
  ```
  // Copyright 2025-2026 Kisaes LLC
  // Licensed under the PolyForm Small Business License 1.0.0.
  // Use is limited to qualifying small businesses. See LICENSE for terms.
  ```
- Do not add headers to generated files, migration files, or config files.

### Use limitation and notices
- The PolyForm Small Business License permits use only by companies with fewer
  than 100 total individuals (employees + contractors) and under $1,000,000 USD
  (2019, inflation-adjusted) prior-year revenue. Larger organizations need a
  Commercial License from Kisaes LLC — see `COMMERCIAL_LICENSE.md`.
- Distribution IS permitted, but distributed copies must carry the license
  terms (or their URL) and the `Required Notice: Copyright 2025-2026 Kisaes LLC`
  line from LICENSE. Never remove or alter that Required Notice line.
- Client-facing access (clients getting their own login to a hosted instance)
  requires a Commercial License from Kisaes LLC — see `COMMERCIAL_LICENSE.md`.

### Known open issues (tracked in scripts/license-policy.json)
- `buffers@0.1.1` — no license; transitive via exceljs. Do not upgrade exceljs
  without checking whether this is resolved in the new version.
- All new transitive dependency additions should be checked with
  `npm why <package>` to confirm whether they are runtime or dev-only.

### License audit
- Run `./scripts/license-audit.sh` after adding dependencies or before tagging
  a release.
- Run a full Claude Code audit using `docs/LICENSE-AUDIT-PROMPT.md` before
  any major release or when accepting external contributions.
