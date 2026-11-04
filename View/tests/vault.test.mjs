import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createVault } from '../scripts/vault.mjs';

async function fixture(t, files) {
  const directory = await mkdtemp(path.join(tmpdir(), 'developer-vault-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  for (const [name, content] of Object.entries(files)) {
    const file = path.join(directory, name);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, content);
  }
  return directory;
}

test('resolve aliases, headings, relative Markdown links, backlinks and unique undirected edges', async (t) => {
  const directory = await fixture(t, {
    'Stack.md': '[[Pasta/Nota|Uma nota]]\n[[Pasta/Nota#Introdução]]\n#Main',
    'Pasta/Nota.md': '# Introdução\n[Voltar](../Stack.md)\n[[Outra]]\n#Library',
    'Pasta/Outra.md': 'Outra nota.',
  });
  const vault = await createVault(directory);
  assert.equal(vault.notes.length, 3);
  assert.equal(vault.links.length, 2);
  assert.deepEqual(vault.unresolved, []);
  const root = vault.notes.find((note) => note.id === 'Stack');
  assert.equal(root.category, 'Main');
  assert.match(root.html, /note=Pasta%2FNota/);
  assert.match(root.html, /heading=introducao/);
  assert.match(root.html, />Uma nota<\/a>/);
  const note = vault.notes.find((note) => note.id === 'Pasta/Nota');
  assert.match(note.html, /id="introducao"/);
  assert.deepEqual(note.backlinks, ['Stack']);
  assert.equal(note.category, 'Library');
});

test('code samples do not create links or categories; tables and code remain readable', async (t) => {
  const directory = await fixture(t, {
    'Example.md': '`[[Missing]] #Main`\n\n```js\nconst sample = "[[Missing]] #Framework";\n```\n\n| Comando | Função |\n| --- | --- |\n| `pwd` | Diretório atual |',
  });
  const vault = await createVault(directory);
  assert.equal(vault.links.length, 0);
  assert.deepEqual(vault.unresolved, []);
  assert.equal(vault.notes[0].category, 'Note');
  assert.match(vault.notes[0].html, /<table>/);
  assert.match(vault.notes[0].html, /<pre><code class="language-js">/);
  assert.match(vault.notes[0].html, /\[\[Missing\]\]/);
});

test('unsafe HTML, event handlers and script URLs cannot reach the note reader', async (t) => {
  const directory = await fixture(t, {
    'Unsafe.md': '<script>alert(1)</script>\n\n<img src="x" onerror="alert(1)">\n\n[unsafe](javascript:alert%281%29)\n\n[[Other|<img src=x onerror=alert(1)>]]',
    'Other.md': 'Uma nota segura.',
  });
  const { notes } = await createVault(directory);
  const html = notes.find((note) => note.id === 'Unsafe').html;
  assert.doesNotMatch(html, /<script|onerror=\"|href="javascript:/i);
  assert.match(html, /&lt;img/);
});

test('new, renamed and deleted notes are reflected on the next generation', async (t) => {
  const directory = await fixture(t, { 'Stack.md': '[[New]]\n#Main' });
  let vault = await createVault(directory);
  assert.equal(vault.unresolved.length, 1);
  await writeFile(path.join(directory, 'New.md'), '[[Stack]]');
  vault = await createVault(directory);
  assert.equal(vault.notes.length, 2);
  assert.equal(vault.links.length, 1);
  assert.equal(vault.unresolved.length, 0);
  await rm(path.join(directory, 'New.md'));
  await writeFile(path.join(directory, 'Renamed.md'), '[[Stack]]');
  vault = await createVault(directory);
  assert.ok(vault.notes.some((note) => note.id === 'Renamed'));
  assert.ok(!vault.notes.some((note) => note.id === 'New'));
  await rm(path.join(directory, 'Renamed.md'));
  assert.equal((await createVault(directory)).notes.length, 1);
});

test('hidden folders are excluded and ambiguous titles do not silently link to the wrong note', async (t) => {
  const directory = await fixture(t, {
    'Stack.md': '[[Note]]\n[[A/Note]]',
    'A/Note.md': 'Primeira.',
    'B/Note.md': 'Segunda.',
    '.private/Secret.md': 'Não publicar.',
  });
  const vault = await createVault(directory);
  assert.equal(vault.notes.length, 3);
  assert.deepEqual(vault.unresolved, [{ note: 'Stack', target: 'Note' }]);
  assert.equal(vault.links.length, 1);
});
