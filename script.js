/* ═══════════════════════════════════════════════════════════════
   FinanceTracker Pro — script.js
   Estado, persistência, carteiras, categorias, orçamentos, metas,
   recorrências, parcelamento, gráficos, relatórios e backup.
   ═══════════════════════════════════════════════════════════════ */

const App = (() => {

  const CHAVE = 'finance-tracker-pro-v2';
  const CHAVE_ANTIGA = 'finance_transacoes';
  const VERSAO = 2;

  const CATEGORIAS_PADRAO = [
    { id: 'alimentacao', nome: 'Alimentação', emoji: '🍔', cor: '#ff9f68' },
    { id: 'transporte',  nome: 'Transporte',  emoji: '🚗', cor: '#5ec8f8' },
    { id: 'moradia',     nome: 'Moradia',     emoji: '🏠', cor: '#ff6b81' },
    { id: 'saude',       nome: 'Saúde',       emoji: '💊', cor: '#7ee787' },
    { id: 'lazer',       nome: 'Lazer',       emoji: '🎮', cor: '#c792ea' },
    { id: 'educacao',    nome: 'Educação',    emoji: '📚', cor: '#ffd166' },
    { id: 'salario',     nome: 'Salário',     emoji: '💼', cor: '#4ade80' },
    { id: 'investimento',nome: 'Investimento',emoji: '📈', cor: '#38bdf8' },
    { id: 'outros',      nome: 'Outros',      emoji: '📦', cor: '#94a3b8' },
  ];

  const FREQUENCIAS = { mensal: 'Mensal', semanal: 'Semanal', anual: 'Anual' };

  let estado = null;
  let graficoLinha = null;
  let graficoPizza = null;
  let importacaoPendente = null;

  /* ── Utilidades ── */
  const $  = (sel) => document.querySelector(sel);
  const $$ = (sel) => [...document.querySelectorAll(sel)];

  const esc = (valor) => String(valor ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));

  const uid = () => (crypto.randomUUID?.() ?? `id-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);

  const pad = (n) => String(n).padStart(2, '0');

  const isoDe = (data) => `${data.getFullYear()}-${pad(data.getMonth() + 1)}-${pad(data.getDate())}`;

  const hojeISO = () => isoDe(new Date());

  const fmt = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const fmtData = (iso) => {
    const partes = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
    return partes ? `${partes[3]}/${partes[2]}/${partes[1]}` : '';
  };

  const dataValida = (iso) => /^\d{4}-\d{2}-\d{2}$/.test(iso || '');

  const parseValor = (bruto) => {
    let s = String(bruto ?? '').replace(/[R$\s]/g, '');
    if (!s) return NaN;
    const ultimaVirgula = s.lastIndexOf(',');
    const ultimoPonto = s.lastIndexOf('.');
    if (ultimaVirgula > ultimoPonto) {
      s = s.replace(/\./g, '').replace(',', '.');
    } else if (ultimaVirgula === -1 && ultimoPonto !== -1 && /^\d{3}$/.test(s.slice(ultimoPonto + 1))) {
      // "10.000" e "1.234.567" são milhares no padrão brasileiro.
      s = s.replace(/\./g, '');
    } else {
      s = s.replace(/,/g, '');
    }
    const n = Number(s);
    return Number.isFinite(n) ? n : NaN;
  };

  const avancarData = (iso, frequencia) => {
    const [ano, mes, dia] = (dataValida(iso) ? iso : hojeISO()).split('-').map(Number);
    if (frequencia === 'semanal') return isoDe(new Date(ano, mes - 1, dia + 7, 12));
    if (frequencia === 'anual') return isoDe(new Date(ano + 1, mes - 1, dia, 12));
    const alvo = new Date(ano, mes, 1, 12);
    const ultimoDia = new Date(alvo.getFullYear(), alvo.getMonth() + 1, 0).getDate();
    alvo.setDate(Math.min(dia, ultimoDia));
    return isoDe(alvo);
  };

  const proximaOcorrencia = (iso, frequencia) => {
    let proxima = avancarData(iso, frequencia);
    let seguranca = 0;
    while (proxima <= hojeISO() && seguranca < 240) {
      proxima = avancarData(proxima, frequencia);
      seguranca += 1;
    }
    return proxima;
  };

  const slug = (texto) => String(texto || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'item';

  const corValida = (cor) => /^#[0-9a-fA-F]{6}$/.test(cor || '') ? cor : '#94a3b8';

  const idSeguro = (id) => /^[a-zA-Z0-9_-]{1,64}$/.test(id || '');

  const cssVar = (nome) => getComputedStyle(document.documentElement).getPropertyValue(nome).trim();

  const categoriaDe = (id) => estado.categorias.find(c => c.id === id) || estado.categorias.find(c => c.id === 'outros') || { id: 'outros', nome: 'Outros', emoji: '📦', cor: '#94a3b8' };

  const carteiraDe = (id) => estado.carteiras.find(c => c.id === id) || estado.carteiras[0];

  /* ── Estado e persistência ── */
  const estadoInicial = () => ({
    versao: VERSAO,
    tema: 'dark',
    carteiras: [{ id: 'principal', nome: 'Conta principal', cor: '#c9f75d' }],
    carteiraAtiva: 'todas',
    categorias: CATEGORIAS_PADRAO.map(c => ({ ...c })),
    transacoes: [],
    orcamentos: {},
    metas: [],
    recorrencias: [],
  });

  const normalizarCarteira = (c, indice) => {
    if (!c || typeof c !== 'object') return null;
    const nome = typeof c.nome === 'string' ? c.nome.trim().slice(0, 40) : '';
    if (!nome) return null;
    const id = idSeguro(c.id) ? c.id : `carteira-${indice}-${uid().slice(0, 6)}`;
    return { id, nome, cor: corValida(c.cor) };
  };

  const normalizarCategoria = (c, indice) => {
    if (!c || typeof c !== 'object') return null;
    const nome = typeof c.nome === 'string' ? c.nome.trim().slice(0, 30) : '';
    if (!nome) return null;
    const id = idSeguro(c.id) ? c.id : slug(nome);
    const emoji = typeof c.emoji === 'string' && c.emoji.trim() ? [...c.emoji.trim()][0] : '📦';
    return { id, nome, emoji, cor: corValida(c.cor) };
  };

  const normalizarTransacao = (t, indice) => {
    if (!t || typeof t !== 'object') return null;
    if (t.tipo !== 'entrada' && t.tipo !== 'saida') return null;
    const descricao = typeof t.descricao === 'string' ? t.descricao.trim().slice(0, 120) : '';
    if (!descricao) return null;
    const valor = Number(t.valor);
    if (!Number.isFinite(valor) || valor <= 0) return null;

    const categoriaId = estado.categorias.some(c => c.id === t.categoriaId) ? t.categoriaId
      : estado.categorias.some(c => c.id === t.categoria) ? t.categoria
      : 'outros';

    const carteiraId = estado.carteiras.some(c => c.id === t.carteiraId) ? t.carteiraId
      : estado.carteiras[0].id;

    const parcela = t.parcela && Number(t.parcela.total) > 1
      ? { atual: Number(t.parcela.atual) || 1, total: Number(t.parcela.total) }
      : null;

    return {
      id: idSeguro(t.id) ? t.id : `tx-${Date.now()}-${indice}-${uid().slice(0, 5)}`,
      tipo: t.tipo,
      descricao,
      valor,
      categoriaId,
      carteiraId,
      data: dataValida(t.data) ? t.data : hojeISO(),
      observacao: typeof t.observacao === 'string' ? t.observacao.trim().slice(0, 200) : '',
      parcela,
    };
  };

  const normalizarRecorrencia = (r, indice) => {
    if (!r || typeof r !== 'object') return null;
    const descricao = typeof r.descricao === 'string' ? r.descricao.trim().slice(0, 120) : '';
    const valor = Number(r.valor);
    if (!descricao || !Number.isFinite(valor) || valor <= 0) return null;
    if (r.tipo !== 'entrada' && r.tipo !== 'saida') return null;

    return {
      id: idSeguro(r.id) ? r.id : `rec-${Date.now()}-${indice}`,
      tipo: r.tipo,
      descricao,
      valor,
      categoriaId: estado.categorias.some(c => c.id === r.categoriaId) ? r.categoriaId : 'outros',
      carteiraId: estado.carteiras.some(c => c.id === r.carteiraId) ? r.carteiraId : estado.carteiras[0].id,
      frequencia: FREQUENCIAS[r.frequencia] ? r.frequencia : 'mensal',
      proxima: dataValida(r.proxima) ? r.proxima : avancarData(hojeISO(), 'mensal'),
      ativa: r.ativa !== false,
    };
  };

  const normalizarMeta = (m, indice) => {
    if (!m || typeof m !== 'object') return null;
    const nome = typeof m.nome === 'string' ? m.nome.trim().slice(0, 60) : '';
    const alvo = Number(m.alvo);
    if (!nome || !Number.isFinite(alvo) || alvo <= 0) return null;
    return {
      id: idSeguro(m.id) ? m.id : `meta-${Date.now()}-${indice}`,
      nome,
      alvo,
      guardado: Math.max(0, Number(m.guardado) || 0),
      prazo: dataValida(m.prazo) ? m.prazo : '',
      cor: corValida(m.cor),
    };
  };

  const normalizarEstado = (bruto) => {
    const base = estadoInicial();
    const anterior = estado;
    estado = base;

    if (!bruto || typeof bruto !== 'object') {
      estado = anterior;
      return base;
    }

    if (Array.isArray(bruto.carteiras) && bruto.carteiras.length) {
      const carteiras = bruto.carteiras.map(normalizarCarteira).filter(Boolean);
      if (carteiras.length) base.carteiras = carteiras;
    }

    if (Array.isArray(bruto.categorias) && bruto.categorias.length) {
      const categorias = bruto.categorias.map(normalizarCategoria).filter(Boolean);
      if (categorias.length) base.categorias = categorias;
    }

    if (!base.categorias.some(c => c.id === 'outros')) {
      base.categorias.push({ ...CATEGORIAS_PADRAO.find(c => c.id === 'outros') });
    }

    base.carteiraAtiva = bruto.carteiraAtiva === 'todas' || base.carteiras.some(c => c.id === bruto.carteiraAtiva)
      ? bruto.carteiraAtiva
      : 'todas';

    base.tema = bruto.tema === 'light' ? 'light' : 'dark';

    base.transacoes = Array.isArray(bruto.transacoes)
      ? bruto.transacoes.map(normalizarTransacao).filter(Boolean)
      : [];

    base.orcamentos = {};
    if (bruto.orcamentos && typeof bruto.orcamentos === 'object') {
      Object.entries(bruto.orcamentos).forEach(([categoriaId, valor]) => {
        const n = Number(valor);
        if (base.categorias.some(c => c.id === categoriaId) && Number.isFinite(n) && n > 0) {
          base.orcamentos[categoriaId] = n;
        }
      });
    }

    base.metas = Array.isArray(bruto.metas) ? bruto.metas.map(normalizarMeta).filter(Boolean) : [];

    base.recorrencias = Array.isArray(bruto.recorrencias)
      ? bruto.recorrencias.map(normalizarRecorrencia).filter(Boolean)
      : [];

    estado = anterior;
    return base;
  };

  const migrarAntigo = () => {
    const bruto = localStorage.getItem(CHAVE_ANTIGA);
    if (!bruto) return null;
    try {
      const lista = JSON.parse(bruto);
      if (!Array.isArray(lista)) return null;
      const est = estadoInicial();
      estado = est;
      est.transacoes = lista
        .map((t) => normalizarTransacao({ ...t, categoriaId: t.categoria, carteiraId: 'principal' }))
        .filter(Boolean);
      return est;
    } catch {
      return null;
    }
  };

  const carregar = () => {
    try {
      const bruto = localStorage.getItem(CHAVE);
      if (bruto) {
        estado = normalizarEstado(JSON.parse(bruto));
      } else {
        estado = migrarAntigo() || normalizarEstado(null);
      }
    } catch {
      estado = normalizarEstado(null);
    }
    salvar();
  };

  const salvar = () => {
    try {
      localStorage.setItem(CHAVE, JSON.stringify(estado));
    } catch {
      toast('Não foi possível salvar os dados neste navegador.');
    }
  };

  /* ── Consultas ── */
  const ordenarPorData = (lista) => [...lista].sort((a, b) => {
    const porData = String(b.data || '').localeCompare(String(a.data || ''));
    return porData !== 0 ? porData : String(b.id).localeCompare(String(a.id));
  });

  const porCarteira = (lista) => estado.carteiraAtiva === 'todas'
    ? lista
    : lista.filter(t => t.carteiraId === estado.carteiraAtiva);

  const realizadas = (lista) => lista.filter(t => !t.data || t.data <= hojeISO());

  const filtroPeriodo = () => $('#filtroPeriodo')?.value || 'todos';

  const filtrarPorPeriodo = (lista) => {
    const periodo = filtroPeriodo();
    if (periodo === 'todos') return lista;
    const agora = new Date();
    return lista.filter(t => {
      if (!t.data) return true;
      const d = new Date(`${t.data}T12:00:00`);
      if (periodo === 'mes') return d.getFullYear() === agora.getFullYear() && d.getMonth() === agora.getMonth();
      const diff = (agora - d) / (1000 * 60 * 60 * 24);
      return diff >= 0 && diff < 7;
    });
  };

  const mesChave = () => {
    const d = new Date();
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
  };

  const doMesAtual = (lista) => lista.filter(t => (t.data || '').slice(0, 7) === mesChave());

  const calcular = (lista) => {
    const entradas = lista.filter(t => t.tipo === 'entrada').reduce((s, t) => s + t.valor, 0);
    const saidas = lista.filter(t => t.tipo === 'saida').reduce((s, t) => s + t.valor, 0);
    return { entradas, saidas, saldo: entradas - saidas };
  };

  /* ── Tema ── */
  const aplicarTema = () => {
    document.documentElement.dataset.theme = estado.tema;
    const rotulo = estado.tema === 'dark' ? 'Tema escuro' : 'Tema claro';
    if ($('#temaAtual')) $('#temaAtual').textContent = rotulo;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', estado.tema === 'dark' ? '#0b0d12' : '#f3f4ee');
  };

  const alternarTema = () => {
    estado.tema = estado.tema === 'dark' ? 'light' : 'dark';
    salvar();
    aplicarTema();
    renderizarGraficos();
  };

  /* ── Toast ── */
  let toastTimer = null;

  const toast = (mensagem) => {
    const el = $('#toast');
    if (!el) return;
    el.textContent = mensagem;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 2800);
  };

  /* ── Menu mobile ── */
  const definirMenu = (aberto) => {
    const sidebar = $('#sidebar');
    const overlay = $('#sidebarOverlay');
    const toggle = $('#menuToggle');
    if (!sidebar || !overlay || !toggle) return;

    sidebar.classList.toggle('open', aberto);
    overlay.hidden = !aberto;
    toggle.setAttribute('aria-expanded', String(aberto));
    toggle.setAttribute('aria-label', aberto ? 'Fechar menu' : 'Abrir menu');
    document.body.classList.toggle('menu-open', aberto);
  };

  /* ── Navegação ── */
  const navegarPara = (sectionId) => {
    $$('.page-section').forEach(s => s.classList.remove('active'));
    $(`#${sectionId}`)?.classList.add('active');

    $$('.menu-item').forEach(m => {
      const ativo = m.dataset.section === sectionId;
      m.classList.toggle('active', ativo);
      if (ativo) m.setAttribute('aria-current', 'page');
      else m.removeAttribute('aria-current');
    });

    if (sectionId === 'relatoriosSection') renderizarRelatorios();
    if (sectionId === 'orcamentosSection') renderizarOrcamentos();
    if (sectionId === 'metasSection') renderizarMetas();

    definirMenu(false);
  };

  /* ── Selects ── */
  const renderizarCarteiraFiltro = () => {
    const select = $('#carteiraFiltro');
    if (!select) return;
    select.innerHTML = [
      '<option value="todas">Todas as carteiras</option>',
      ...estado.carteiras.map(c => `<option value="${esc(c.id)}">${esc(c.nome)}</option>`),
    ].join('');
    select.value = estado.carteiraAtiva;
  };

  const preencherSelect = (select, html, valorAtual) => {
    if (!select) return;
    select.innerHTML = html;
    if ([...select.options].some(o => o.value === valorAtual)) select.value = valorAtual;
  };

  const renderizarSelects = () => {
    const categoriasHtml = estado.categorias
      .map(c => `<option value="${esc(c.id)}">${esc(c.emoji)} ${esc(c.nome)}</option>`)
      .join('');
    const carteirasHtml = estado.carteiras
      .map(c => `<option value="${esc(c.id)}">${esc(c.nome)}</option>`)
      .join('');

    preencherSelect($('#categoria'), categoriasHtml, $('#categoria')?.value || 'outros');
    preencherSelect($('#filtroCategoria'),
      `<option value="todos">Todas as categorias</option>${categoriasHtml}`,
      $('#filtroCategoria')?.value);

    const selectCarteira = $('#carteira');
    preencherSelect(selectCarteira, carteirasHtml, selectCarteira?.value);
    if (selectCarteira && estado.carteiraAtiva !== 'todas') selectCarteira.value = estado.carteiraAtiva;
  };

  /* ── Dashboard ── */
  const renderizarCards = () => {
    const base = filtrarPorPeriodo(realizadas(porCarteira(estado.transacoes)));
    const { entradas, saidas, saldo } = calcular(base);

    $('#totalEntradas').textContent = fmt(entradas);
    $('#totalSaidas').textContent = fmt(saidas);
    $('#saldoAtual').textContent = fmt(saldo);

    const qtdE = base.filter(t => t.tipo === 'entrada').length;
    const qtdS = base.filter(t => t.tipo === 'saida').length;

    $('#qtdEntradas').textContent = `${qtdE} ${qtdE === 1 ? 'transação' : 'transações'}`;
    $('#qtdSaidas').textContent = `${qtdS} ${qtdS === 1 ? 'transação' : 'transações'}`;

    const status = $('#saldoStatus');
    if (saldo > 0) { status.textContent = '✓ Positivo'; status.style.color = 'var(--entrada)'; }
    else if (saldo < 0) { status.textContent = '⚠ Negativo'; status.style.color = 'var(--saida)'; }
    else { status.textContent = '—'; status.style.color = 'var(--muted)'; }
  };

  const gastoDoMesPorCategoria = () => {
    const gastos = {};
    porCarteira(realizadas(doMesAtual(estado.transacoes)))
      .filter(t => t.tipo === 'saida')
      .forEach(t => { gastos[t.categoriaId] = (gastos[t.categoriaId] || 0) + t.valor; });
    return gastos;
  };

  const renderizarResumoOrcamento = () => {
    const alvo = $('#resumoOrcamento');
    if (!alvo) return;

    const categorias = estado.categorias.filter(c => estado.orcamentos[c.id] > 0);
    if (categorias.length === 0) {
      alvo.innerHTML = `
        <div>
          <p class="budget-strip-label">Orçamento do mês</p>
          <p class="budget-strip-meta">Nenhum limite definido ainda.</p>
        </div>
        <div><button class="link-btn" type="button" onclick="App.navegarPara('orcamentosSection')">Definir orçamentos →</button></div>`;
      return;
    }

    const gastos = gastoDoMesPorCategoria();
    const totalLimite = categorias.reduce((s, c) => s + estado.orcamentos[c.id], 0);
    const totalGasto = categorias.reduce((s, c) => s + (gastos[c.id] || 0), 0);
    const pct = totalLimite > 0 ? Math.min(100, (totalGasto / totalLimite) * 100) : 0;

    const top = categorias
      .map(c => ({ cat: c, limite: estado.orcamentos[c.id], gasto: gastos[c.id] || 0 }))
      .sort((a, b) => (b.gasto / b.limite) - (a.gasto / a.limite))
      .slice(0, 3);

    alvo.innerHTML = `
      <div>
        <p class="budget-strip-label">Orçamento do mês</p>
        <p class="budget-strip-value">${fmt(totalGasto)} <span class="muted-inline">de ${fmt(totalLimite)}</span></p>
        <div class="budget-bar-track" style="margin-top:8px">
          <div class="budget-bar-fill ${totalGasto > totalLimite ? 'over' : ''}" style="width:${pct.toFixed(1)}%"></div>
        </div>
        <p class="budget-strip-meta">${pct.toFixed(0)}% do limite · ${mesChave().split('-').reverse().join('/')}</p>
      </div>
      <div class="budget-strip-bars">
        ${top.map(({ cat, limite, gasto }) => {
          const p = limite > 0 ? Math.min(100, (gasto / limite) * 100) : 0;
          return `<div class="budget-mini">
            <span><strong>${esc(cat.emoji)} ${esc(cat.nome)}</strong></span>
            <div class="mini-track"><div class="mini-fill ${gasto > limite ? 'over' : ''}" style="width:${p.toFixed(1)}%"></div></div>
            <span>${fmt(gasto)} / ${fmt(limite)}</span>
          </div>`;
        }).join('')}
      </div>`;
  };

  const renderizarRecentes = () => {
    const lista = $('#listaRecente');
    const vazio = $('#emptyRecente');
    if (!lista || !vazio) return;

    const recentes = ordenarPorData(realizadas(porCarteira(estado.transacoes))).slice(0, 5);
    lista.innerHTML = '';

    if (recentes.length === 0) {
      vazio.classList.remove('hidden');
      return;
    }
    vazio.classList.add('hidden');
    recentes.forEach(t => lista.appendChild(criarItem(t, false)));
  };

  /* ── Transações ── */
  const criarItem = (t, comDelete) => {
    const cat = categoriaDe(t.categoriaId);
    const cart = carteiraDe(t.carteiraId);
    const sinal = t.tipo === 'entrada' ? '+' : '−';
    const futura = t.data > hojeISO();
    const obs = t.observacao ? ` · ${esc(t.observacao)}` : '';
    const parcelamento = t.parcela ? ` · ${t.parcela.atual}/${t.parcela.total}` : '';

    const li = document.createElement('li');
    li.className = `transaction-item${futura ? ' futura' : ''}`;
    li.innerHTML = `
      <div class="tx-icon ${t.tipo}" aria-hidden="true">${esc(cat.emoji)}</div>
      <div class="tx-info">
        <div class="tx-desc">${esc(t.descricao)}</div>
        <div class="tx-meta">
          <span>${esc(cat.nome)} · ${fmtData(t.data)}${parcelamento}${obs}</span>
          <span class="tx-badge carteira">${esc(cart.nome)}</span>
          ${futura ? '<span class="tx-badge prevista">prevista</span>' : ''}
        </div>
      </div>
      <div class="tx-valor ${t.tipo}">${sinal} ${fmt(t.valor)}</div>
      ${comDelete ? `<button class="tx-delete" type="button" title="Excluir" aria-label="Excluir transação" onclick="App.excluir('${esc(t.id)}')">✕</button>` : ''}
    `;
    return li;
  };

  const renderizarLista = () => {
    const lista = $('#lista');
    const vazio = $('#emptyLista');
    const contador = $('#contadorTransacoes');
    if (!lista || !vazio) return;

    const busca = ($('#busca')?.value || '').toLowerCase().trim();
    const tipo = $('#filtroTipo')?.value || 'todos';
    const categoriaId = $('#filtroCategoria')?.value || 'todos';

    let filtrada = ordenarPorData(porCarteira(estado.transacoes));
    if (tipo !== 'todos') filtrada = filtrada.filter(t => t.tipo === tipo);
    if (categoriaId !== 'todos') filtrada = filtrada.filter(t => t.categoriaId === categoriaId);
    if (busca) filtrada = filtrada.filter(t => t.descricao.toLowerCase().includes(busca));

    if (contador) {
      contador.textContent = `${filtrada.length} ${filtrada.length === 1 ? 'lançamento' : 'lançamentos'}`;
    }

    lista.innerHTML = '';
    if (filtrada.length === 0) {
      vazio.classList.remove('hidden');
      return;
    }

    vazio.classList.add('hidden');
    filtrada.forEach(t => lista.appendChild(criarItem(t, true)));
  };

  /* ── Gráficos ── */
  const renderizarGraficos = () => {
    renderizarGraficoLinha();
    renderizarGraficoPizza();
  };

  const renderizarGraficoLinha = () => {
    const canvas = $('#graficoLinha');
    const vazio = $('#linhaVazia');
    if (!canvas) return;

    if (graficoLinha) { graficoLinha.destroy(); graficoLinha = null; }

    const base = filtrarPorPeriodo(realizadas(porCarteira(estado.transacoes)));
    const mapa = new Map();
    base.forEach(t => {
      const chave = t.data || hojeISO();
      if (!mapa.has(chave)) mapa.set(chave, { entrada: 0, saida: 0 });
      mapa.get(chave)[t.tipo] += t.valor;
    });

    const datas = [...mapa.keys()].sort();
    vazio?.classList.toggle('hidden', datas.length > 0);
    canvas.style.display = datas.length ? 'block' : 'none';
    if (datas.length === 0) return;

    const ctx = canvas.getContext('2d');
    const corIn = cssVar('--entrada');
    const corOut = cssVar('--saida');
    const gradiente = (cor) => {
      const g = ctx.createLinearGradient(0, 0, 0, 240);
      g.addColorStop(0, `${cor}55`);
      g.addColorStop(1, `${cor}00`);
      return g;
    };

    const maisDados = datas.length > 14;

    graficoLinha = new Chart(ctx, {
      type: 'line',
      data: {
        labels: datas.map(fmtData),
        datasets: [
          {
            label: 'Entradas',
            data: datas.map(d => mapa.get(d).entrada),
            borderColor: corIn,
            backgroundColor: gradiente(corIn),
            tension: 0.38,
            fill: true,
            borderWidth: 2,
            pointRadius: maisDados ? 0 : 3,
            pointBackgroundColor: corIn,
            pointBorderWidth: 0,
          },
          {
            label: 'Saídas',
            data: datas.map(d => mapa.get(d).saida),
            borderColor: corOut,
            backgroundColor: gradiente(corOut),
            tension: 0.38,
            fill: true,
            borderWidth: 2,
            pointRadius: maisDados ? 0 : 3,
            pointBackgroundColor: corOut,
            pointBorderWidth: 0,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: cssVar('--surface-3'),
            titleColor: cssVar('--text'),
            bodyColor: cssVar('--muted-2'),
            borderColor: cssVar('--line-strong'),
            borderWidth: 1,
            padding: 10,
            callbacks: { label: (ctx) => ` ${ctx.dataset.label}: ${fmt(ctx.parsed.y)}` },
          },
        },
        scales: {
          x: {
            ticks: { color: cssVar('--muted'), maxRotation: 0, autoSkipPadding: 18, font: { size: 11 } },
            grid: { display: false },
          },
          y: {
            beginAtZero: true,
            ticks: {
              color: cssVar('--muted'),
              font: { size: 11 },
              callback: (v) => 'R$ ' + Number(v).toLocaleString('pt-BR'),
            },
            grid: { color: cssVar('--chart-grid') },
            border: { display: false },
          },
        },
      },
    });
  };

  const renderizarGraficoPizza = () => {
    const canvas = $('#graficoPizza');
    const vazio = $('#pizzaVazia');
    if (!canvas) return;

    if (graficoPizza) { graficoPizza.destroy(); graficoPizza = null; }

    const base = filtrarPorPeriodo(realizadas(porCarteira(estado.transacoes))).filter(t => t.tipo === 'saida');
    const mapa = new Map();
    base.forEach(t => mapa.set(t.categoriaId, (mapa.get(t.categoriaId) || 0) + t.valor));

    vazio?.classList.toggle('hidden', mapa.size > 0);
    canvas.style.display = mapa.size ? 'block' : 'none';
    if (mapa.size === 0) return;

    const itens = [...mapa.entries()].sort((a, b) => b[1] - a[1]);
    const categorias = itens.map(([id]) => categoriaDe(id));

    graficoPizza = new Chart(canvas.getContext('2d'), {
      type: 'doughnut',
      data: {
        labels: categorias.map(c => c.nome),
        datasets: [{
          data: itens.map(([, v]) => v),
          backgroundColor: categorias.map(c => c.cor),
          borderColor: cssVar('--surface'),
          borderWidth: 3,
          hoverOffset: 6,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '68%',
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              color: cssVar('--muted-2'),
              boxWidth: 9,
              boxHeight: 9,
              usePointStyle: true,
              pointStyle: 'circle',
              padding: 12,
              font: { size: 11 },
            },
          },
          tooltip: {
            backgroundColor: cssVar('--surface-3'),
            titleColor: cssVar('--text'),
            bodyColor: cssVar('--muted-2'),
            borderColor: cssVar('--line-strong'),
            borderWidth: 1,
            padding: 10,
            callbacks: { label: (ctx) => ` ${fmt(ctx.raw)}` },
          },
        },
      },
    });
  };

  /* ── Orçamentos ── */
  const renderizarOrcamentos = () => {
    const lista = $('#listaOrcamentos');
    if (!lista) return;

    const mes = new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    if ($('#mesOrcamento')) $('#mesOrcamento').textContent = `Limites de ${mes}`;

    const gastos = gastoDoMesPorCategoria();
    const totalLimite = estado.categorias.reduce((s, c) => s + (estado.orcamentos[c.id] || 0), 0);
    const totalGasto = estado.categorias.reduce((s, c) => s + (gastos[c.id] || 0), 0);

    if ($('#orcamentoTotal')) {
      $('#orcamentoTotal').textContent = `${fmt(totalGasto)} de ${fmt(totalLimite)}`;
    }

    lista.innerHTML = estado.categorias.map(c => {
      const limite = estado.orcamentos[c.id] || 0;
      const gasto = gastos[c.id] || 0;
      const pct = limite > 0 ? Math.min(100, (gasto / limite) * 100) : 0;
      return `
        <li class="budget-row">
          <span class="budget-name"><span class="emoji" aria-hidden="true">${esc(c.emoji)}</span>${esc(c.nome)}</span>
          <div>
            <div class="budget-bar-meta">
              <span>${limite > 0 ? `${fmt(gasto)} de ${fmt(limite)}` : `${fmt(gasto)} · sem limite`}</span>
              <span>${limite > 0 ? `${Math.round((gasto / limite) * 100)}%` : '—'}</span>
            </div>
            <div class="budget-bar-track">
              <div class="budget-bar-fill ${limite > 0 && gasto > limite ? 'over' : ''}" style="width:${pct.toFixed(1)}%"></div>
            </div>
          </div>
          <input class="budget-input" type="number" min="0" step="10" inputmode="decimal"
                 value="${limite || ''}" placeholder="0"
                 aria-label="Limite mensal de ${esc(c.nome)}"
                 onchange="App.salvarOrcamento('${esc(c.id)}', this.value)">
        </li>`;
    }).join('');
  };

  const salvarOrcamento = (categoriaId, valor) => {
    const n = Number(valor);
    if (Number.isFinite(n) && n > 0) estado.orcamentos[categoriaId] = n;
    else delete estado.orcamentos[categoriaId];
    salvar();
    renderizarOrcamentos();
    renderizarResumoOrcamento();
  };

  /* ── Metas ── */
  const renderizarMetas = () => {
    const grid = $('#listaMetas');
    const vazio = $('#emptyMetas');
    if (!grid || !vazio) return;

    if (estado.metas.length === 0) {
      grid.innerHTML = '';
      vazio.classList.remove('hidden');
      return;
    }
    vazio.classList.add('hidden');

    grid.innerHTML = estado.metas.map(m => {
      const pct = Math.min(100, (m.guardado / m.alvo) * 100);
      const falta = Math.max(0, m.alvo - m.guardado);
      return `
        <article class="goal-card">
          <div class="goal-top">
            <div>
              <div class="goal-title">${esc(m.nome)}</div>
              <div class="goal-prazo">${m.prazo ? `Prazo: ${fmtData(m.prazo)}` : 'Sem prazo definido'}</div>
            </div>
            <div class="goal-pct">${Math.round(pct)}%</div>
          </div>
          <div class="budget-bar-track">
            <div class="budget-bar-fill" style="width:${pct.toFixed(1)}%"></div>
          </div>
          <div class="goal-values">
            <span><strong>${fmt(m.guardado)}</strong> guardados</span>
            <span>meta ${fmt(m.alvo)}</span>
          </div>
          <div class="goal-values"><span>Faltam ${fmt(falta)}</span></div>
          <div class="goal-actions">
            <input type="text" inputmode="decimal" placeholder="Valor" id="meta-add-${esc(m.id)}" aria-label="Valor para guardar em ${esc(m.nome)}">
            <button class="btn btn-ghost" type="button" onclick="App.guardarNaMeta('${esc(m.id)}')">Guardar</button>
            <button class="btn btn-icon" type="button" aria-label="Excluir meta ${esc(m.nome)}" onclick="App.excluirMeta('${esc(m.id)}')">✕</button>
          </div>
        </article>`;
    }).join('');
  };

  const adicionarMeta = (event) => {
    event.preventDefault();
    const nome = $('#nomeMeta').value.trim();
    const alvo = parseValor($('#alvoMeta').value);
    if (!nome) { toast('Informe o nome da meta.'); $('#nomeMeta').focus(); return; }
    if (!Number.isFinite(alvo) || alvo <= 0) { toast('Informe um valor alvo válido.'); $('#alvoMeta').focus(); return; }

    estado.metas.push({
      id: uid(),
      nome: nome.slice(0, 60),
      alvo,
      guardado: 0,
      prazo: $('#prazoMeta').value || '',
      cor: '#c9f75d',
    });
    salvar();
    event.target.reset();
    renderizarMetas();
    toast(`Meta "${nome}" criada.`);
  };

  const guardarNaMeta = (id) => {
    const meta = estado.metas.find(m => m.id === id);
    const campo = $(`#meta-add-${id}`);
    if (!meta || !campo) return;
    const valor = parseValor(campo.value);
    if (!Number.isFinite(valor) || valor <= 0) { toast('Informe um valor válido.'); campo.focus(); return; }
    meta.guardado += valor;
    salvar();
    renderizarMetas();
    toast(`${fmt(valor)} adicionados à meta "${meta.nome}".`);
  };

  const excluirMeta = (id) => {
    const meta = estado.metas.find(m => m.id === id);
    if (!meta) return;
    if (!confirm(`Excluir a meta "${meta.nome}"?`)) return;
    estado.metas = estado.metas.filter(m => m.id !== id);
    salvar();
    renderizarMetas();
    toast('Meta excluída.');
  };

  /* ── Relatórios ── */
  const renderizarRelatorios = () => {
    const base = realizadas(porCarteira(estado.transacoes));
    const { entradas, saidas, saldo } = calcular(base);

    const resumo = $('#relatorioResumo');
    if (resumo) {
      resumo.innerHTML = `
        <li class="relatorio-item"><span class="relatorio-item-label">Total de entradas</span><span class="relatorio-item-value positivo">${fmt(entradas)}</span></li>
        <li class="relatorio-item"><span class="relatorio-item-label">Total de saídas</span><span class="relatorio-item-value negativo">${fmt(saidas)}</span></li>
        <li class="relatorio-item"><span class="relatorio-item-label">Saldo atual</span><span class="relatorio-item-value ${saldo >= 0 ? 'neutro' : 'negativo'}">${fmt(saldo)}</span></li>
        <li class="relatorio-item"><span class="relatorio-item-label">Transações</span><span class="relatorio-item-value">${base.length}</span></li>
        <li class="relatorio-item"><span class="relatorio-item-label">Taxa de comprometimento</span><span class="relatorio-item-value ${entradas > 0 && saidas / entradas > 0.8 ? 'negativo' : 'neutro'}">${entradas > 0 ? ((saidas / entradas) * 100).toFixed(1) + '%' : '—'}</span></li>`;
    }

    const gastosCat = new Map();
    base.filter(t => t.tipo === 'saida').forEach(t => {
      gastosCat.set(t.categoriaId, (gastosCat.get(t.categoriaId) || 0) + t.valor);
    });
    const cats = [...gastosCat.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
    const maxCat = cats[0]?.[1] || 1;
    const categorias = $('#relatorioCategorias');
    if (categorias) {
      categorias.innerHTML = cats.length === 0
        ? '<li class="relatorio-item"><span class="relatorio-item-label">Nenhuma saída registrada.</span></li>'
        : cats.map(([id, valor]) => {
            const c = categoriaDe(id);
            return `<li class="relatorio-item" style="flex-direction:column;align-items:flex-start;gap:6px">
              <div class="relatorio-bar-wrap">
                <div class="relatorio-bar-meta"><span>${esc(c.emoji)} ${esc(c.nome)}</span><span style="color:var(--saida)">${fmt(valor)}</span></div>
                <div class="relatorio-bar-track"><div class="relatorio-bar-fill" style="width:${((valor / maxCat) * 100).toFixed(1)}%;background:${c.cor}"></div></div>
              </div>
            </li>`;
          }).join('');
    }

    const maiores = base.filter(t => t.tipo === 'saida').sort((a, b) => b.valor - a.valor).slice(0, 5);
    const elMaiores = $('#relatorioMaiores');
    if (elMaiores) {
      elMaiores.innerHTML = maiores.length === 0
        ? '<li class="relatorio-item"><span class="relatorio-item-label">Nenhuma saída registrada.</span></li>'
        : maiores.map((t, i) => `
            <li class="relatorio-item">
              <span style="color:var(--muted);font-size:13px;min-width:20px">#${i + 1}</span>
              <span class="relatorio-item-label">${esc(categoriaDe(t.categoriaId).emoji)} ${esc(t.descricao)}</span>
              <span class="relatorio-item-value negativo">${fmt(t.valor)}</span>
            </li>`).join('');
    }

    const elCarteiras = $('#relatorioCarteiras');
    if (elCarteiras) {
      const carteiras = estado.carteiraAtiva === 'todas'
        ? estado.carteiras
        : estado.carteiras.filter(c => c.id === estado.carteiraAtiva);
      elCarteiras.innerHTML = carteiras.length === 0
        ? '<li class="relatorio-item"><span class="relatorio-item-label">Nenhuma carteira.</span></li>'
        : carteiras.map(c => {
            const lista = base.filter(t => t.carteiraId === c.id);
            const r = calcular(lista);
            return `<li class="relatorio-item">
              <span class="relatorio-item-label"><span class="wallet-dot" style="display:inline-block;width:10px;height:10px;border-radius:3px;background:${c.cor};margin-right:8px"></span>${esc(c.nome)}</span>
              <span class="relatorio-item-value ${r.saldo >= 0 ? 'positivo' : 'negativo'}">${fmt(r.saldo)}</span>
            </li>`;
          }).join('');
    }
  };

  /* ── Ajustes ── */
  const renderizarAjustes = () => {
    const elCarteiras = $('#listaCarteiras');
    if (elCarteiras) {
      elCarteiras.innerHTML = estado.carteiras.map(c => `
        <li class="settings-row">
          <input type="color" value="${c.cor}" aria-label="Cor da carteira ${esc(c.nome)}"
                 onchange="App.salvarCarteira('${esc(c.id)}','cor',this.value)">
          <input class="row-input" type="text" value="${esc(c.nome)}" maxlength="40"
                 aria-label="Nome da carteira"
                 onchange="App.salvarCarteira('${esc(c.id)}','nome',this.value)">
          <button class="btn btn-icon" type="button" aria-label="Excluir carteira ${esc(c.nome)}"
                  onclick="App.excluirCarteira('${esc(c.id)}')" ${estado.carteiras.length < 2 ? 'disabled' : ''}>✕</button>
        </li>`).join('');
    }

    const elCategorias = $('#listaCategorias');
    if (elCategorias) {
      elCategorias.innerHTML = estado.categorias.map(c => `
        <li class="settings-row">
          <input class="row-input input-emoji" type="text" value="${esc(c.emoji)}" maxlength="4"
                 aria-label="Ícone da categoria ${esc(c.nome)}"
                 onchange="App.salvarCategoria('${esc(c.id)}','emoji',this.value)">
          <input class="row-input" type="text" value="${esc(c.nome)}" maxlength="30"
                 aria-label="Nome da categoria"
                 onchange="App.salvarCategoria('${esc(c.id)}','nome',this.value)">
          <button class="btn btn-icon" type="button" aria-label="Excluir categoria ${esc(c.nome)}"
                  onclick="App.excluirCategoria('${esc(c.id)}')" ${c.id === 'outros' ? 'disabled' : ''}>✕</button>
        </li>`).join('');
    }

    const elRec = $('#listaRecorrencias');
    const vazioRec = $('#emptyRecorrencias');
    if (elRec) {
      elRec.innerHTML = estado.recorrencias.map(r => `
        <li class="settings-row">
          <span class="tx-icon ${r.tipo}" aria-hidden="true">${esc(categoriaDe(r.categoriaId).emoji)}</span>
          <div class="recorrencia-info">
            <strong>${esc(r.descricao)}</strong>
            <span>${fmt(r.valor)} · ${FREQUENCIAS[r.frequencia]} · próxima ${fmtData(r.proxima)}</span>
          </div>
          <label class="toggle-mini" title="Ativa">
            <input type="checkbox" ${r.ativa ? 'checked' : ''} onchange="App.alternarRecorrencia('${esc(r.id)}')" aria-label="Ativar recorrência ${esc(r.descricao)}">
          </label>
          <button class="btn btn-icon" type="button" aria-label="Excluir recorrência ${esc(r.descricao)}"
                  onclick="App.excluirRecorrencia('${esc(r.id)}')">✕</button>
        </li>`).join('');
      vazioRec?.classList.toggle('hidden', estado.recorrencias.length > 0);
    }
  };

  /* ── Adicionar ── */
  const adicionar = (tipo) => {
    const descEl = $('#descricao');
    const valorEl = $('#valor');
    const catEl = $('#categoria');
    const cartEl = $('#carteira');
    const dataEl = $('#dataTransacao');
    const obsEl = $('#observacao');
    const parcelasEl = $('#parcelas');
    const recEl = $('#recorrencia');
    const feedback = $('#formFeedback');

    const descricao = descEl.value.trim();
    const valor = parseValor(valorEl.value);
    const categoriaId = catEl.value;
    const carteiraId = cartEl.value || estado.carteiras[0].id;
    const data = dataEl.value || hojeISO();
    const observacao = obsEl.value.trim();
    const parcelas = Math.min(36, Math.max(1, parseInt(parcelasEl.value, 10) || 1));
    const frequencia = recEl.value;

    if (!descricao) {
      mostrarFeedback('Por favor, insira uma descrição.', 'error');
      descEl.focus();
      return;
    }

    if (!Number.isFinite(valor) || valor <= 0) {
      mostrarFeedback('Por favor, insira um valor válido maior que zero.', 'error');
      valorEl.focus();
      return;
    }

    if (tipo === 'saida' && parcelas > 1) {
      let dataParcela = data;
      for (let i = 1; i <= parcelas; i += 1) {
        estado.transacoes.push({
          id: uid(),
          tipo,
          descricao: `${descricao} (${i}/${parcelas})`.slice(0, 120),
          valor,
          categoriaId,
          carteiraId,
          data: dataParcela,
          observacao,
          parcela: { atual: i, total: parcelas },
        });
        dataParcela = avancarData(dataParcela, 'mensal');
      }
      mostrarFeedback(`✅ ${parcelas} parcelas de ${fmt(valor)} lançadas.`, 'success');
      toast(`📅 ${descricao} em ${parcelas} parcelas.`);
    } else {
      estado.transacoes.push({
        id: uid(),
        tipo,
        descricao,
        valor,
        categoriaId,
        carteiraId,
        data,
        observacao,
        parcela: null,
      });

      if (frequencia !== 'nenhuma') {
        estado.recorrencias.push({
          id: uid(),
          tipo,
          descricao,
          valor,
          categoriaId,
          carteiraId,
          frequencia,
          proxima: proximaOcorrencia(data, frequencia),
          ativa: true,
        });
      }

      const label = tipo === 'entrada' ? 'Entrada' : 'Saída';
      const repeticao = frequencia !== 'nenhuma' ? ` · repete ${FREQUENCIAS[frequencia].toLowerCase()}` : '';
      mostrarFeedback(`✅ ${label} de ${fmt(valor)} registrada${repeticao}.`, 'success');
      toast(`${tipo === 'entrada' ? '✓' : '↗'} ${descricao} · ${fmt(valor)}`);
    }

    salvar();
    atualizarTudo();

    descEl.value = '';
    valorEl.value = '';
    obsEl.value = '';
    parcelasEl.value = '1';
    recEl.value = 'nenhuma';
    dataEl.value = hojeISO();
    descEl.focus();
  };

  /* ── Excluir / limpar ── */
  const excluir = (id) => {
    const transacao = estado.transacoes.find(t => t.id === id);
    if (!transacao) return;
    estado.transacoes = estado.transacoes.filter(t => t.id !== id);
    salvar();
    atualizarTudo();
    toast(`"${transacao.descricao}" removida.`);
  };

  const limparTudo = () => {
    if (!confirm('Apagar todas as transações, orçamentos, metas e recorrências? Carteiras e categorias serão mantidas.')) return;
    estado.transacoes = [];
    estado.orcamentos = {};
    estado.metas = [];
    estado.recorrencias = [];
    salvar();
    atualizarTudo();
    toast('Dados financeiros apagados.');
  };

  /* ── Exportar / importar ── */
  const exportar = () => {
    const conteudo = {
      app: 'finance-tracker-pro',
      versao: VERSAO,
      exportadoEm: new Date().toISOString(),
      estado,
    };
    const blob = new Blob([JSON.stringify(conteudo, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `finance-tracker-${hojeISO()}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
    toast('⬇ Backup exportado.');
  };

  const importar = () => $('#importFile')?.click();

  const lerImportacao = (arquivo) => {
    if (!arquivo) return;
    const leitor = new FileReader();
    leitor.onload = () => {
      try {
        const dados = JSON.parse(String(leitor.result));
        const bruto = Array.isArray(dados) ? { transacoes: dados } : (dados.estado || dados);
        const normalizado = normalizarEstado(bruto);

        if (normalizado.transacoes.length === 0 && normalizado.metas.length === 0 && normalizado.recorrencias.length === 0) {
          throw new Error('vazio');
        }

        importacaoPendente = normalizado;
        $('#importResumo').textContent =
          `Arquivo com ${normalizado.transacoes.length} transações, ${normalizado.carteiras.length} carteira(s), ` +
          `${normalizado.categorias.length} categorias, ${normalizado.metas.length} meta(s) e ` +
          `${normalizado.recorrencias.length} recorrência(s). Mesclar mantém os dados atuais; substituir troca tudo.`;
        $('#importDialog').showModal();
      } catch {
        toast('❌ Arquivo inválido. Use um JSON exportado pelo app.');
      } finally {
        const input = $('#importFile');
        if (input) input.value = '';
      }
    };
    leitor.onerror = () => toast('❌ Não foi possível ler o arquivo.');
    leitor.readAsText(arquivo);
  };

  const fecharImportacao = (modo) => {
    $('#importDialog')?.close();
    if (!importacaoPendente || modo === 'cancelar') { importacaoPendente = null; return; }

    const entrada = importacaoPendente;
    importacaoPendente = null;

    if (modo === 'substituir') {
      entrada.tema = estado.tema;
      estado = entrada;
      salvar();
      aplicarTema();
      atualizarTudo();
      toast('Dados substituídos pelo backup.');
      return;
    }

    // Mesclar
    entrada.carteiras.forEach(c => {
      if (!estado.carteiras.some(x => x.id === c.id)) estado.carteiras.push(c);
    });
    entrada.categorias.forEach(c => {
      if (!estado.categorias.some(x => x.id === c.id)) estado.categorias.push(c);
    });

    const agora = Date.now();
    entrada.transacoes.forEach((t, i) => {
      estado.transacoes.push({ ...t, id: `imp-${agora}-${i}-${uid().slice(0, 5)}` });
    });
    entrada.metas.forEach((m, i) => {
      estado.metas.push({ ...m, id: `meta-imp-${agora}-${i}` });
    });
    entrada.recorrencias.forEach((r, i) => {
      estado.recorrencias.push({ ...r, id: `rec-imp-${agora}-${i}` });
    });
    Object.entries(entrada.orcamentos).forEach(([catId, limite]) => {
      estado.orcamentos[catId] = Math.max(estado.orcamentos[catId] || 0, limite);
    });

    if (!estado.carteiras.some(c => c.id === estado.carteiraAtiva) && estado.carteiraAtiva !== 'todas') {
      estado.carteiraAtiva = 'todas';
    }

    salvar();
    atualizarTudo();
    toast('Backup mesclado com os dados atuais.');
  };

  /* ── Carteiras ── */
  const adicionarCarteira = (event) => {
    event.preventDefault();
    const nome = $('#nomeCarteira').value.trim();
    if (!nome) { toast('Informe o nome da carteira.'); $('#nomeCarteira').focus(); return; }
    const cor = $('#corCarteira').value;
    estado.carteiras.push({ id: `cart-${uid().slice(0, 8)}`, nome: nome.slice(0, 40), cor });
    salvar();
    event.target.reset();
    $('#corCarteira').value = '#c9f75d';
    atualizarTudo();
    toast(`Carteira "${nome}" criada.`);
  };

  const salvarCarteira = (id, campo, valor) => {
    const carteira = estado.carteiras.find(c => c.id === id);
    if (!carteira) return;
    if (campo === 'nome') {
      const nome = String(valor).trim().slice(0, 40);
      if (!nome) { atualizarTudo(); return; }
      carteira.nome = nome;
    }
    if (campo === 'cor') carteira.cor = corValida(valor);
    salvar();
    atualizarTudo();
  };

  const excluirCarteira = (id) => {
    if (estado.carteiras.length < 2) { toast('Mantenha pelo menos uma carteira.'); return; }
    const carteira = estado.carteiras.find(c => c.id === id);
    if (!carteira) return;
    if (!confirm(`Excluir a carteira "${carteira.nome}"? As transações dela passam para outra carteira.`)) return;

    estado.carteiras = estado.carteiras.filter(c => c.id !== id);
    const destino = estado.carteiras[0].id;
    estado.transacoes.forEach(t => { if (t.carteiraId === id) t.carteiraId = destino; });
    estado.recorrencias.forEach(r => { if (r.carteiraId === id) r.carteiraId = destino; });
    if (estado.carteiraAtiva === id) estado.carteiraAtiva = 'todas';
    salvar();
    atualizarTudo();
    toast('Carteira excluída.');
  };

  const trocarCarteira = (id) => {
    estado.carteiraAtiva = id === 'todas' ? 'todas' : (estado.carteiras.some(c => c.id === id) ? id : 'todas');
    salvar();
    atualizarTudo();
  };

  /* ── Categorias ── */
  const adicionarCategoria = (event) => {
    event.preventDefault();
    const nome = $('#nomeCategoria').value.trim();
    if (!nome) { toast('Informe o nome da categoria.'); $('#nomeCategoria').focus(); return; }
    const emoji = ($('#emojiCategoria').value.trim() || '📦').slice(0, 4);

    let id = slug(nome);
    if (estado.categorias.some(c => c.id === id)) id = `${id}-${uid().slice(0, 5)}`;

    const cores = ['#ff9f68', '#5ec8f8', '#ff6b81', '#7ee787', '#c792ea', '#ffd166'];
    estado.categorias.push({ id, nome: nome.slice(0, 30), emoji, cor: cores[estado.categorias.length % cores.length] });
    salvar();
    event.target.reset();
    atualizarTudo();
    toast(`Categoria "${nome}" criada.`);
  };

  const salvarCategoria = (id, campo, valor) => {
    const categoria = estado.categorias.find(c => c.id === id);
    if (!categoria) return;
    if (campo === 'nome') {
      const nome = String(valor).trim().slice(0, 30);
      if (!nome) { atualizarTudo(); return; }
      categoria.nome = nome;
    }
    if (campo === 'emoji') categoria.emoji = (String(valor).trim() || '📦').slice(0, 4);
    salvar();
    atualizarTudo();
  };

  const excluirCategoria = (id) => {
    if (id === 'outros') { toast('A categoria "Outros" não pode ser excluída.'); return; }
    const categoria = estado.categorias.find(c => c.id === id);
    if (!categoria) return;
    if (!confirm(`Excluir a categoria "${categoria.nome}"? As transações vão para "Outros".`)) return;

    estado.categorias = estado.categorias.filter(c => c.id !== id);
    estado.transacoes.forEach(t => { if (t.categoriaId === id) t.categoriaId = 'outros'; });
    estado.recorrencias.forEach(r => { if (r.categoriaId === id) r.categoriaId = 'outros'; });
    delete estado.orcamentos[id];
    salvar();
    atualizarTudo();
    toast('Categoria excluída.');
  };

  /* ── Recorrências ── */
  const aplicarRecorrencias = () => {
    const hoje = hojeISO();
    let criadas = 0;
    estado.recorrencias.filter(r => r.ativa).forEach(r => {
      let seguranca = 0;
      while (r.proxima <= hoje && seguranca < 120) {
        estado.transacoes.push({
          id: uid(),
          tipo: r.tipo,
          descricao: r.descricao,
          valor: r.valor,
          categoriaId: r.categoriaId,
          carteiraId: r.carteiraId,
          data: r.proxima,
          observacao: '',
          parcela: null,
        });
        r.proxima = avancarData(r.proxima, r.frequencia);
        criadas += 1;
        seguranca += 1;
      }
    });
    if (criadas > 0) salvar();
    return criadas;
  };

  const alternarRecorrencia = (id) => {
    const r = estado.recorrencias.find(x => x.id === id);
    if (!r) return;
    r.ativa = !r.ativa;
    if (r.ativa && r.proxima <= hojeISO()) {
      const criadas = aplicarRecorrencias();
      if (criadas > 0) toast(`${criadas} lançamento(s) recorrente(s) aplicado(s).`);
    }
    salvar();
    atualizarTudo();
  };

  const excluirRecorrencia = (id) => {
    const r = estado.recorrencias.find(x => x.id === id);
    if (!r) return;
    if (!confirm(`Excluir a recorrência "${r.descricao}"?`)) return;
    estado.recorrencias = estado.recorrencias.filter(x => x.id !== id);
    salvar();
    atualizarTudo();
    toast('Recorrência excluída.');
  };

  /* ── Feedback ── */
  const mostrarFeedback = (mensagem, tipo) => {
    const el = $('#formFeedback');
    if (!el) return;
    el.textContent = mensagem;
    el.className = `form-feedback ${tipo}`;
    el.classList.remove('hidden');
    setTimeout(() => el.classList.add('hidden'), 4000);
  };

  /* ── Atualização geral ── */
  const atualizarTudo = () => {
    renderizarCarteiraFiltro();
    renderizarSelects();
    renderizarCards();
    renderizarResumoOrcamento();
    renderizarGraficos();
    renderizarRecentes();
    renderizarLista();
    renderizarOrcamentos();
    renderizarMetas();
    renderizarRelatorios();
    renderizarAjustes();
  };

  /* ── Init ── */
  const init = () => {
    carregar();
    aplicarTema();

    const dataEl = $('#dataAtual');
    if (dataEl) {
      dataEl.textContent = new Date().toLocaleDateString('pt-BR', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
      });
    }

    const dataForm = $('#dataTransacao');
    if (dataForm) dataForm.value = hojeISO();

    $$('.menu-item').forEach(item => {
      item.addEventListener('click', () => {
        const section = item.dataset.section;
        if (section) navegarPara(section);
      });
      item.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          item.click();
        }
      });
    });

    $('#menuToggle')?.addEventListener('click', () => {
      const aberto = $('#sidebar')?.classList.contains('open');
      definirMenu(!aberto);
    });
    $('#sidebarOverlay')?.addEventListener('click', () => definirMenu(false));
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        if (!$('#importDialog')?.open) definirMenu(false);
      }
    });
    window.addEventListener('resize', () => {
      if (window.innerWidth > 900) definirMenu(false);
    });

    $('#importFile')?.addEventListener('change', (event) => {
      lerImportacao(event.target.files?.[0]);
    });

    if (window.Chart) {
      Chart.defaults.font.family = "'DM Sans', system-ui, sans-serif";
      Chart.defaults.color = cssVar('--muted');
    }

    const criadas = aplicarRecorrencias();
    atualizarTudo();
    if (criadas > 0) toast(`${criadas} lançamento(s) recorrente(s) aplicado(s).`);
  };

  document.addEventListener('DOMContentLoaded', init);

  return {
    adicionar, excluir, limparTudo, atualizarTudo, renderizarLista, navegarPara,
    exportar, importar, alternarTema, trocarCarteira, salvarOrcamento,
    adicionarMeta, guardarNaMeta, excluirMeta,
    adicionarCarteira, salvarCarteira, excluirCarteira,
    adicionarCategoria, salvarCategoria, excluirCategoria,
    alternarRecorrencia, excluirRecorrencia, fecharImportacao, fecharMenu: () => definirMenu(false),
  };

})();
