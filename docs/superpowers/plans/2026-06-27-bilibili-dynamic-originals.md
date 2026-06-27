# Bilibili Dynamic Originals Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the current Tampermonkey script into a detail-page-only downloader that zips all正文 original images for one Bilibili dynamic.

**Architecture:** Keep one userscript file. Extract image URLs from the current detail page DOM plus inline page data, clean/filter/de-dupe them, then download through `GM_xmlhttpRequest` and zip with JSZip.

**Tech Stack:** Tampermonkey userscript, browser DOM APIs, `GM_xmlhttpRequest`, JSZip, Node.js built-in `assert` for local checks.

## Global Constraints

- Only support `https://www.bilibili.com/opus/<id>` and `https://t.bilibili.com/<id>`.
- Do not support user-home dynamic feed card buttons.
- Do not support paste-link downloads or multi-dynamic batch downloads.
- Do not add a desktop app, build process, package manager, or new dependency.
- Use JSZip from Tampermonkey `@require`.
- Use `GM_xmlhttpRequest` for binary image downloads.
- Keep `新建 文本文档.txt` as ignored backup, not maintained source.

---

## File Structure

- Modify `bilibili-dynamic-originals.user.js`: all runtime behavior, pure URL helpers, Tampermonkey metadata.
- Modify `checks/self-check.js`: local Node assertions for pure helper behavior.
- Modify `README.md`: install/use instructions that match detail-page-only scope.
- Modify `docs/superpowers/specs/2026-06-27-bilibili-dynamic-originals-design.md` only if implementation reveals a spec mismatch.

### Task 1: Detail-Page-Only Runtime

**Files:**
- Modify: `bilibili-dynamic-originals.user.js`
- Test: `checks/self-check.js`

**Interfaces:**
- Consumes: existing helper exports from `bilibili-dynamic-originals.user.js`.
- Produces:
  - `cleanImageUrl(value: string): string`
  - `isContentImageUrl(url: string): boolean`
  - `dedupeUrls(urls: string[]): string[]`
  - `extractUrlsFromText(text: string): string[]`
  - `imageExtension(url: string): string`

- [ ] **Step 1: Write failing checks for page-data URL extraction**

Update `checks/self-check.js` imports:

```js
const {
  cleanImageUrl,
  dedupeUrls,
  extractUrlsFromText,
  imageExtension,
  isContentImageUrl
} = require('../bilibili-dynamic-originals.user.js');
```

Add these assertions before `console.log('self-check ok');`:

```js
assert.deepEqual(
  extractUrlsFromText('{"img":"https:\\/\\/i0.hdslb.com\\/bfs\\/new_dyn\\/abc.png@1048w?x=1"}'),
  ['https://i0.hdslb.com/bfs/new_dyn/abc.png']
);
assert.deepEqual(
  dedupeUrls([
    'https://i0.hdslb.com/bfs/wbi/noise.png',
    'https://i0.hdslb.com/bfs/new_dyn/keep.webp?foo=1'
  ]),
  ['https://i0.hdslb.com/bfs/new_dyn/keep.webp']
);
```

- [ ] **Step 2: Run checks and verify failure**

Run:

```powershell
node .\checks\self-check.js
```

Expected: FAIL because `extractUrlsFromText` is not exported or does not pass the new escaped-URL assertion.

- [ ] **Step 3: Simplify userscript metadata and constants**

In `bilibili-dynamic-originals.user.js`, keep these match/connect entries:

```js
// @match        https://t.bilibili.com/*
// @match        https://www.bilibili.com/opus/*
// @require      https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js
// @grant        GM_xmlhttpRequest
// @connect      hdslb.com
// @connect      *.hdslb.com
// @connect      biliimg.com
// @connect      *.biliimg.com
// @run-at       document-idle
```

Remove:

```js
// @match        https://space.bilibili.com/*/dynamic*
// @connect      api.bilibili.com
```

Keep only detail-page constants:

```js
const BUTTON_ID = 'bili-originals-fixed-button';
const STYLE_ID = 'bili-originals-style';
const DETAIL_SELECTORS = [
  '.opus-detail',
  '.opus-module-content',
  '.bili-dyn-item',
  '.bili-dyn-card',
  'main',
  '#app'
];
```

Remove `BUTTON_CLASS`, `CARD_SELECTORS`, and `DETAIL_API`.

- [ ] **Step 4: Implement page-data extraction helpers**

In `bilibili-dynamic-originals.user.js`, keep the Node export guard and make it export:

