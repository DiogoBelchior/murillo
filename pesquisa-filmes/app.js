/**
 * Pesquisa de Filmes — lógica da aplicação
 *
 * API:        iTunes Search API (Apple), gratuita, sem chave, com documentação oficial:
 *             https://performance-partners.apple.com/search-api
 * Pedido:     GET https://itunes.apple.com/search?term=<termo>&media=movie&entity=movie&country=<pt>&limit=100
 * Campos extraídos do JSON (results[]):
 *   trackName               -> título
 *   artistName              -> realizador
 *   primaryGenreName        -> género
 *   releaseDate             -> data/ano de estreia
 *   artworkUrl100           -> imagem do poster (aumentada para 600x600)
 *   longDescription         -> sinopse
 *   contentAdvisoryRating   -> classificação etária
 *   trackTimeMillis         -> duração
 *   trackViewUrl            -> link para a página na Apple TV / iTunes
 * Linguagem:  JavaScript puro (ES2020) no browser, sem frameworks.
 */

const API_URL = 'https://itunes.apple.com/search';
const TIMEOUT_MS = 10000;

const $ = (sel) => document.querySelector(sel);
const el = {
  form: $('#form-pesquisa'), termo: $('#termo'), pais: $('#pais'),
  filtros: $('#filtros'), genero: $('#f-genero'), anoMin: $('#f-ano-min'), anoMax: $('#f-ano-max'),
  classificacao: $('#f-classificacao'), texto: $('#f-texto'), ordem: $('#f-ordem'), limpar: $('#limpar'),
  estado: $('#estado'), resultados: $('#resultados'),
  dialog: $('#detalhe'), detalhe: $('#detalhe-conteudo'),
};

let filmes = []; // resultados normalizados da última pesquisa

/* ---------- 1. Pedido HTTP (GET) ---------- */

class ApiError extends Error {}

async function pedirFilmes(termo, pais) {
  const params = new URLSearchParams({
    term: termo, media: 'movie', entity: 'movie', country: pais, limit: '100',
  });
  const url = `${API_URL}?${params}`;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  let resposta;
  try {
    resposta = await fetch(url, { signal: ctrl.signal });
  } catch (e) {
    if (e.name === 'AbortError') throw new ApiError('A API demorou demasiado a responder (timeout). Tente novamente.');
    // fetch falhou (sem rede ou CORS bloqueado): tenta JSONP, também suportado pela API
    try {
      return await pedirJsonp(url);
    } catch {
      throw new ApiError('Não foi possível contactar a API. Verifique a ligação à internet.');
    }
  } finally {
    clearTimeout(timer);
  }

  if (!resposta.ok) {
    const motivo = resposta.status === 403 || resposta.status === 429
      ? 'Limite de pedidos atingido — aguarde um minuto.'
      : `A API devolveu erro ${resposta.status}.`;
    throw new ApiError(motivo);
  }

  try {
    return await resposta.json();
  } catch {
    throw new ApiError('A resposta da API não é JSON válido.');
  }
}

function pedirJsonp(url) {
  return new Promise((resolve, reject) => {
    const cb = `__itunes_cb_${Date.now()}`;
    const script = document.createElement('script');
    const limpar = () => { delete window[cb]; script.remove(); clearTimeout(t); };
    const t = setTimeout(() => { limpar(); reject(new Error('timeout')); }, TIMEOUT_MS);
    window[cb] = (dados) => { limpar(); resolve(dados); };
    script.onerror = () => { limpar(); reject(new Error('jsonp')); };
    script.src = `${url}&callback=${cb}`;
    document.head.appendChild(script);
  });
}

/* ---------- 2. Parse do JSON ---------- */

function normalizar(dados) {
  if (!dados || !Array.isArray(dados.results)) throw new ApiError('Formato de resposta inesperado.');
  return dados.results
    .filter((r) => r.kind === 'feature-movie' || r.wrapperType === 'track')
    .map((r, i) => {
      const data = r.releaseDate ? new Date(r.releaseDate) : null;
      return {
        id: r.trackId ?? i,
        ordem: i,
        titulo: r.trackName || 'Sem título',
        realizador: r.artistName || '—',
        genero: r.primaryGenreName || 'Sem género',
        ano: data && !isNaN(data) ? data.getFullYear() : null,
        poster: (r.artworkUrl100 || '').replace('100x100bb', '600x600bb'),
        sinopse: r.longDescription || r.shortDescription || 'Sem sinopse disponível.',
        classificacao: r.contentAdvisoryRating || '',
        duracaoMin: r.trackTimeMillis ? Math.round(r.trackTimeMillis / 60000) : null,
        link: r.trackViewUrl || '',
      };
    });
}

/* ---------- 3. Filtros e ordenação (no cliente) ---------- */

