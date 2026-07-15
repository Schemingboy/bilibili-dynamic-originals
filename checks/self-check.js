const assert = require('node:assert/strict');
const {
  buildZipFilename,
  cleanImageUrl,
  createZipBlob,
  crc32,
  dedupeUrls,
  extractInitialStateMetadata,
  extractInitialStateAlbumUrls,
  extractUrlsFromText,
  imageExtension,
  isContentImageUrl,
  parsePublishedAt,
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
assert.equal(shouldRebuildButton(undefined, '7.2.0'), true);
assert.equal(shouldRebuildButton('', '7.2.0'), true);
assert.equal(shouldRebuildButton('7.2.0', '7.3.0'), true);
assert.equal(shouldRebuildButton('7.3.0', '7.3.0'), false);
assert.equal(crc32(new TextEncoder().encode('hello')), 0x3610a686);

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
assert.deepEqual(
  extractInitialStateMetadata({
    detail: {
      modules: [
        { module_author: { name: '新版UP主', pub_ts: '1782575247' } },
        {
          module_content: {
            paragraphs: [{ text: { nodes: [
              { word: { words: '正文第一行😀' } },
              { rich: { text: '[表情]', type: 'RICH_TEXT_NODE_TYPE_EMOJI' } }
            ] } }]
          }
        }
      ]
    }
  }),
  { author: '新版UP主', publishedAt: 1782575247, title: '正文第一行😀' }
);
assert.equal(parsePublishedAt('2026年06月27日 23:47'), 1782575220);
assert.equal(parsePublishedAt('2026-07-15T10:02:00+08:00'), 1784080920);
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
assert.equal(
  buildZipFilename({ author: 'UP主', publishedAt: Number.MAX_VALUE, title: '标题' }, '123'),
  'bilibili-dynamic-123.zip'
);

(async () => {
  const blob = createZipBlob([{ name: 'hello.txt', data: new TextEncoder().encode('hello') }]);
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const text = new TextDecoder().decode(bytes);
  assert.equal(bytes[0], 0x50);
  assert.equal(bytes[1], 0x4b);
  assert.equal(text.includes('hello.txt'), true);
  console.log('self-check ok');
})();