```js
if (typeof module !== 'undefined' && module.exports && typeof document === 'undefined') {
  module.exports = { cleanImageUrl, dedupeUrls, extractUrlsFromText, imageExtension, isContentImageUrl };
  return;
}
```

Use this implementation:

```js
function extractUrlsFromText(text) {
  const normalized = String(text || '').replace(/\\u002f/gi, '/').replace(/\\\//g, '/');
  return dedupeUrls(normalized.match(/(?:https?:)?\/\/[^"'<>\s\\]+\/bfs\/[^"'<>\s\\,}\]]+/g) || []);
}

function getDocumentDataUrls() {
  return dedupeUrls(Array.from(document.scripts, (script) => extractUrlsFromText(script.textContent)).flat());
}
```

In `cleanImageUrl(value)`, include:

```js
url = url.replace(/\\u002f/gi, '/').replace(/\\\//g, '/');
```

In `isContentImageUrl(url)`, use:

```js
if (/\/bfs\/(face|emote|garb|space|account|wbi)\//.test(path)) return false;
return true;
```

- [ ] **Step 5: Remove feed-card and API runtime paths**

Delete these functions from `bilibili-dynamic-originals.user.js`:

```js
requestJson
getApiUrls
isNestedCard
ensureCardButtons
```

Update `downloadZip(root, button)` so URL collection is:

```js
const urls = dedupeUrls([
  ...getElementUrls(root),
  ...getDocumentDataUrls()
]);
```

Update `scan()` to only do:

```js
function scan() {
  installStyle();
  ensureFixedButton();
}
```

Keep:

```js
scan();
new MutationObserver(debounce(scan, 400)).observe(document.body, { childList: true, subtree: true });
setInterval(scan, 1500);
```

- [ ] **Step 6: Update button copy**

In `installStyle()`, remove all `.${BUTTON_CLASS}` CSS blocks and keep only `#${BUTTON_ID}` styles.

In `ensureFixedButton()`, set:

```js
button.textContent = '下载原图 ZIP';
```

- [ ] **Step 7: Run checks and verify pass**

Run:

```powershell
node --check .\bilibili-dynamic-originals.user.js
node .\checks\self-check.js
```

Expected:

```text
self-check ok
```

- [ ] **Step 8: Commit**

Run:

```powershell
git add bilibili-dynamic-originals.user.js checks/self-check.js
git commit -m "feat: support detail page original image zip"
```

### Task 2: Documentation Alignment

**Files:**
- Modify: `README.md`
- Modify: `docs/superpowers/specs/2026-06-27-bilibili-dynamic-originals-design.md` only if needed

**Interfaces:**
- Consumes: Task 1 behavior.
- Produces: user-facing documentation that says this is detail-page-only.

- [ ] **Step 1: Check README for scope drift**

Run:

```powershell
Select-String -Path .\README.md -Pattern '主页|卡片|批量|粘贴|space.bilibili'
```

Expected: no matches.

- [ ] **Step 2: Ensure README install/use instructions are detail-page-only**

Keep README content equivalent to:

```md
# Bilibili 动态原图打包下载

Tampermonkey 脚本：打开单条 Bilibili 动态详情页后，一键下载本条动态的所有正文原图并打包为 ZIP。

## 支持页面

- `https://www.bilibili.com/opus/<id>`
- `https://t.bilibili.com/<id>`

## 使用

1. 安装 Tampermonkey。
2. 新建脚本，粘贴 `bilibili-dynamic-originals.user.js` 的内容。
3. 打开单条动态详情页，点击右下角 `下载原图 ZIP`。

## 检查

```powershell
node --check .\bilibili-dynamic-originals.user.js
node .\checks\self-check.js
```
```

- [ ] **Step 3: Run final verification**

Run:

```powershell
node --check .\bilibili-dynamic-originals.user.js
node .\checks\self-check.js
git status --short
```

Expected:

```text
self-check ok
```

`git status --short` should show only intentional doc changes before commit.

- [ ] **Step 4: Commit and push**

Run:

```powershell
git add README.md docs/superpowers/specs/2026-06-27-bilibili-dynamic-originals-design.md
git commit -m "docs: document detail page scope"
git push
```

If there are no doc changes:

```powershell
git push
```

## Self-Review

- Spec coverage: Task 1 covers detail pages, DOM extraction, page-data extraction, URL cleanup, filtering, button states, zip download, local checks. Task 2 covers README alignment.
- Placeholder scan: no `TBD`, `TODO`, or unspecified implementation steps remain.
- Type consistency: helper names and exports match `checks/self-check.js`.