function aplicarFiltros() {
  const g = el.genero.value;
  const c = el.classificacao.value;
  const min = parseInt(el.anoMin.value, 10);
  const max = parseInt(el.anoMax.value, 10);
  const txt = el.texto.value.trim().toLowerCase();

  let lista = filmes.filter((f) =>
    (!g || f.genero === g) &&
    (!c || f.classificacao === c) &&
    (isNaN(min) || (f.ano && f.ano >= min)) &&
    (isNaN(max) || (f.ano && f.ano <= max)) &&
    (!txt || `${f.titulo} ${f.realizador} ${f.sinopse}`.toLowerCase().includes(txt)));

  const ordenacoes = {
    relevancia: (a, b) => a.ordem - b.ordem,
    recentes: (a, b) => (b.ano ?? 0) - (a.ano ?? 0),
    antigos: (a, b) => (a.ano ?? 9999) - (b.ano ?? 9999),
    titulo: (a, b) => a.titulo.localeCompare(b.titulo, 'pt'),
    duracao: (a, b) => (b.duracaoMin ?? 0) - (a.duracaoMin ?? 0),
  };
  lista.sort(ordenacoes[el.ordem.value]);

  renderizar(lista);
}

function preencherOpcoes(select, valores, rotuloTodos) {
  const unicos = [...new Set(valores.filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt'));
  select.replaceChildren(new Option(rotuloTodos, ''), ...unicos.map((v) => new Option(v, v)));
}

/* ---------- 4. Front-end ---------- */

function mostrarEstado(html, erro = false) {
  el.estado.className = erro ? 'estado erro' : 'estado';
  el.estado.innerHTML = html;
}

function escapar(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function renderizar(lista) {
  el.resultados.replaceChildren();
  if (!lista.length) {
    mostrarEstado(filmes.length ? 'Nenhum filme corresponde aos filtros.' : 'Nenhum filme encontrado para esse termo.');
    return;
  }
  mostrarEstado(`A mostrar <strong>${lista.length}</strong> de ${filmes.length} filme(s).`);

  const frag = document.createDocumentFragment();
  for (const f of lista) {
    const li = document.createElement('li');
    li.className = 'cartao';
    li.tabIndex = 0;
    li.innerHTML = `
      <img src="${escapar(f.poster)}" alt="Poster de ${escapar(f.titulo)}" loading="lazy">
      <div class="info">
        <h3>${escapar(f.titulo)}</h3>
        <span class="meta">${f.ano ?? '—'}${f.duracaoMin ? ` · ${f.duracaoMin} min` : ''}</span>
        <span class="tag">${escapar(f.genero)}</span>
      </div>`;
    li.querySelector('img').onerror = (e) => { e.target.removeAttribute('src'); };
    li.addEventListener('click', () => abrirDetalhe(f));
    li.addEventListener('keydown', (e) => { if (e.key === 'Enter') abrirDetalhe(f); });
    frag.appendChild(li);
  }
  el.resultados.appendChild(frag);
}

function abrirDetalhe(f) {
  el.detalhe.innerHTML = `
    <div class="detalhe">
      <img src="${escapar(f.poster)}" alt="Poster de ${escapar(f.titulo)}">
      <div class="texto">
        <h2>${escapar(f.titulo)}</h2>
        <p class="meta">
          ${f.ano ?? '—'} · ${escapar(f.genero)}
          ${f.duracaoMin ? ` · ${f.duracaoMin} min` : ''}
          ${f.classificacao ? ` · ${escapar(f.classificacao)}` : ''}
        </p>
        <p><strong>Realização:</strong> ${escapar(f.realizador)}</p>
        <p>${escapar(f.sinopse)}</p>
        ${f.link ? `<p><a href="${escapar(f.link)}" target="_blank" rel="noopener">Ver na Apple TV / iTunes ↗</a></p>` : ''}
      </div>
    </div>`;
  el.dialog.showModal();
}

/* ---------- Eventos ---------- */

async function pesquisar() {
  const termo = el.termo.value.trim();
  if (termo.length < 2) {
    mostrarEstado('Escreva pelo menos 2 caracteres.', true);
    return;
  }
  mostrarEstado('A carregar…');
  el.resultados.replaceChildren();
  el.filtros.hidden = true;

  try {
    const dados = await pedirFilmes(termo, el.pais.value);
    filmes = normalizar(dados);
    preencherOpcoes(el.genero, filmes.map((f) => f.genero), 'Todos');
    preencherOpcoes(el.classificacao, filmes.map((f) => f.classificacao), 'Todas');
    el.filtros.hidden = filmes.length === 0;
    aplicarFiltros();
  } catch (e) {
    filmes = [];
    const msg = e instanceof ApiError ? e.message : 'Ocorreu um erro inesperado.';
    mostrarEstado(`⚠️ ${escapar(msg)} <button type="button" id="repetir">Tentar novamente</button>`, true);
    $('#repetir').addEventListener('click', pesquisar);
    console.error(e);
  }
}

el.form.addEventListener('submit', (e) => { e.preventDefault(); pesquisar(); });
[el.genero, el.classificacao, el.ordem].forEach((s) => s.addEventListener('change', aplicarFiltros));
[el.anoMin, el.anoMax, el.texto].forEach((i) => i.addEventListener('input', aplicarFiltros));
el.limpar.addEventListener('click', () => {
  el.genero.value = el.classificacao.value = el.anoMin.value = el.anoMax.value = el.texto.value = '';
  el.ordem.value = 'relevancia';
  aplicarFiltros();
});
el.dialog.querySelector('.fechar').addEventListener('click', () => el.dialog.close());
el.dialog.addEventListener('click', (e) => { if (e.target === el.dialog) el.dialog.close(); });
