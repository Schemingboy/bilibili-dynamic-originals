const assert = require('node:assert/strict');
const {
  cleanImageUrl,
  dedupeUrls,
  extractUrlsFromText,
  imageExtension,
  isContentImageUrl
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

console.log('self-check ok');
