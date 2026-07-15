# Bilibili Dynamic ZIP Filename Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Name each downloaded ZIP with the dynamic publish time, UP name, title excerpt, and dynamic ID while preserving the current filename as a safe fallback.

**Architecture:** Keep the single userscript architecture. Reuse `window.__INITIAL_STATE__` as the primary structured source, read the current detail root only for missing fields, and pass one generated filename to the existing auto-download and fallback link path. Keep filename rules in pure helpers exported to the existing Node self-check.

**Tech Stack:** Tampermonkey userscript, browser DOM APIs, JavaScript standard library, Node.js built-in `assert`.

## Global Constraints

- Final format: `YYYY-MM-DD_HHmm_UP主名_动态标题摘要_动态ID.zip`.
- Publish time uses China Standard Time (UTC+8), never download time.
- UP name is limited to 30 Unicode characters; title is limited to 40 Unicode characters.
- Remove Windows-invalid filename characters and control characters; collapse whitespace and trim trailing periods.
- Prefer formal title; otherwise use the first non-empty body line.
- Preserve the dynamic ID for uniqueness.
- If publish time, UP name, or title/body is still missing after page-data and DOM lookup, fall back to `bilibili-dynamic-<动态ID>.zip`.
- Do not add a Bilibili API request, dependency, settings UI, naming template, build step, or file.
- Auto-download and the green `保存 ZIP` fallback link must receive the same filename.
- Bump both userscript version values from `7.2.0` to `7.3.0`.

---

## File Structure

- Modify `checks/self-check.js`: assertions for metadata extraction and filename behavior.
- Modify `bilibili-dynamic-originals.user.js`: pure metadata/filename helpers plus one integration at the existing `showDownloadLink` call.

### Task 1: Descriptive ZIP Filename

**Files:**
- Modify: `checks/self-check.js`
- Modify: `bilibili-dynamic-originals.user.js`

**Interfaces:**
- Consumes: existing `getDynamicId(root)` and `showDownloadLink(blob, filename)`.
- Produces:
  - `extractInitialStateMetadata(text: string): { author: string, publishedAt: number, title: string }`
  - `buildZipFilename(metadata: object, dynamicId: string): string`
  - runtime metadata resolution from page data first and the current detail root second.

- [x] **Step 1: Write failing checks for initial-state metadata and filename rules**

Add `buildZipFilename` and `extractInitialStateMetadata` to the existing import in `checks/self-check.js`, then add these assertions before the ZIP blob check:

```js
const metadataState = JSON.stringify({
  detail: {
    modules: [
      { module_author: { name: '测试/UP主', pub_ts: 1752582960 } },
      {
        module_dynamic: {
          desc: { text: '正文第一行\n正文第二行' },
          major: { opus: { title: '正式：标题?' } }
        }
      }
    ]
  }
});

assert.deepEqual(
  extractInitialStateMetadata(`window.__INITIAL_STATE__=${metadataState};(function(){})`),
  { author: '测试/UP主', publishedAt: 1752582960, title: '正式：标题?' }
);
assert.equal(
  buildZipFilename(
    { author: '测试/UP主', publishedAt: 1752582960, title: '  正式：标题?  ' },
    '1218640478597021717'
  ),
  '2025-07-15_2036_测试 UP主_正式：标题_1218640478597021717.zip'
);
assert.equal(
  buildZipFilename(
    { author: '😀'.repeat(31), publishedAt: 1752582960, title: `标题${'好'.repeat(40)}` },
    '123'
  ),
  `2025-07-15_2036_${'😀'.repeat(30)}_标题${'好'.repeat(38)}_123.zip`
);
assert.equal(buildZipFilename({ author: '', publishedAt: 0, title: '' }, '123'), 'bilibili-dynamic-123.zip');
```

- [x] **Step 2: Run the self-check and verify RED**

Run:

```powershell
node .\checks\self-check.js
```

Expected: FAIL because `extractInitialStateMetadata` and `buildZipFilename` do not exist or are not exported.

- [x] **Step 3: Implement the minimum pure helpers**

In `bilibili-dynamic-originals.user.js`, add pure helpers near `extractInitialStateAlbumUrls`:

