import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { Marked } from 'marked';
import sanitizeHtml from 'sanitize-html';

export const categories = [
  { id: 'Main', label: 'Ponto de partida', color: '#ee777c' },
  { id: 'Class', label: 'Áreas de estudo', color: '#e6bb73' },
  { id: 'Leanguage', label: 'Linguagens', color: '#b7d87b' },
  { id: 'Library', label: 'Bibliotecas', color: '#71bed9' },
  { id: 'Framework', label: 'Frameworks', color: '#b798e7' },
  { id: 'Note', label: 'Outras notas', color: '#a2abb9' },
];

const escape = (value) => value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const normalize = (value) => value.normalize('NFC').toLocaleLowerCase('pt-BR');
export const headingId = (value) => value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/[^\p{L}\p{N}\s_-]/gu, '').trim().replace(/\s+/g, '-');
export const noteUrl = (id, heading) => `#${new URLSearchParams({ note: id, ...(heading ? { heading: headingId(heading) } : {}) })}`;

async function markdownFiles(directory, prefix = '') {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))) {
    if (entry.name.startsWith('.') || entry.isSymbolicLink()) continue;
    const relative = path.posix.join(prefix, entry.name);
    if (entry.isDirectory()) files.push(...await markdownFiles(path.join(directory, entry.name), relative));
    else if (entry.name.endsWith('.md')) files.push(relative);
  }
  return files;
}

export async function createVault(directory) {
  const files = await markdownFiles(directory);
  const notes = await Promise.all(files.map(async (file) => ({
    id: file.slice(0, -3), title: path.posix.basename(file, '.md'), path: `Stack/${file}`,
    markdown: await readFile(path.join(directory, file), 'utf8'),
  })));
  const ids = new Map(notes.map((note) => [normalize(note.id), note]));
  const names = new Map();
  for (const note of notes) {
    const key = normalize(note.title);
    names.set(key, [...(names.get(key) || []), note]);
  }
  function resolve(target, current) {
    const clean = target.replace(/\.md$/i, '').replace(/^Stack\//i, '').replace(/^\//, '');
    if (!clean) return current;
    const relative = path.posix.normalize(path.posix.join(path.posix.dirname(current.id), clean));
    const matches = names.get(normalize(clean));
    return ids.get(normalize(relative)) || ids.get(normalize(clean)) || (matches?.length === 1 ? matches[0] : undefined);
  }
  const links = new Map();
  const unresolved = [];
  for (const note of notes) {
    const tags = new Set();
    const outbound = new Set();
    const connect = (target) => {
      if (target.id === note.id) return;
      outbound.add(target.id);
      const pair = [note.id, target.id].sort();
      links.set(JSON.stringify(pair), { source: pair[0], target: pair[1] });
    };
    const usedHeadings = new Map();
    const parser = new Marked({ gfm: true, breaks: false });
    parser.use({
      extensions: [{
        name: 'wiki', level: 'inline',
        start: (src) => src.indexOf('[['),
        tokenizer(src) {
          const match = /^\[\[([^\]\n]+)\]\]/.exec(src);
          if (match) return { type: 'wiki', raw: match[0], value: match[1] };
        },
        renderer(token) {
          const [destination, alias] = token.value.split('|');
          const [rawTarget, heading] = destination.split('#');
          const target = resolve(rawTarget.trim(), note);
          const label = escape(alias || heading || rawTarget);
          if (!target) {
            unresolved.push({ note: note.id, target: rawTarget });
            return `<span class="unresolved" title="Nota ainda não disponível">${label}</span>`;
          }
          connect(target);
          return `<a class="wikilink" href="${escape(noteUrl(target.id, heading))}">${label}</a>`;
        },
      }, {
        name: 'vaultTag', level: 'inline',
        start: (src) => src.search(/#[\p{L}]/u),
        tokenizer(src) {
          const match = /^#([\p{L}\p{N}_/-]+)/u.exec(src);
          if (match) return { type: 'vaultTag', raw: match[0], value: match[1] };
        },
        renderer(token) {
          tags.add(token.value);
          return `<span class="note-tag">#${escape(token.value)}</span>`;
        },
      }],
      renderer: {
        heading(token) {
          const base = headingId(token.text);
          const count = usedHeadings.get(base) || 0;
          usedHeadings.set(base, count + 1);
          return `<h${token.depth} id="${base}${count ? `-${count}` : ''}">${this.parser.parseInline(token.tokens)}</h${token.depth}>`;
        },
        link(token) {
          let href = token.href;
          if (!/^[a-z][a-z\d+.-]*:/i.test(href) && !href.startsWith('//')) {
            let decoded;
            try { decoded = decodeURIComponent(href); } catch { decoded = href; }
            const [destination, heading] = decoded.split('#');
            const target = resolve(destination, note);
            if (target) { connect(target); href = noteUrl(target.id, heading); }
          }
          return `<a href="${escape(href)}"${/^https?:/i.test(href) ? ' target="_blank" rel="noopener noreferrer"' : ''}>${this.parser.parseInline(token.tokens)}</a>`;
        },
      },
    });
    note.html = sanitizeHtml(parser.parse(note.markdown), {
      allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img']),
      allowedAttributes: { ...sanitizeHtml.defaults.allowedAttributes, '*': ['class', 'id', 'title'], a: ['href', 'target', 'rel'], img: ['src', 'alt', 'title'] },
      allowedSchemes: ['http', 'https', 'mailto'],
      allowProtocolRelative: false,
    });
    note.tags = [...tags];
    note.category = categories.find((category) => tags.has(category.id))?.id || 'Note';
    note.outbound = [...outbound];
    note.words = note.markdown.trim().split(/\s+/).length;
    delete note.markdown;
  }
  for (const note of notes) note.backlinks = notes.filter((other) => other.outbound.includes(note.id)).map((other) => other.id);
  return { categories, notes, links: [...links.values()], unresolved };
}
