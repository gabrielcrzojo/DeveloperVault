# Visualização do DeveloperVault

Site estático em HTML, CSS e JavaScript. As notas de `Stack/**/*.md` são a fonte de conteúdo; não é necessário atualizar uma lista manualmente. O gerador monta as conexões, renderiza o Markdown e higieniza o HTML. Os scripts, dependências e configurações locais não entram na publicação.

## Executar localmente

Com Node.js 22 ou superior, a partir da raiz do repositório:

```sh
npm ci --prefix View
npm run dev --prefix View
```

Abra `http://127.0.0.1:4173`. Alterações em `Stack/`, `View/src/` e `View/assets/` geram novamente o site e recarregam a página. Para outro porto, use `PORT=4174 npm run dev --prefix View`.

```sh
npm test --prefix View
npm run build --prefix View
npm run preview --prefix View
```

O resultado da geração fica em `View/dist/`. Essa pasta é ignorada pelo Git e gerada novamente no GitHub Actions. Abrir o HTML pelo protocolo `file://` não carrega os dados: use o servidor local.

## Publicar no GitHub Pages

O GitHub Pages deste repositório já está habilitado com **GitHub Actions** como origem de publicação.

1. Envie os arquivos da implementação e as notas que deseja publicar à branch `main`.
2. Em **Actions → Publicar mapa de conhecimento**, acompanhe a execução. Se necessário, use **Run workflow**.
3. Se estiver usando um fork, abra **Settings → Pages → Build and deployment → Source** e selecione **GitHub Actions** antes da primeira publicação.

O endereço configurado é [gabrielcrzojo.github.io/DeveloperVault/](https://gabrielcrzojo.github.io/DeveloperVault/). Ele passa a exibir o site após a primeira publicação bem-sucedida; a URL também aparece no ambiente `github-pages`.

Cada push na `main` gera e publica as notas daquele commit, incluindo notas novas, alterações, renomeações e exclusões. Pull requests executam os testes e a geração, sem publicar. Edições apenas locais aparecem no servidor de desenvolvimento; o site público recebe as alterações após o push e a conclusão do workflow.

## Navegação

- Clique em um ponto ou título para abrir a nota em tela completa.
- Use os links da nota para seguir conexões. O endereço com `#note=...` permite compartilhar uma nota diretamente.
- Use **Voltar ao mapa** ou `Esc` para retornar sem perder filtros, zoom ou posições.
- Busque com `/` e clique em uma categoria para exibir somente as notas com aquela tag. Use **Todas as notas** para restaurar o conjunto completo. Arraste os pontos e use zoom com a roda do mouse ou gesto de pinça.
- Os controles permitem restaurar a visão geral e pausar o movimento. A preferência de movimento reduzido do sistema é respeitada.
- A lista e os pontos podem ser usados pelo teclado; `Enter` abre a nota.

## Categorias e links

As tags atuais definem as categorias: `#Main`, `#Class`, `#Leanguage`, `#Library` e `#Framework`. A grafia `Leanguage` acompanha as notas existentes. Notas sem essas tags ficam em **Outras notas**. Cores e rótulos são definidos em `scripts/vault.mjs`.

O gerador resolve wikilinks (`[[Nota]]`, `[[Nota|rótulo]]`, `[[Nota#Seção]]`) e links Markdown para notas. Links em blocos de código não geram conexões. Notas em subpastas podem usar caminhos relativos ou o nome completo a partir de `Stack/`; nomes de arquivo duplicados exigem um caminho inequívoco. Notas ausentes são sinalizadas na geração e exibidas sem link ativo.

Bibliotecas utilizadas: D3 para a física e interação do grafo, Marked para Markdown, sanitize-html para higienização e esbuild para empacotar o JavaScript. Nenhum serviço de edição ou backend é necessário.
