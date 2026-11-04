import test from 'node:test';
import assert from 'node:assert/strict';
import { versionRelease } from '../scripts/release.mjs';

const input = {
  html: '<head><link href="./style.css"></head><script>app.src = \'./app.js\';</script>',
  script: 'application', styles: 'styles', vault: { notes: [{ id: 'Stack', html: '<p>Study</p>' }], links: [] },
};

test('a release uses one content version for CSS, script and the page metadata', () => {
  const { version, html } = versionRelease(input);
  assert.match(version, /^[a-f0-9]{16}$/);
  assert.ok(html.includes(`href="./style.css?v=${version}"`));
  assert.ok(html.includes(`app.src = './app.js?v=${version}';`));
  assert.ok(html.includes(`<meta name="vault-version" content="${version}">`));
});

test('notes, application, styling and markup changes invalidate the previous release', () => {
  const original = versionRelease(input).version;
  for (const update of [
    { script: 'updated application' }, { styles: 'updated styles' },
    { html: `${input.html}<footer>Updated</footer>` },
    { vault: { ...input.vault, notes: [{ id: 'Stack', html: '<p>New study</p>' }] } },
  ]) assert.notEqual(versionRelease({ ...input, ...update }).version, original);
});

test('identical content stays stable across rebuilds and timestamps do not change the release', () => {
  const before = structuredClone(input);
  const first = versionRelease({ ...input, vault: { ...input.vault, generatedAt: 'old' } });
  const second = versionRelease({ ...input, vault: { ...input.vault, generatedAt: 'new' } });
  assert.deepEqual(first, second);
  assert.equal(first.version, versionRelease(input).version);
  assert.deepEqual(input, before);
});

test('a build fails rather than publishing references without cache versioning', () => {
  assert.throws(() => versionRelease({ ...input, html: '<head></head>' }), /Referências/);
});
