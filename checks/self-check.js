const assert = require('node:assert/strict');
const {
  cleanImageUrl,
  createZipBlob,
  crc32,
  dedupeUrls,
  extractInitialStateAlbumUrls,
  extractUrlsFromText,
  imageExtension,
  isContentImageUrl,
  shouldRebuildButton
} = require('../bilibili-dynamic-originals.user.js');

assert.equal(
  cleanImageUrl('//i0.hdslb.com/bfs/new_dyn/demo.jpg@1048w_!web-dynamic.avif?x=1'),
  'https://i0.hdslb.com/bfs/new_dyn/demo.jpg'
);
assert.equal(isContentImageUrl('https://i0.hdslb.com/bfs/new_dyn/demo.png'), true);
assert.equal(isContentImageUrl('https://i0.hdslb.com/bfs/face/avatar.jpg'), false);
assert.equal(isContentImageUrl('https://i0.hdslb.com/bfs/static/jinkela/video/asserts/22-coin-ani.png'), false);
assert.equal(isContentImageUrl('https://i0.hdslb.com/bfs/vip/label_annual.png'), false);
assert.deepEqual(
  dedupeUrls([
    'https://i0.hdslb.com/bfs/article/a.jpeg@100w',
    'https://i0.hdslb.com/bfs/article/a.jpeg',
    'https://i0.hdslb.com/bfs/emote/no.png'
  ]),
  ['https://i0.hdslb.com/bfs/article/a.jpeg']
);
assert.equal(imageExtension('https://i0.hdslb.com/bfs/article/a.jpeg@100w'), 'jpg');
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
assert.deepEqual(
  extractInitialStateAlbumUrls('window.__INITIAL_STATE__={"detail":{"modules":[{"module_top":{"display":{"album":{"pics":[{"url":"http:\\/\\/i0.hdslb.com\\/bfs\\/new_dyn\\/album.jpg@80w","width":4284}]}}}}]}};(function(){})'),
  ['https://i0.hdslb.com/bfs/new_dyn/album.jpg']
);
assert.deepEqual(
  extractInitialStateAlbumUrls('<img src="//i0.hdslb.com/bfs/new_dyn/thumb.jpg@80w_80h_1c">'),
  []
);
assert.equal(shouldRebuildButton(undefined, '7.1.9'), true);
assert.equal(shouldRebuildButton('', '7.1.9'), true);
assert.equal(shouldRebuildButton('7.1.8', '7.1.9'), true);
assert.equal(shouldRebuildButton('7.1.9', '7.1.9'), false);
assert.equal(crc32(new TextEncoder().encode('hello')), 0x3610a686);

(async () => {
  const blob = createZipBlob([{ name: 'hello.txt', data: new TextEncoder().encode('hello') }]);
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const text = new TextDecoder().decode(bytes);
  assert.equal(bytes[0], 0x50);
  assert.equal(bytes[1], 0x4b);
  assert.equal(text.includes('hello.txt'), true);
  console.log('self-check ok');
})();
