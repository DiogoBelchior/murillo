# 🎬 Pesquisa de Filmes

Pequena aplicação web que **pesquisa e filtra filmes** usando dados de uma API pública.

## API usada

**iTunes Search API** (Apple) — listada em [public-apis](https://github.com/public-apis/public-apis) (secção *Music / iTunes Search*).

- Uso livre, **sem chave de API** e sem registo.
- Documentação oficial: <https://performance-partners.apple.com/search-api>
- Limite aproximado: ~20 pedidos por minuto.

Pedido HTTP feito pela aplicação (**GET**):

```
GET https://itunes.apple.com/search?term=matrix&media=movie&entity=movie&country=pt&limit=100
```

## Campos extraídos do JSON

De cada elemento de `results[]`:

| Campo da API             | Uso na aplicação              |
|--------------------------|-------------------------------|
| `trackName`              | Título                        |
| `artistName`             | Realizador                    |
| `primaryGenreName`       | Género (filtro)               |
| `releaseDate`            | Ano de estreia (filtro/ordem) |
| `artworkUrl100`          | Poster (aumentado p/ 600px)   |
| `longDescription`        | Sinopse                       |
| `contentAdvisoryRating`  | Classificação etária (filtro) |
| `trackTimeMillis`        | Duração em minutos            |
| `trackViewUrl`           | Link para a Apple TV / iTunes |

## Linguagem / framework

**HTML5 + CSS3 + JavaScript puro (ES2020)** — sem frameworks, sem dependências e sem passo de build.

## Como executar

1. Descompacte o zip.
2. Abra o ficheiro `index.html` num browser moderno (Chrome, Firefox, Edge, Safari).

Opcionalmente, sirva a pasta com um servidor local:

```bash
python3 -m http.server 8000
# depois abra http://localhost:8000
```

É necessária ligação à internet (os dados vêm da API em tempo real).

## Como funciona

1. **Pesquisa** — escreva um título, realizador ou palavra-chave, escolha a loja (Portugal, Brasil, EUA, Reino Unido) e carregue em *Pesquisar*. É feito um `fetch` (GET) à API.
2. **Parse** — o JSON é convertido em objetos simples com os campos da tabela acima (`normalizar()` em `app.js`).
3. **Filtros** (aplicados instantaneamente no browser sobre os resultados):
   - Género e classificação etária (opções geradas a partir dos resultados);
   - Intervalo de anos (de / até);
   - Texto livre (procura no título, realizador e sinopse);
   - Ordenação: relevância, mais recentes, mais antigos, título A–Z, duração.
4. **Detalhe** — clique num filme (ou Enter) para ver poster grande, sinopse, realizador, duração e link.

## Tratamento de erros

- **API sem resposta** (timeout de 10 s) → mensagem "A API demorou demasiado a responder".
- **Sem rede / pedido bloqueado** → tenta automaticamente via JSONP (também suportado pela API); se falhar, mostra "Não foi possível contactar a API".
- **Erro HTTP** (ex.: 500) → "A API devolveu erro 500"; 403/429 → aviso de limite de pedidos.
- **JSON inválido ou formato inesperado** → mensagem própria.
- **Sem resultados** / **filtros sem correspondência** → mensagem informativa.
- Todas as mensagens de erro têm um botão **Tentar novamente**.
- Posters que não carregam não partem o layout.

## Estrutura

```
pesquisa-filmes/
├── index.html   # estrutura da página
├── style.css    # estilos (suporta modo escuro)
├── app.js       # pedido HTTP, parse, filtros, renderização e erros
└── README.md
```
