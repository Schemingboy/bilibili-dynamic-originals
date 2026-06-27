// ==UserScript==
// @name         Bilibili 动态原图打包下载
// @namespace    https://github.com/gragon-local/bilibili-dynamic-originals
// @version      7.1.8
// @description  在 Bilibili 单条动态/opus 页面中，一键把本条动态图片原图打包为 ZIP。
// @author       Gragon + Codex
// @match        https://t.bilibili.com/*
// @match        https://www.bilibili.com/opus/*
// @require      https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js
// @grant        GM_xmlhttpRequest
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
  const SCRIPT_VERSION = '7.1.8';
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

  function extractInitialStateAlbumUrls(text) {
    const match = String(text || '').match(/window\.__INITIAL_STATE__=(.*?);\(function/);
    if (!match) return [];

    try {
      const state = JSON.parse(match[1]);
      const modules = state && state.detail && Array.isArray(state.detail.modules) ? state.detail.modules : [];
      const urls = modules.flatMap((module) => {
        const pics = module && module.module_top && module.module_top.display && module.module_top.display.album
          ? module.module_top.display.album.pics
          : [];
        return Array.isArray(pics) ? pics.map((pic) => pic && pic.url) : [];
      });
      return dedupeUrls(urls);
    } catch (error) {
      console.warn('[bilibili-originals] initial state parse failed', error);
      return [];
    }
  }

  function shouldRebuildButton(existingVersion, currentVersion) {
    return existingVersion !== currentVersion;
  }

  if (typeof module !== 'undefined' && module.exports && typeof document === 'undefined') {
    module.exports = { cleanImageUrl, dedupeUrls, extractInitialStateAlbumUrls, extractUrlsFromText, imageExtension, isContentImageUrl, shouldRebuildButton };
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
    link.click();
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

      const zip = new JSZip();
      const failedUrls = [];
      for (let index = 0; index < urls.length; index += 1) {
        setButtonState(button, `${index + 1}/${urls.length}`, '#f69');
        try {
          zip.file(`${String(index + 1).padStart(2, '0')}.${imageExtension(urls[index])}`, await requestBuffer(urls[index]));
        } catch (error) {
          console.error('[bilibili-originals] image download failed', urls[index], error);
          failedUrls.push(urls[index]);
        }
      }

      if (failedUrls.length) {
        zip.file('failed-urls.txt', failedUrls.join('\n'));
      }

      setButtonState(button, '生成 ZIP', '#fa8c16');
      const blob = await zip.generateAsync({ type: 'blob', compression: 'STORE', streamFiles: true });
      showDownloadLink(blob, `bilibili-dynamic-${getDynamicId(root)}.zip`);

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
