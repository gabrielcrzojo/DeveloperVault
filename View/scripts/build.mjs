import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { createVault } from './vault.mjs';

export const viewDirectory = fileURLToPath(new URL('..', import.meta.url));
export const outputDirectory = path.join(viewDirectory, 'dist');

export async function buildSite() {
  const vault = await createVault(path.join(viewDirectory, '..', 'Stack'));
  await rm(outputDirectory, { recursive: true, force: true });
  await mkdir(outputDirectory, { recursive: true });
  await cp(path.join(viewDirectory, 'assets'), path.join(outputDirectory, 'assets'), { recursive: true });
  await cp(path.join(viewDirectory, 'src', 'style.css'), path.join(outputDirectory, 'style.css'));
  await writeFile(path.join(outputDirectory, 'index.html'), await readFile(path.join(viewDirectory, 'src', 'index.html')));
  await writeFile(path.join(outputDirectory, 'vault.json'), JSON.stringify({ ...vault, generatedAt: new Date().toISOString() }));
  await writeFile(path.join(outputDirectory, '.nojekyll'), '');
  await build({ entryPoints: [path.join(viewDirectory, 'src', 'app.js')], outfile: path.join(outputDirectory, 'app.js'), bundle: true, minify: true, format: 'esm', target: ['es2022'], legalComments: 'eof' });
  console.log(`View: ${vault.notes.length} notas, ${vault.links.length} conexões → View/dist`);
  if (vault.unresolved.length) console.warn('Links para notas ausentes:', vault.unresolved);
  return vault;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await buildSite();
