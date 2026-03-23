# CLAUDE.md License Compliance Block

Paste the section below into CLAUDE.md (at the top, after the project title,
before the Workflow Rules section).

---

## License Compliance (AGPL-3.0-only)

This project is licensed under **AGPL-3.0-only**. Enforce these rules in
every coding session:

### When adding dependencies
- Check the license before running `npm install`. Allowed: MIT, Apache-2.0,
  BSD-2-Clause, BSD-3-Clause, ISC, BlueOak-1.0.0, Unlicense, AGPL-3.0.
- Review required before adding: LGPL-*, MPL-2.0, GPL-3.0-or-later, CC-BY-4.0.
- Never add: GPL-2.0-only, SSPL-1.0, BUSL-1.1, Proprietary, Commercial.
- After installing, run `npx license-checker --excludePrivatePackages --summary`
  in the relevant workspace and confirm no new denied licenses appear.
- Update `scripts/license-policy.json` if a new package needs a `knownIssues`
  entry.

### Source file headers
- Every new `.ts` or `.tsx` file created under `client/src/` or `server/src/`
  must begin with:
  ```
  // SPDX-License-Identifier: AGPL-3.0-only
  // Copyright (C) 2024–2026 [Project Author]
  ```
- Do not add headers to generated files, migration files, or config files.

### AGPL Section 13 — network use
- This app is served over a network. The UI must always contain a visible link
  to the source code repository accessible to users without logging in.
- Do not remove or hide the source code link from the footer or About page.
- If adding a new public-facing page, check whether it needs the link.

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
