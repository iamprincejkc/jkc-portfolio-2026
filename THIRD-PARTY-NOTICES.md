# Third-party notices

This repository contains material owned by other people.
`LICENSE` covers this project's own code and does not apply to anything listed here — each item below stays available under its own terms.

---

## n8n workflow collection — `public/n8n/`

1,971 workflow JSON files and the catalog derived from them, in `public/n8n/`.

Sourced from [Zie619/n8n-workflows](https://github.com/Zie619/n8n-workflows) at tag `dmca-compliance-2025-08-14`, which is published under the MIT Licence.
Each individual workflow is the work of its own author; the collection assembles them.

The names, summaries, diagrams and search index in `public/n8n/catalog.json` are generated from those files by `scripts/build-n8n-catalog.mjs` and are derivative of them.

```
MIT License

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

If you are the author of a workflow here and would rather it were not, email princejankevin@gmail.com and it will be removed.

---

## Public API directory — `public/public-api/`

The catalog of 1,773 APIs in `public/public-api/catalog.json`.

Sourced from [public-apis/public-apis](https://github.com/public-apis/public-apis) at commit `7ee71f04dd42720f7f4130aa70f804aa95c53164`, which is published under the MIT Licence — Copyright (c) 2022 public-apis.
The list is the work of hundreds of contributors who curate it by pull request.

The catalog is parsed from that repository's `README.md` by `scripts/build-public-api-catalog.mjs`.
Names, descriptions and the Auth / HTTPS / CORS columns are upstream's own words and are reproduced; the ids, hostnames, category counts and the browser-ready flag are derived from them.
Every entry links back to the documentation URL the list gives for it.

```
MIT License

Copyright (c) 2022 public-apis

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

The APIs themselves belong to their own operators and are subject to their own terms.
Listing one here is not endorsement or affiliation, and nothing on the page calls any of them.

---

## Brand marks — `utils/qr/logos.ts`

Generated from [simple-icons](https://github.com/simple-icons/simple-icons), which releases its icon data under **CC0-1.0** (public domain dedication).

The marks themselves remain the property of their respective owners and are included only so that a QR code can point at a profile on that service.
Their presence is not endorsement, affiliation, or a trademark licence.

---

## Fonts

Loaded from their vendors at runtime, not redistributed in this repository.

| Font | Where | Licence |
|---|---|---|
| General Sans, Melodrama | Fontshare (`cdn.fontshare.com`) | [Fontshare licence](https://www.fontshare.com/licenses/itf-ffl) — free for personal and commercial use |
| Nunito, DM Sans | Google Fonts (`fonts.gstatic.com`) | SIL Open Font License 1.1 |

---

## Runtime dependencies

The npm packages in `package.json` carry their own licences — MIT, ISC and Apache-2.0 — and are not vendored into this repository.

To print the full list:

```bash
npx license-checker --production --summary
```
