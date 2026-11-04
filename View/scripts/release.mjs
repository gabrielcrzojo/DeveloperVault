import { createHash } from 'node:crypto';

export function versionRelease({ html, script, styles, vault }) {
  // Timestamps are metadata: rebuilding identical content keeps the same URLs.
  const { generatedAt, ...content } = vault;
  const hash = createHash('sha256');
  for (const value of [html, script, styles, JSON.stringify(content)]) hash.update(value).update('\0');
  const version = hash.digest('hex').slice(0, 16);
  if (!html.includes('href="./style.css"') || !html.includes("app.src = './app.js';") || !html.includes('</head>')) {
    throw new Error('Referências aos arquivos do site não encontradas; a publicação precisa versionar CSS e JavaScript.');
  }
  return {
    version,
    html: html.replace('href="./style.css"', `href="./style.css?v=${version}"`)
      .replace("app.src = './app.js';", `app.src = './app.js?v=${version}';`)
      .replace('</head>', `  <meta name="vault-version" content="${version}">\n</head>`),
  };
}
