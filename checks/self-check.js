const assert = require('node:assert/strict');
const {
  cleanImageUrl,
  dedupeUrls,
  imageExtension,
  isContentImageUrl
} = require('../bilibili-dynamic-originals.user.js');

assert.equal(
  cleanImageUrl('//i0.hdslb.com/bfs/new_dyn/demo.jpg@1048w_!web-dynamic.avif?x=1'),
  'https://i0.hdslb.com/bfs/new_dyn/demo.jpg'
);
assert.equal(isContentImageUrl('https://i0.hdslb.com/bfs/new_dyn/demo.png'), true);
assert.equal(isContentImageUrl('https://i0.hdslb.com/bfs/face/avatar.jpg'), false);
assert.deepEqual(
  dedupeUrls([
    'https://i0.hdslb.com/bfs/article/a.jpeg@100w',
    'https://i0.hdslb.com/bfs/article/a.jpeg',
    'https://i0.hdslb.com/bfs/emote/no.png'
  ]),
  ['https://i0.hdslb.com/bfs/article/a.jpeg']
);
assert.equal(imageExtension('https://i0.hdslb.com/bfs/article/a.jpeg@100w'), 'jpg');

console.log('self-check ok');
