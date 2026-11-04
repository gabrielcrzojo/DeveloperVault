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

- Clique em um ponto ou título da lista para aproximar suavemente a câmera da nota e abrir a descrição em tela completa. O retorno mantém a posição e o zoom anteriores; `Esc` cancela a aproximação. A preferência de movimento reduzido abre a nota diretamente.
- Use **Continue explorando**, ao final da nota, para seguir conexões. Tags e referências isoladas não aparecem no corpo da leitura; menções a outras notas dentro de frases são preservadas como texto. O endereço com `#note=...` permite compartilhar uma nota diretamente.
- Use **Voltar ao mapa** ou `Esc` para retornar sem perder filtros, zoom ou posições.
- Busque com `/` e clique em uma categoria para exibir somente as notas com aquela tag. Use **Todas as notas** para restaurar o conjunto completo. Arraste os pontos e use zoom com a roda do mouse ou gesto de pinça.
- A lista prioriza a menor distância em conexões até a Stack, com ordem alfabética nos empates. Em 100%, todos os nomes aparecem, com os mais distantes um pouco mais apagados. Ao afastar o mapa, os nomes mais distantes desaparecem gradualmente; bem afastado, ficam apenas os pontos e fios. Ao aproximar, os nomes retornam e os pontos crescem suavemente, com um limite de 45% sobre o tamanho inicial.
- Ao abrir o mapa, uma onda radial revela a Stack e seus ramos em todas as direções ao mesmo tempo: cada fio cresce até seu destino, e só então a nota aparece. A estrela de quatro pontas centraliza automaticamente o mapa, restaura a visão completa e repete a sequência; ela substitui o botão separado de centralização. Busca, filtros ou abertura de uma nota encerram a sequência imediatamente. As animações usam recursos nativos do navegador, são liberadas ao concluir e respeitam a preferência de movimento reduzido do sistema.
- A lista e os pontos podem ser usados pelo teclado; `Enter` abre a nota.
- Os botões de zoom interpolam a câmera e cedem imediatamente à roda do mouse, ao arraste ou a `Esc`. Busca e gestos agrupam as atualizações por quadro; a lista e o conteúdo preparado das notas são reaproveitados. Trocas de nota e retorno ao mapa usam transições curtas, preservando o zoom, os filtros e a posição de leitura de cada nota.

## Categorias e links

As tags atuais definem as categorias: `#Main`, `#Class`, `#Leanguage`, `#Library` e `#Framework`. A grafia `Leanguage` acompanha as notas existentes. Notas sem essas tags continuam acessíveis em **Todas as notas**, com a cor cinza. `#Main` mantém a cor do ponto central; apenas áreas, linguagens, bibliotecas e frameworks aparecem como filtros específicos. Cores e rótulos são definidos em `scripts/vault.mjs`.

O gerador resolve wikilinks (`[[Nota]]`, `[[Nota|rótulo]]`, `[[Nota#Seção]]`) e links Markdown para notas. Links em blocos de código não geram conexões. Notas em subpastas podem usar caminhos relativos ou o nome completo a partir de `Stack/`; nomes de arquivo duplicados exigem um caminho inequívoco. Notas ausentes são sinalizadas na geração e exibidas sem link ativo.

Bibliotecas utilizadas: D3 para a interação do grafo e uma distribuição radial por ramos para organizar as conexões, Marked para Markdown, sanitize-html para higienização e esbuild para empacotar o JavaScript. Nenhum serviço de edição ou backend é necessário.
