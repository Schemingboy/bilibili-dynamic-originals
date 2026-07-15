// ==UserScript==
// @name         Bilibili 动态原图打包下载
// @namespace    https://github.com/gragon-local/bilibili-dynamic-originals
// @version      7.3.0
// @description  在 Bilibili 单条动态/opus 页面中，一键把本条动态图片原图打包为 ZIP。
// @author       Gragon + Codex
// @match        https://t.bilibili.com/*
// @match        https://www.bilibili.com/opus/*
// @grant        GM_xmlhttpRequest
// @grant        GM_download
// @connect      hdslb.com
// @connect      *.hdslb.com
// @connect      i0.hdslb.com
// @connect      i1.hdslb.com
// @connect      i2.hdslb.com
// @connect      biliimg.com
// @connect      *.biliimg.com
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  const BUTTON_ID = 'bili-originals-fixed-button';
  const LINK_ID = 'bili-originals-download-link';
  const STYLE_ID = 'bili-originals-style';
  const SCRIPT_VERSION = '7.3.0';
  const DETAIL_SELECTORS = [
    '.opus-detail',
    '.opus-module-content',
    '.bili-dyn-item',
    '.bili-dyn-card',
    'main',
    '#app'
  ];

  function cleanImageUrl(value) {
    if (!value || typeof value !== 'string') return '';
    let url = value.trim().replace(/&amp;/g, '&');
    url = url.replace(/\\u002f/gi, '/').replace(/\\\//g, '/');
    if (!url || url.startsWith('data:') || url.startsWith('blob:')) return '';
    if (url.startsWith('//')) url = `https:${url}`;
    if (url.startsWith('http://')) url = url.replace(/^http:\/\//, 'https://');

    const firstSrcsetUrl = url.split(/\s+/)[0];
    const withoutBiliSize = firstSrcsetUrl.split('@')[0];
    return withoutBiliSize.split('?')[0];
  }

  function isContentImageUrl(url) {
    if (!url) return false;
    let parsed;
    try {
      parsed = new URL(url);
    } catch (_) {
      return false;
    }

    const host = parsed.hostname.toLowerCase();
    const path = parsed.pathname.toLowerCase();
    if (!/(^|\.)hdslb\.com$|(^|\.)biliimg\.com$/.test(host)) return false;
    if (!path.includes('/bfs/')) return false;
    if (!/\.(jpe?g|png|webp|gif|avif)$/.test(path)) return false;
    if (/\/bfs\/(face|emote|garb|space|account|wbi|static|vip|activity-plat)\//.test(path)) return false;

    return /\/bfs\/(new_dyn|article|album|dynamic|creative_common)\//.test(path);
  }

  function imageExtension(url) {
    const match = cleanImageUrl(url).match(/\.([a-z0-9]+)$/i);
    const ext = match ? match[1].toLowerCase() : 'jpg';
    return ext === 'jpeg' ? 'jpg' : ext;
  }

  function dedupeUrls(urls) {
    return [...new Set(urls.map(cleanImageUrl).filter(isContentImageUrl))];
  }

  function extractUrlsFromText(text) {
    const normalized = String(text || '').replace(/\\u002f/gi, '/').replace(/\\\//g, '/');
    return dedupeUrls(normalized.match(/(?:https?:)?\/\/[^"'<>\s\\]+\/bfs\/[^"'<>\s\\,}\]]+/g) || []);
  }

  function initialStateFromText(text) {
    const match = String(text || '').match(/window\.__INITIAL_STATE__=(.*?);\(function/);
    if (!match) return null;

    try {
      return JSON.parse(match[1]);
    } catch (_) {
      return null;
    }
  }

  function initialStateModules(value) {
    const state = typeof value === 'string' ? initialStateFromText(value) : value;
    return state && state.detail && Array.isArray(state.detail.modules) ? state.detail.modules : [];
  }

  function firstLine(value) {
    return String(value || '').split(/\r?\n/).map((line) => line.trim()).find(Boolean) || '';
  }

  function contentFirstLine(content) {
    if (!content || !Array.isArray(content.paragraphs)) return '';
    for (const paragraph of content.paragraphs) {
      const nodes = paragraph && paragraph.text && Array.isArray(paragraph.text.nodes) ? paragraph.text.nodes : [];
      const line = firstLine(nodes.map((node) => (
        (node.word && node.word.words)
        || (node.rich && node.rich.type !== 'RICH_TEXT_NODE_TYPE_EMOJI' && node.rich.text) || ''
      )).join(''));
      if (line) return line;
    }
    return '';
  }

  function extractInitialStateMetadata(value) {
    const modules = initialStateModules(value);
    const author = (modules.find((module) => module && module.module_author) || {}).module_author || {};
    const dynamic = (modules.find((module) => module && module.module_dynamic) || {}).module_dynamic || {};
    const titleModule = (modules.find((module) => module && module.module_title) || {}).module_title || {};
    const content = (modules.find((module) => module && module.module_content) || {}).module_content;
    const opus = dynamic.major && dynamic.major.opus ? dynamic.major.opus : {};
    return {
      author: author.name || '',
      publishedAt: Number(author.pub_ts) || 0,
      title: firstLine(titleModule.text || titleModule.title || opus.title || (dynamic.desc && dynamic.desc.text)
        || (opus.summary && opus.summary.text) || contentFirstLine(content))
    };
  }

  function extractInitialStateAlbumUrls(text) {
    const urls = initialStateModules(text).flatMap((module) => {
      const pics = module && module.module_top && module.module_top.display && module.module_top.display.album
        ? module.module_top.display.album.pics
        : [];
      return Array.isArray(pics) ? pics.map((pic) => pic && pic.url) : [];
    });
    return dedupeUrls(urls);
  }

  function cleanFilenamePart(value, maxLength) {
    const cleaned = String(value || '')
      .replace(/[<>:"/\\|?*\u0000-\u001f]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/[. ]+$/g, '');
    return [...cleaned].slice(0, maxLength).join('').replace(/[. ]+$/g, '');
  }

  function parsePublishedAt(value) {
    const timestamp = Number(value);
    if (Number.isFinite(timestamp) && timestamp > 0) return timestamp > 1e12 ? Math.floor(timestamp / 1000) : timestamp;
    const match = String(value || '').match(/(\d{4})年(\d{1,2})月(\d{1,2})日\s+(\d{1,2}):(\d{2})/);
    if (!match) return 0;
    return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), Number(match[4]) - 8, Number(match[5])) / 1000;
  }

  function formatPublishedAt(seconds) {
    const timestamp = parsePublishedAt(seconds);
    if (!timestamp) return '';
    const value = new Date((timestamp + 8 * 60 * 60) * 1000).toISOString();
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

  function shouldRebuildButton(existingVersion, currentVersion) {
    return existingVersion !== currentVersion;
  }

  const CRC_TABLE = Array.from({ length: 256 }, (_, index) => {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    return value >>> 0;
  });

  function crc32(bytes) {
    let crc = 0xffffffff;
    for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
  }

  function u16(value) {
    return [value & 0xff, (value >>> 8) & 0xff];
  }

  function u32(value) {
    return [value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff];
  }

  function textBytes(text) {
    return Array.from(new TextEncoder().encode(text));
  }

  function createZipBlob(files) {
    const chunks = [];
    const central = [];
    let offset = 0;

    for (const file of files) {
      const name = textBytes(file.name);
      const data = file.data instanceof Uint8Array ? file.data : new Uint8Array(file.data);
      const crc = crc32(data);
      const local = [
        ...u32(0x04034b50), ...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0),
        ...u32(crc), ...u32(data.length), ...u32(data.length), ...u16(name.length), ...u16(0), ...name
      ];

      chunks.push(new Uint8Array(local), data);
      central.push(new Uint8Array([
        ...u32(0x02014b50), ...u16(20), ...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0),
        ...u32(crc), ...u32(data.length), ...u32(data.length), ...u16(name.length), ...u16(0), ...u16(0),
        ...u16(0), ...u16(0), ...u32(0), ...u32(offset), ...name
      ]));
      offset += local.length + data.length;
    }

    const centralOffset = offset;
    let centralSize = 0;
    for (const record of central) {
      chunks.push(record);
      centralSize += record.length;
    }

    chunks.push(new Uint8Array([
      ...u32(0x06054b50), ...u16(0), ...u16(0), ...u16(files.length), ...u16(files.length),
      ...u32(centralSize), ...u32(centralOffset), ...u16(0)
    ]));
    return new Blob(chunks, { type: 'application/zip' });
  }

  if (typeof module !== 'undefined' && module.exports && typeof document === 'undefined') {
    module.exports = { buildZipFilename, cleanImageUrl, createZipBlob, crc32, dedupeUrls, extractInitialStateAlbumUrls, extractInitialStateMetadata, extractUrlsFromText, imageExtension, isContentImageUrl, parsePublishedAt, shouldRebuildButton };
    return;
  }

  function installStyle() {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #${BUTTON_ID} {
        border: 0;
        background: #00aeec;
        color: #fff;
        cursor: pointer;
        font-size: 13px;
        font-weight: 700;
        line-height: 1;
        box-shadow: 0 4px 14px rgba(0, 0, 0, .16);
      }

      #${BUTTON_ID}:hover {
        background: #0098d1;
      }

      #${LINK_ID} {
        position: fixed;
        right: 32px;
        bottom: 68px;
        z-index: 999999;
        padding: 10px 14px;
        border-radius: 999px;
        background: #18a058;
        color: #fff;
        font-size: 13px;
        font-weight: 700;
        text-decoration: none;
        box-shadow: 0 4px 14px rgba(0, 0, 0, .16);
      }

      #${BUTTON_ID} {
        position: fixed;
        right: 32px;
        bottom: 112px;
        z-index: 999999;
        min-width: 112px;
        padding: 12px 16px;
        border-radius: 999px;
      }
    `;
    document.head.appendChild(style);
  }

  function getElementUrls(root) {
    const urls = [];
    const elements = root.querySelectorAll('img, source, a, [style]');

    for (const element of elements) {
      for (const attr of ['currentSrc', 'src', 'data-src', 'data-original', 'data-url', 'href']) {
        const value = attr === 'currentSrc' ? element.currentSrc : element.getAttribute(attr);
        if (value) urls.push(value);
      }

      const srcset = element.getAttribute('srcset');
      if (srcset) {
        for (const item of srcset.split(',')) urls.push(item.trim());
      }

      const style = element.getAttribute('style') || '';
      const match = style.match(/url\(["']?([^"')]+)["']?\)/i);
      if (match) urls.push(match[1]);
    }

    return dedupeUrls(urls);
  }

  function getDocumentDataUrls() {
    const scripts = Array.from(document.scripts, (script) => script.textContent).join('\n');
    return extractInitialStateAlbumUrls(scripts);
  }

  function getDynamicMetadata(root) {
    const scripts = Array.from(document.scripts, (script) => script.textContent).join('\n');
    const metadata = extractInitialStateMetadata(window.__INITIAL_STATE__ || scripts);
    const authorElement = root.querySelector('.opus-module-author__name, .bili-dyn-title__text, a[href*="space.bilibili.com"]');
    const timeElement = root.querySelector('time[datetime], .opus-module-author__pub__text, .bili-dyn-time');
    const titleElement = root.querySelector('.opus-module-title, .opus-module-content__title, .opus-module-content, .bili-rich-text__content');
    return {
      author: metadata.author || (authorElement && authorElement.textContent.trim()) || '',
      publishedAt: metadata.publishedAt || parsePublishedAt(timeElement && (
        (timeElement.dataset && timeElement.dataset.timestamp) || timeElement.getAttribute('datetime')
        || timeElement.getAttribute('title') || timeElement.textContent
      )),
      title: metadata.title || firstLine(titleElement && titleElement.textContent)
    };
  }

  function getDynamicId(root) {
    const hrefs = [
      location.href,
      ...Array.from(root.querySelectorAll('a[href*="/opus/"], a[href*="t.bilibili.com/"]'), (a) => a.href)
    ];

    for (const href of hrefs) {
      const match = href.match(/(?:opus\/|t\.bilibili\.com\/)(\d+)/);
      if (match) return match[1];
    }

    return new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
  }

  async function requestBuffer(url) {
    try {
      const response = await fetch(url, { credentials: 'omit', referrer: location.href });
      if (response.ok) return await response.arrayBuffer();
    } catch (error) {
      console.warn('[bilibili-originals] fetch failed, trying GM_xmlhttpRequest', url, error);
    }

    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: 'GET',
        url,
        responseType: 'arraybuffer',
        timeout: 30000,
        onload: (response) => {
          if (response.status >= 200 && response.status < 300) {
            resolve(response.response);
            return;
          }
          reject(new Error(`HTTP ${response.status}`));
        },
        onerror: () => reject(new Error(`网络请求失败: ${url}`)),
        ontimeout: () => reject(new Error('请求超时'))
      });
    });
  }

  function setButtonState(button, text, color) {
    button.textContent = text;
    if (color) button.style.background = color;
  }

  function triggerDownload(url, filename, link) {
    if (typeof GM_download === 'function') {
      GM_download({
        url,
        name: filename,
        saveAs: false,
        onerror: () => link.click()
      });
      return;
    }
    link.click();
  }

  function showDownloadLink(blob, filename) {
    const existing = document.getElementById(LINK_ID);
    if (existing) {
      URL.revokeObjectURL(existing.href);
      existing.remove();
    }

    const link = document.createElement('a');
    link.id = LINK_ID;
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.textContent = '保存 ZIP';
    document.body.appendChild(link);
    triggerDownload(link.href, filename, link);
  }

  async function downloadZip(root, button) {
    if (button.dataset.loading === '1') return;

    button.dataset.loading = '1';
    const originalText = button.textContent;
    const originalBackground = button.style.background;

    try {
      setButtonState(button, '读取图片', '#f69');
      const dataUrls = getDocumentDataUrls();
      const urls = dataUrls.length ? dataUrls : getElementUrls(root);

      if (!urls.length) {
        alert('没有找到这条动态里的原图。先展开图片或滚动到图片加载出来，再点一次。');
        return;
      }

      const files = [];
      const failedUrls = [];
      for (let index = 0; index < urls.length; index += 1) {
        setButtonState(button, `${index + 1}/${urls.length}`, '#f69');
        try {
          files.push({
            name: `${String(index + 1).padStart(2, '0')}.${imageExtension(urls[index])}`,
            data: new Uint8Array(await requestBuffer(urls[index]))
          });
        } catch (error) {
          console.error('[bilibili-originals] image download failed', urls[index], error);
          failedUrls.push(urls[index]);
        }
      }

      if (failedUrls.length) {
        files.push({ name: 'failed-urls.txt', data: new TextEncoder().encode(failedUrls.join('\n')) });
      }

      setButtonState(button, '生成 ZIP', '#fa8c16');
      const blob = createZipBlob(files);
      const dynamicId = getDynamicId(root);
      showDownloadLink(blob, buildZipFilename(getDynamicMetadata(root), dynamicId));

      setButtonState(button, failedUrls.length ? `完成 ${urls.length - failedUrls.length}/${urls.length}` : '完成', '#18a058');
    } catch (error) {
      console.error('[bilibili-originals]', error);
      setButtonState(button, `失败: ${error.message}`, '#d03050');
    } finally {
      setTimeout(() => {
        button.dataset.loading = '0';
        button.textContent = originalText;
        button.style.background = originalBackground;
      }, 3000);
    }
  }

  function isDetailPage() {
    return /\/opus\/\d+/.test(location.pathname) || (location.hostname === 't.bilibili.com' && /^\/\d+/.test(location.pathname));
  }

  function findDetailRoot() {
    for (const selector of DETAIL_SELECTORS) {
      const element = document.querySelector(selector);
      if (element && getElementUrls(element).length) return element;
    }
    return document.body;
  }

  function ensureFixedButton() {
    const existing = document.getElementById(BUTTON_ID);
    if (!isDetailPage()) {
      if (existing) existing.remove();
      return;
    }

    if (existing && !shouldRebuildButton(existing.dataset.version, SCRIPT_VERSION)) return;
    if (existing) existing.remove();
    const button = document.createElement('button');
    button.id = BUTTON_ID;
    button.type = 'button';
    button.dataset.version = SCRIPT_VERSION;
    button.title = `Bilibili 动态原图打包下载 v${SCRIPT_VERSION}`;
    button.textContent = '下载原图 ZIP';
    button.addEventListener('click', () => downloadZip(findDetailRoot(), button));
    document.body.appendChild(button);
  }

  function scan() {
    installStyle();
    ensureFixedButton();
  }

  function debounce(fn, delay) {
    let timer = 0;
    return () => {
      clearTimeout(timer);
      timer = setTimeout(fn, delay);
    };
  }

  scan();
  new MutationObserver(debounce(scan, 400)).observe(document.body, { childList: true, subtree: true });
  setInterval(scan, 1500);
})();