```js
function initialStateFromText(text) {
  const match = String(text || '').match(/window\.__INITIAL_STATE__=(.*?);\(function/);
  if (!match) return null;
  try {
    return JSON.parse(match[1]);
  } catch (_) {
    return null;
  }
}

function initialStateModules(text) {
  const state = initialStateFromText(text);
  return state && state.detail && Array.isArray(state.detail.modules) ? state.detail.modules : [];
}

function firstLine(value) {
  return String(value || '').split(/\r?\n/).map((line) => line.trim()).find(Boolean) || '';
}

function extractInitialStateMetadata(text) {
  const modules = initialStateModules(text);
  const author = (modules.find((module) => module && module.module_author) || {}).module_author || {};
  const dynamic = (modules.find((module) => module && module.module_dynamic) || {}).module_dynamic || {};
  const opus = dynamic.major && dynamic.major.opus ? dynamic.major.opus : {};
  return {
    author: author.name || '',
    publishedAt: Number(author.pub_ts) || 0,
    title: firstLine(opus.title || (dynamic.desc && dynamic.desc.text) || (opus.summary && opus.summary.text))
  };
}

function cleanFilenamePart(value, maxLength) {
  const cleaned = String(value || '')
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[. ]+$/g, '');
  return [...cleaned].slice(0, maxLength).join('').replace(/[. ]+$/g, '');
}

function formatPublishedAt(seconds) {
  const timestamp = Number(seconds);
  if (!Number.isFinite(timestamp) || timestamp <= 0) return '';
  const date = new Date((timestamp + 8 * 60 * 60) * 1000);
  const value = date.toISOString();
  return `${value.slice(0, 10)}_${value.slice(11, 16).replace(':', '')}`;
}

function buildZipFilename(metadata, dynamicId) {
  const id = String(dynamicId || '');
  const time = formatPublishedAt(metadata && metadata.publishedAt);
  const author = cleanFilenamePart(metadata && metadata.author, 30);
  const title = cleanFilenamePart(metadata && metadata.title, 40);
  if (!time || !author || !title) return `bilibili-dynamic-${id}.zip`;
  return `${time}_${author}_${title}_${id}.zip`;
}
```

Update `extractInitialStateAlbumUrls(text)` to call `initialStateModules(text)` instead of parsing the same state independently.

- [x] **Step 4: Add DOM fallback and connect the shared filename**

Add one runtime helper after `getDocumentDataUrls()`:

```js
function getDynamicMetadata(root) {
  const scripts = Array.from(document.scripts, (script) => script.textContent).join('\n');
  const metadata = extractInitialStateMetadata(scripts);
  const authorElement = root.querySelector('.opus-module-author__name, .bili-dyn-title__text, a[href*="space.bilibili.com"]');
  const timeElement = root.querySelector('time[datetime], .opus-module-author__pub__text, .bili-dyn-time');
  const titleElement = root.querySelector('.opus-module-title, .opus-module-content__title, .opus-module-content, .bili-rich-text__content');
  return {
    author: metadata.author || (authorElement && authorElement.textContent.trim()) || '',
    publishedAt: metadata.publishedAt || Number(timeElement && timeElement.dataset && timeElement.dataset.timestamp) || 0,
    title: metadata.title || firstLine(titleElement && titleElement.textContent)
  };
}
```

At the existing ZIP completion point, generate the ID and filename once:

```js
const dynamicId = getDynamicId(root);
const filename = buildZipFilename(getDynamicMetadata(root), dynamicId);
showDownloadLink(blob, filename);
```

Export `buildZipFilename` and `extractInitialStateMetadata` in the existing Node export guard. Change both `@version` and `SCRIPT_VERSION` to `7.3.0`.

- [x] **Step 5: Run local verification and verify GREEN**

Run:

```powershell
node --check .\bilibili-dynamic-originals.user.js
node .\checks\self-check.js
```

Expected: exit code `0` and output `self-check ok`.

- [x] **Step 6: Inspect the diff against the approved scope**

Run:

```powershell
git diff --check
git diff -- bilibili-dynamic-originals.user.js checks/self-check.js
```

Expected: only version, metadata/filename helpers, filename integration, exports, and focused assertions changed. No API, dependency, UI, image-selection, ZIP implementation, or unrelated formatting changes.

- [ ] **Step 7: Verify the real download in Twinkstar**

On a real `https://www.bilibili.com/opus/<id>` page in Twinkstar:

1. Record the dynamic's displayed UP name, publish time, title/body first line, and ID.
2. Click `下载原图 ZIP` once.
3. Verify a ZIP appears in `C:\Users\LKs\Downloads` with the expected `YYYY-MM-DD_HHmm_UP主名_动态标题摘要_动态ID.zip` name.
4. Verify the green `保存 ZIP` link has the same `download` filename.
5. Open the ZIP listing and verify the image entries are still `01.ext`, `02.ext`, and so on.

Expected: automatic save succeeds with the descriptive filename, the fallback link matches, and ZIP contents are unchanged.

- [x] **Step 8: Commit the verified feature**

Run:

```powershell
git add bilibili-dynamic-originals.user.js checks/self-check.js docs/superpowers/plans/2026-07-15-zip-filename.md
git commit -m "feat: name dynamic zip downloads"
```

## Self-Review

- Spec coverage: filename order, UTC+8 publish time, author/title limits, Windows cleaning, Unicode truncation, dynamic ID, primary page data, DOM fallback, legacy fallback, shared auto/manual filename, version bump, local checks, and Twinkstar acceptance are all mapped to Task 1.
- Placeholder scan: no `TBD`, `TODO`, unspecified error handling, or deferred implementation remains.
- Type consistency: test imports and runtime integration use the exact exported names `extractInitialStateMetadata` and `buildZipFilename`.
- Scope: one userscript and one existing self-check change; no new runtime file, API, dependency, or configuration surface.
