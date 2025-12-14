/* ==========================================================================
   UI.JS - Interface do Usuário (View)
   --------------------------------------------------------------------------
   Este arquivo gerencia tudo que o usuário vê:
   1. Manipulação do DOM (HTML)
   2. Gráficos (Chart.js)
   3. Alertas e Modais (SweetAlert2)
   4. Otimizações de Performance (Lazy Loading, Renderização)
   ========================================================================== */

// Pega a referência global do Chart.js (importada via CDN no HTML)
const ChartJS = window.Chart; 

export const UI = {
    
    // ==========================================================================
    // 1. CACHE DE ELEMENTOS (Performance)
    // ==========================================================================
    // Guarda as referências dos elementos aqui para não precisar ficar 
    // buscando no HTML (document.getElementById) toda hora. Isso deixa o app mais rápido.
    els: {
        body: document.body,
        appContent: document.getElementById('app-content'),       // Área principal do App
        authContainer: document.getElementById('auth-container'), // Área de Login
        logoutContainer: document.getElementById('logout-container'),
        welcomeMsg: document.getElementById('welcome-message'),
        navLinks: document.querySelectorAll('.app-nav'),
        themeBtn: document.getElementById('theme-toggle'),
        
        // Containers onde as listas de filmes serão desenhadas
        tabelaTodos: document.getElementById('tabela-todos-container'),
        tabelaAssistidos: document.getElementById('tabela-assistidos-container'),
        tabelaNaoAssistidos: document.getElementById('tabela-nao-assistidos-container'),
        
        // Elementos do Formulário de Cadastro
        form: document.getElementById('filme-form'),
        previewImg: document.getElementById('poster-preview-img'),
        previewPlaceholder: document.getElementById('poster-placeholder'),
        generoTagContainer: document.getElementById('genero-tag-container'),
        generoInput: document.getElementById('genero-input'),
        dataAssistidoGroup: document.getElementById('data-assistido-group'),
        
        // Elementos onde mostramos os números (Estatísticas)
        statTotal: document.getElementById('stat-total-filmes'),
        statMedia: document.getElementById('stat-media-notas'),
        statPctNac: document.getElementById('stat-pct-nacionais'),
        statPctInt: document.getElementById('stat-pct-internacionais'),
        statDecada: document.getElementById('stat-decada-popular'),
        statAtor: document.getElementById('stat-ator-frequente'),
        statMelhor: document.getElementById('stat-melhor-filme'),
        statPior: document.getElementById('stat-pior-filme'),
        
        // Elementos do Perfil
        perfilNome: document.getElementById('perfil-nome'),
        perfilNick: document.getElementById('perfil-nickname'),
        perfilDesde: document.getElementById('perfil-membro-desde'),
        perfilTotal: document.getElementById('perfil-total-filmes'),
        perfilAssistidos: document.getElementById('perfil-total-assistidos'),
        conquistasContainer: document.getElementById('conquistas-container')
    },

    // Armazena as instâncias dos gráficos para poder destruí-las antes de recriar
    chartsInstances: {},

    // ==========================================================================
    // 2. TEMPLATES (DRY - Don't Repeat Yourself - Não se Repita - Principio da programação)
    // ==========================================================================
    // Funções auxiliares para gerar HTML repetitivo. Se precisar mudar o design
    // de como a imagem ou a data aparece, será mudado apenas aqui.
    templates: {
        // Gera o HTML da capa do filme com Lazy Loading (só carrega quando aparecer na tela)
        poster: (url, cssClass = 'poster-thumb', alt = 'Capa') => {
            if (url && url !== 'N/A') {
                // 'loading="lazy"': Só baixa a imagem quando ela aparece na tela (Economiza dados e memória)
                // 'decoding="async"': Processa a imagem em paralelo para não travar a rolagem
                return `
                    <img src="${url}" loading="lazy" decoding="async" class="${cssClass}" alt="${alt}" 
                         onerror="this.style.display='none'; this.nextElementSibling.style.display='flex'">
                    <div class="${cssClass} d-flex align-items-center justify-content-center bg-dark text-muted" 
                         style="display:none !important;"><i class="fas fa-film ${cssClass === 'movie-poster-img' ? 'fa-3x' : ''}"></i></div>
                `;
            }
            // Fallback caso não tenha URL (mostra ícone cinza)
            return `<div class="${cssClass} d-flex align-items-center justify-content-center bg-dark text-muted"><i class="fas fa-film ${cssClass === 'movie-poster-img' ? 'fa-3x' : ''}"></i></div>`;
        },

        // Formata data do padrão norteamericano (YYYY-MM-DD) para brasileiro (DD/MM/YYYY)
        date: (dateString) => {
            if (!dateString) return '<i class="far fa-clock ms-1 text-muted"></i>';
            return new Date(dateString.replace(/-/g, '/')).toLocaleDateString('pt-BR');
        },

        // Retorna o ícone de Check (Verde) ou Relógio (Amarelo)
        statusIcon: (assistido) => {
            return assistido 
                ? '<i class="fas fa-check-circle text-success" title="Assistido"></i>' 
                : '<i class="fas fa-clock text-warning" title="Para Assistir"></i>';
        }
    },

    // ==========================================================================
    // 3. FEEDBACK VISUAL (SweetAlert2 Wrappers)
    // ==========================================================================
    
    // Notificação flutuante no canto da tela (ex: "Filme salvo!")
    toast: (title, icon = 'success') => {
        const Toast = Swal.mixin({
            toast: true, position: 'top-end', showConfirmButton: false, timer: 3000, timerProgressBar: true,
            didOpen: (t) => { t.addEventListener('mouseenter', Swal.stopTimer); t.addEventListener('mouseleave', Swal.resumeTimer); }
        });
        Toast.fire({ icon, title });
    },

    // Alerta padrão centralizado
    alert: (title, text, icon = 'info') => Swal.fire({ title, text, icon }),

    // Caixa de confirmação (Sim/Não) usada para excluir itens
    confirm: (title, text, confirmBtnText = 'Sim', cancelBtnText = 'Cancelar') => {
        return Swal.fire({
            title, text, icon: 'warning', showCancelButton: true,
            confirmButtonColor: '#3085d6', cancelButtonColor: '#d33',
            confirmButtonText: confirmBtnText, cancelButtonText: cancelBtnText
        });
    },

    // ==========================================================================
    // 4. CONTROLE DE VISIBILIDADE E TEMA
    // ==========================================================================
    
    // Alterna entre a tela de Login e a Tela Principal do App
    toggleAuthView: (isLoggedIn, userProfile = null) => {
        const { appContent, logoutContainer, authContainer, navLinks, welcomeMsg } = UI.els;
        
        // Mostra/Esconde seções baseado no login
        appContent.style.display = isLoggedIn ? 'block' : 'none';
        logoutContainer.style.display = isLoggedIn ? 'block' : 'none';
        authContainer.style.display = isLoggedIn ? 'none' : 'block';
        navLinks.forEach(link => link.style.display = isLoggedIn ? 'block' : 'none');

        // Atualiza mensagem de boas-vindas na navbar
        if (isLoggedIn && userProfile) {
            welcomeMsg.textContent = `Olá, ${userProfile.nickname}!`;
            welcomeMsg.style.display = 'block';
        } else {
            welcomeMsg.style.display = 'none';
            // Reseta para mostrar o login caso deslogue
            const lCard = document.getElementById('login-card');
            const rCard = document.getElementById('register-card');
            if(lCard) lCard.style.display = 'block';
            if(rCard) rCard.style.display = 'none';
        }
    },

    // Alterna entre Claro/Escuro (Botão da Lua/Sol)
    toggleTheme: () => {
        const isDark = UI.els.body.classList.toggle('dark-mode');
        UI.els.themeBtn.innerHTML = isDark ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
        return isDark ? 'dark' : 'light';
    },

    // Define o tema ao carregar a página (baseado no localStorage)
    setTheme: (theme) => {
        const isDark = theme === 'dark';
        if (isDark) UI.els.body.classList.add('dark-mode');
        else UI.els.body.classList.remove('dark-mode');
        UI.els.themeBtn.innerHTML = isDark ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
    },

    // Ativa o Modo Visitante (Esconde botões de edição/exclusão)
    enableReadOnlyMode: () => {
        // Esconde formulário de cadastro
        const sectionCadastro = document.getElementById('cadastro-section');
        if(sectionCadastro) sectionCadastro.style.display = 'none';
        
        // Troca botão de Sair por "Criar minha Lista"
        UI.els.logoutContainer.innerHTML = `<a href="index.html" class="btn btn-primary btn-sm"><i class="fas fa-plus-circle me-1"></i> Criar minha Lista</a>`;
        UI.els.logoutContainer.style.display = 'block';

        // Injeta CSS para esconder botões de ação nas tabelas e grids
        const style = document.createElement('style');
        style.innerHTML = `.col-acoes, .btn-edit, .btn-delete, .movie-card .opacity-0 { display: none !important; } .movie-card { cursor: default; }`;
        document.head.appendChild(style);
    },

    // ==========================================================================
    // 5. RENDERIZAÇÃO (Listas e Tabelas)
    // ==========================================================================
    
    // Função principal que decide se desenha Tabela ou Grid
    renderContent: (filmes, viewType = 'table') => {
        // Separa os filmes em 3 grupos para as abas
        const assistidos = filmes.filter(f => f.assistido);
        const naoAssistidos = filmes.filter(f => !f.assistido);
        
        // Escolhe qual função usar
        const renderFn = viewType === 'table' ? UI.renderTable : UI.renderGrid;
        
        // Desenha as 3 abas
        renderFn(filmes, UI.els.tabelaTodos);
        renderFn(assistidos, UI.els.tabelaAssistidos);
        renderFn(naoAssistidos, UI.els.tabelaNaoAssistidos);

        // OTIMIZAÇÃO: Usa requestAnimationFrame para atualizar estatísticas.
        // Isso permite que o navegador desenhe a tabela PRIMEIRO e calcule os gráficos DEPOIS,
        // evitando travamentos na interface.
        requestAnimationFrame(() => UI.updateStats(assistidos, filmes.length));
    },

    // Desenha a lista em formato de Tabela (Linhas)
    renderTable: (lista, container) => {
        if (!container) return;
        if (!lista.length) { container.innerHTML = '<p class="text-center text-muted pt-3">Nenhum filme encontrado.</p>'; return; }

        // Mapeia cada filme para uma string HTML de linha (<tr>)
        // Usar map().join('') é muito mais rápido que fazer innerHTML += em loop
        const rows = lista.map((f, i) => `
            <tr data-id="${f.id}" style="cursor: pointer;">
                <td class="col-num align-middle">${i + 1}</td>
                <td class="col-poster align-middle">${UI.templates.poster(f.posterUrl, 'poster-thumb')}</td>
                <td class="col-titulo align-middle fw-bold">${f.titulo || 'N/A'}</td>
                <td class="col-nota align-middle">⭐ ${(f.nota || 0).toFixed(1)}</td>
                <td class="col-ano align-middle">${f.ano || '-'}</td>
                <td class="col-direcao align-middle text-truncate" style="max-width: 150px;">${f.direcao?.join(', ') || ''}</td>
                <td class="col-atores align-middle text-truncate" style="max-width: 150px;">${f.atores?.join(', ') || ''}</td>
                <td class="col-genero align-middle">${f.genero?.join(', ') || ''}</td>
                <td class="col-assistido align-middle text-center">${UI.templates.statusIcon(f.assistido)}</td>
                <td class="col-acoes align-middle text-end">
                    <div class="d-flex align-items-center justify-content-end gap-2">
                        <button class="btn btn-sm btn-link text-muted btn-detalhes" type="button" data-bs-toggle="collapse" data-bs-target="#detalhes-${f.id}"><i class="fas fa-chevron-down"></i></button>
                        <div class="dropdown">
                            <button class="btn btn-sm btn-outline-secondary border-0" type="button" data-bs-toggle="dropdown"><i class="fas fa-ellipsis-v"></i></button>
                            <ul class="dropdown-menu dropdown-menu-end dropdown-menu-dark shadow">
                                <li><button class="dropdown-item btn-edit"><i class="fas fa-pen me-2 text-info"></i> Editar</button></li>
                                <li><hr class="dropdown-divider"></li>
                                <li><button class="dropdown-item btn-delete text-danger"><i class="fas fa-trash me-2"></i> Excluir</button></li>
                            </ul>
                        </div>
                    </div>
                </td>
            </tr>
            <tr class="linha-detalhes"><td colspan="12" class="p-0 border-0">
                <div class="collapse" id="detalhes-${f.id}">
                    <div class="p-3 bg-dark bg-opacity-25 border-bottom border-secondary text-muted small">
                        <div class="row">
                            <div class="col-md-6 mb-2"><strong class="text-light"><i class="fas fa-globe me-2"></i>Origem:</strong> ${f.origem || '-'}</div>
                            <div class="col-md-6 mb-2"><strong class="text-light"><i class="fas fa-calendar-day me-2"></i>Data Assistido:</strong> ${f.assistido ? UI.templates.date(f.dataAssistido) : '-'}</div>
                        </div>
                    </div>
                </div>
            </td></tr>
        `).join('');

        // Injeta tudo de uma vez no DOM
        container.innerHTML = `<table class="table table-dark table-hover table-sm tabela-filmes mb-0"><thead><tr>
            <th>#</th><th style="width:50px">Capa</th><th class="sortable" data-sort="titulo">Título <i class="fas fa-sort"></i></th>
            <th class="sortable" data-sort="nota">Nota <i class="fas fa-sort"></i></th><th class="sortable" data-sort="ano">Ano <i class="fas fa-sort"></i></th>
            <th>Direção</th><th>Atores</th><th>Gênero</th><th class="text-center">Status</th><th class="text-end">Ações</th>
        </tr></thead><tbody>${rows}</tbody></table>`;
        
        // Ativa o scroll com clique e arraste
        UI.initDragScroll(container);
    },

    // Desenha a lista em formato de Grade (Cards)
    renderGrid: (lista, container) => {
        if (!container) return;
        if (!lista.length) { container.innerHTML = '<p class="text-center text-muted pt-3">Nenhum filme encontrado.</p>'; return; }

        const cards = lista.map(f => `
            <div class="movie-card" data-id="${f.id}">
                <div class="position-relative" style="height: 100%;">
                    ${UI.templates.poster(f.posterUrl, 'movie-poster-img', f.titulo)}
                    ${f.assistido ? '<div class="movie-watched-badge"><i class="fas fa-check"></i></div>' : ''}
                    
                    <div class="movie-info-overlay">
                        <h5 class="movie-card-title">${f.titulo}</h5>
                        <div class="movie-card-meta">
                            <span><i class="fas fa-star text-warning"></i> ${(f.nota || 0).toFixed(1)}</span>
                            <span>${f.ano || ''}</span>
                        </div>
                    </div>
                    
                    <div class="position-absolute top-0 start-0 p-2 opacity-0 d-flex flex-column justify-content-center align-items-center w-100 h-100" style="background: rgba(0,0,0,0.6); backdrop-filter: blur(2px);">
                        <button class="btn btn-sm btn-info btn-edit mb-2 w-75"><i class="fas fa-edit me-1"></i> Editar</button>
                        <button class="btn btn-sm btn-danger btn-delete w-75"><i class="fas fa-trash me-1"></i> Excluir</button>
                    </div>
                </div>
            </div>
        `).join('');
        container.innerHTML = `<div class="movies-grid">${cards}</div>`;
    },

    // ==========================================================================
    // 6. FORMULÁRIO (Preenchimento e Validação)
    // ==========================================================================
    
    // Atualiza a imagem de preview quando o usuário digita ou a API retorna
    updatePreviewPoster: (url) => {
        const { previewImg: img, previewPlaceholder: placeholder } = UI.els;
        // Reseta estados anteriores
        img.onload = null; img.onerror = null; img.removeAttribute('data-tried-original');

        if (url && url !== 'N/A') {
            // Tenta obter versão HD da OMDb removendo _SX...
            const hdUrl = url.replace(/_SX[0-9]+.*\./, ".");
            img.src = hdUrl;
            
            img.onload = () => { img.style.display = 'block'; placeholder.style.display = 'none'; };
            
            // Se HD falhar, tenta a original. Se falhar, mostra placeholder.
            img.onerror = function() {
                if (!this.hasAttribute('data-tried-original')) {
                    this.setAttribute('data-tried-original', 'true');
                    this.src = url; // Fallback para URL original
                } else {
                    this.style.display = 'none'; placeholder.style.display = 'block';
                }
            };
        } else {
            img.src = ''; img.style.display = 'none'; placeholder.style.display = 'block';
        }
    },

    // Mostra/Esconde campo de data dependendo se assistiu
    toggleDataAssistido: (show) => {
        UI.els.dataAssistidoGroup.style.display = show ? 'block' : 'none';
        const input = UI.els.dataAssistidoGroup.querySelector('input');
        if (show) input.setAttribute('required', 'required');
        else { input.removeAttribute('required'); input.value = ''; }
    },

    // Cria as "pílulas" visuais dos gêneros
    renderGenerosTags: (generos, onRemove) => {
        if (!UI.els.generoTagContainer) return;
        UI.els.generoTagContainer.querySelectorAll('.tag-pill').forEach(el => el.remove());
        generos.slice().reverse().forEach(label => {
            const tagEl = document.createElement('span'); tagEl.className = 'tag-pill';
            tagEl.innerHTML = `<span>${label}</span><button class="tag-remove-btn">&times;</button>`;
            tagEl.querySelector('button').addEventListener('click', () => onRemove(label));
            UI.els.generoTagContainer.prepend(tagEl);
        });
    },

    // Limpa o formulário para novo cadastro
    clearForm: () => {
        UI.els.form.reset();
        UI.els.form.classList.remove('was-validated');
        UI.updatePreviewPoster('');
        UI.toggleDataAssistido(false);
        UI.els.generoTagContainer.querySelectorAll('.tag-pill').forEach(el => el.remove());
    },

    // Preenche o formulário com dados de um filme (para edição)
    fillForm: (f, generosCallback) => {
        document.getElementById('titulo').value = f.titulo;
        document.getElementById('ano').value = f.ano;
        document.getElementById('nota').value = f.nota;
        document.getElementById('direcao').value = f.direcao?.join(', ') || '';
        document.getElementById('atores').value = f.atores?.join(', ') || '';
        document.getElementById('origem').value = f.origem || "";
        document.getElementById('assistido').value = f.assistido ? 'sim' : 'nao';
        
        UI.toggleDataAssistido(f.assistido);
        if (f.assistido) document.getElementById('data-assistido').value = f.dataAssistido;
        
        UI.updatePreviewPoster(f.posterUrl);
        if (f.genero && generosCallback) generosCallback(f.genero);
    },

    // ==========================================================================
    // 7. ESTATÍSTICAS E RANKINGS
    // ==========================================================================
    
    // Calcula todos os números do Dashboard
    updateStats: (assistidos, total) => {
        // Atualiza Cards Superiores
        UI.els.statTotal.textContent = assistidos.length;
        UI.els.statMedia.textContent = assistidos.length ? (assistidos.reduce((a, f) => a + (f.nota || 0), 0) / assistidos.length).toFixed(1) : '0.0';
        
        const nac = assistidos.filter(f => f.origem === 'Nacional').length;
        UI.els.statPctNac.textContent = `${Math.round((nac / (assistidos.length || 1)) * 100)}%`;
        UI.els.statPctInt.textContent = `${Math.round(((assistidos.length - nac) / (assistidos.length || 1)) * 100)}%`;

        // Função Helper para contar frequências (ex: quantos filmes de Drama?)
        const countBy = (list, key) => {
            const counts = {};
            list.forEach(f => (Array.isArray(f[key]) ? f[key] : [f[key]]).forEach(i => { if(i) counts[i] = (counts[i]||0) + 1; }));
            return Object.entries(counts).sort((a,b) => b[1] - a[1]);
        };

        // Top Atores
        const topAtores = countBy(assistidos, 'atores');
        UI.els.statAtor.textContent = topAtores.length ? topAtores[0][0] : '-';

        // Décadas
        const decadas = {}; assistidos.forEach(f => { if(f.ano) { const d = Math.floor(f.ano/10)*10; decadas[d]=(decadas[d]||0)+1; }});
        const topDec = Object.entries(decadas).sort((a,b)=>b[1]-a[1]);
        UI.els.statDecada.textContent = topDec.length ? `Anos ${topDec[0][0]}` : '-';

        // Melhor e Pior filme
        const melhor = assistidos.reduce((p, c) => (p.nota||0) > (c.nota||0) ? p : c, {});
        UI.els.statMelhor.textContent = melhor.titulo || '-';
        const pior = assistidos.reduce((p, c) => (p.nota||10) < (c.nota||10) ? p : c, {});
        UI.els.statPior.textContent = pior.titulo || '-';

        // Renderiza as Barras de Ranking (Texto)
        UI.renderRankings('ranking-generos-bars', countBy(assistidos, 'genero').slice(0, 12));
        UI.renderRankings('ranking-atores-bars', topAtores.slice(0, 12));
        UI.renderRankings('ranking-diretores-bars', countBy(assistidos, 'direcao').slice(0, 12));
        
        const anosData = Object.entries(assistidos.reduce((acc, f) => { if(f.ano) acc[f.ano]=(acc[f.ano]||0)+1; return acc; }, {})).sort((a,b)=>b[1]-a[1]).slice(0,12);
        UI.renderRankings('ranking-anos-bars', anosData);

        // OTIMIZAÇÃO: Só desenha os gráficos pesados (Chart.js) se a seção estiver visível na tela
        const { estatisticasSection: sStats, graficosSection: sGraph } = { 
            estatisticasSection: document.getElementById('estatisticas-section'), 
            graficosSection: document.getElementById('graficos-section') 
        };
        if ((sStats && sStats.offsetParent) || (sGraph && sGraph.offsetParent)) {
            UI.renderCharts(assistidos);
        }
    },

    // Renderiza as barras de progresso simples (HTML puro)
    renderRankings: (elId, data) => {
        const container = document.getElementById(elId);
        if (!container) return;
        if (!data.length) { container.innerHTML = '<p class="text-muted small">N/A</p>'; return; }
        
        const max = Math.max(...data.map(d => d[1]));
        // Cria uma string única e insere no DOM de uma vez (Performance)
        const html = data.map(([label, count]) => `
            <div class="ranking-bar-item mb-2">
                <span class="ranking-bar-label">${label}</span>
                <div class="ranking-bar-container"><div class="ranking-bar" style="width: ${(count/max)*100}%" title="${label}: ${count}"></div></div>
                <span class="ranking-bar-count">${count}</span>
            </div>
        `).join('');
        container.innerHTML = html;
    },

    // Renderiza os Gráficos Complexos (Chart.js)
    renderCharts: (filmes) => {
        if (!ChartJS) return;
        
        // Ajusta cores baseadas no tema (Claro/Escuro)
        const isDark = UI.els.body.classList.contains('dark-mode');
        const colorText = isDark ? 'rgba(226, 232, 240, 0.8)' : 'rgba(0, 0, 0, 0.7)';
        const colorGrid = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';
        
        ChartJS.defaults.color = colorText;
        ChartJS.defaults.borderColor = colorGrid;

        // Helper para criar gráficos reduzindo a verbosidade
        const createChart = (id, type, labels, data, labelStr, bgColors, borderColor, opts={}) => {
            const ctx = document.getElementById(id)?.getContext('2d');
            if (!ctx) return;
            // Destrói o gráfico anterior se existir para evitar vazamento de memória
            if (UI.chartsInstances[id]) UI.chartsInstances[id].destroy();

            UI.chartsInstances[id] = new ChartJS(ctx, {
                type,
                data: {
                    labels,
                    datasets: [{
                        label: labelStr, data, backgroundColor: bgColors,
                        borderColor: borderColor || (Array.isArray(bgColors)?bgColors[0]:bgColors),
                        borderWidth: type.includes('line') ? 2 : 0, fill: true, tension: 0.3
                    }]
                },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    plugins: { legend: { display: true, labels: { color: colorText, boxWidth: 12 } } },
                    scales: opts.scales || {}, indexAxis: opts.indexAxis || 'x'
                }
            });
        };

        // Lógica de preparação dos dados para cada gráfico...
        // 1. Gêneros
        const count = (k) => { const c={}; filmes.forEach(f => (Array.isArray(f[k])?f[k]:[f[k]]).forEach(i=>{if(i)c[i]=(c[i]||0)+1})); return Object.entries(c).sort((a,b)=>b[1]-a[1]).slice(0,5); };
        const gens = count('genero');
        createChart('generosChart','doughnut',gens.map(x=>x[0]),gens.map(x=>x[1]),'Filmes',['#a855f7','#3b82f6','#ec4899','#f97316','#14b8a6']);
        
        // 2. Diretores
        const dirs = count('direcao');
        createChart('diretoresChart','bar',dirs.map(x=>x[0]),dirs.map(x=>x[1]),'Qtd.','rgba(236,72,153,0.7)',null,{indexAxis:'y'});
        
        // 3. Origem
        const origs={}; filmes.forEach(f=>{if(f.origem)origs[f.origem]=(origs[f.origem]||0)+1});
        createChart('origemChart','pie',Object.keys(origs),Object.values(origs),'Origem',['#3b82f6','#14b8a6']);
        
        // 4. Ano
        const anosC={}; filmes.forEach(f=>{if(f.ano)anosC[f.ano]=(anosC[f.ano]||0)+1});
        const topAnos=Object.entries(anosC).sort((a,b)=>b[0]-a[0]).slice(0,10).reverse();
        createChart('anosChart','bar',topAnos.map(x=>x[0]),topAnos.map(x=>x[1]),'Qtd.','rgba(59,130,246,0.7)',null,{indexAxis:'y'});
        
        // 5. Distribuição de Notas
        const notasC={}; filmes.forEach(f=>{if(f.nota!=null){const n=Math.round(f.nota);notasC[n]=(notasC[n]||0)+1}});
        const nLabels=Object.keys(notasC).sort((a,b)=>a-b);
        createChart('notasChart','line',nLabels,nLabels.map(l=>notasC[l]),'Qtd.','rgba(236,72,153,0.2)','#ec4899');
        
        // 6. Média
        const medAno={}; filmes.forEach(f=>{if(f.ano&&f.nota){if(!medAno[f.ano])medAno[f.ano]={s:0,c:0};medAno[f.ano].s+=f.nota;medAno[f.ano].c++}});
        const anosM=Object.keys(medAno).sort();
        createChart('mediaNotasAnoChart','line',anosM,anosM.map(a=>(medAno[a].s/medAno[a].c).toFixed(1)),'Média','rgba(249,115,22,0.2)','#f97316');
        
        // 7. Assistidos por Mês
        const mLab=[]; const mapM={}; const hoje=new Date();
        const cap = s => s.charAt(0).toUpperCase()+s.slice(1);
        for(let i=11;i>=0;i--){const d=new Date(hoje.getFullYear(),hoje.getMonth()-i,1);const k=`${cap(d.toLocaleString('pt-BR',{month:'short'}).replace('.',''))}/${d.getFullYear().toString().slice(-2)}`;mLab.push(k);mapM[k]=0;}
        filmes.forEach(f=>{if(f.assistido&&f.dataAssistido){const d=new Date(f.dataAssistido);const k=`${cap(d.toLocaleString('pt-BR',{month:'short'}).replace('.',''))}/${d.getFullYear().toString().slice(-2)}`;if(mapM[k]!==undefined)mapM[k]++}});
        createChart('assistidosMesChart','bar',mLab,mLab.map(k=>mapM[k]),'Assistidos','rgba(168,85,247,0.7)');
    },

    // ==========================================================================
    // 8. PERFIL E CONQUISTAS
    // ==========================================================================
    renderProfile: (profile, filmes) => {
        if (!profile) return;
        UI.els.perfilNome.textContent = profile.nome;
        UI.els.perfilNick.textContent = `@${profile.nickname}`;
        if (profile.membroDesde) UI.els.perfilDesde.textContent = `Membro desde ${new Date(profile.membroDesde.seconds*1000).toLocaleDateString('pt-BR',{year:'numeric',month:'long'})}`;
        UI.els.perfilTotal.textContent = filmes.length;
        UI.els.perfilAssistidos.textContent = filmes.filter(f=>f.assistido).length;
    },

    renderAchievements: (conquistas) => {
        const container = UI.els.conquistasContainer;
        if (!container) return;
        if (!conquistas.length) { container.innerHTML = '<p class="text-muted">Sem conquistas.</p>'; return; }
        // Gera HTML
        container.innerHTML = conquistas.map(c => `
            <div class="conquista-selo ${c.unlocked?'unlocked':''}" title="${c.descricao}">
                <i class="${c.icone}"></i><span>${c.nome}</span>
            </div>`).join('');
    },

    // ==========================================================================
    // 9. MODAIS (Detalhes do Filme)
    // ==========================================================================
    // Mostra detalhes do filme usando SweetAlert2 com HTML customizado
    showMovieDetailModal: (f, onMarkWatched) => {
        const htmlCapa = f.posterUrl && f.posterUrl !== 'N/A' 
            ? `<div class="suggestion-poster me-md-4 mb-3 mb-md-0" style="flex:0 0 140px;max-width:140px;"><img src="${f.posterUrl}" style="width:100%;border-radius:8px;box-shadow:0 4px 15px rgba(0,0,0,0.5);"></div>` : '';
        const genres = f.genero?.length ? f.genero.map(g => `<span class="tag-pill" style="font-size:0.75rem;">${g}</span>`).join('') : '<span class="text-muted small">S/ Gênero</span>';
        
        Swal.fire({
            title: f.titulo, showCloseButton: true, width: htmlCapa ? '800px' : '600px',
            html: `
                <div class="suggestion-layout" style="align-items:flex-start;">${htmlCapa}
                    <div class="suggestion-main-info" style="flex:1;min-width:0;text-align:left;">
                        <p class="mt-3 mb-1"><strong><i class="fas fa-calendar me-2"></i>Ano:</strong> ${f.ano||'N/A'}</p>
                        <p class="mb-1"><strong><i class="fas fa-video me-2"></i>Direção:</strong> ${f.direcao?.join(', ')||'N/A'}</p>
                        <p class="mb-1"><strong><i class="fas fa-users me-2"></i>Atores:</strong> ${f.atores?.join(', ')||'N/A'}</p>
                        <div class="mt-3 pt-3 border-top border-secondary text-muted small">
                            <strong>Status:</strong> ${UI.templates.statusIcon(f.assistido)} ${f.assistido && f.dataAssistido ? `em ${UI.templates.date(f.dataAssistido)}` : ''}
                        </div>
                    </div>
                    <div class="suggestion-side-info ms-md-2">
                        <div class="suggestion-note"><i class="fas fa-star text-warning"></i><span style="font-size:2.5rem;font-weight:700;">${(f.nota||0).toFixed(1)}</span></div>
                        <div class="suggestion-genres mt-2" style="display:flex;flex-wrap:wrap;justify-content:center;gap:0.5rem;">${genres}</div>
                    </div>
                </div>`,
            showConfirmButton: !f.assistido && onMarkWatched, showCancelButton: true,
            confirmButtonText: '<i class="fas fa-check-circle me-1"></i> Marcar assistido', cancelButtonText: 'Fechar',
            customClass: { popup: 'suggestion-swal-popup', confirmButton: 'suggestion-deny-btn', cancelButton: 'suggestion-cancel-btn' }
        }).then(res => { if(res.isConfirmed && onMarkWatched) onMarkWatched(f.id); });
    },

    // Para sugestão aleatória
    showRandomSuggestion: (f, onMark, onRetry) => {
        const htmlCapa = f.posterUrl && f.posterUrl !== 'N/A' 
            ? `<div class="suggestion-poster me-md-4 mb-3 mb-md-0" style="flex:0 0 140px;max-width:140px;"><img src="${f.posterUrl}" style="width:100%;border-radius:8px;box-shadow:0 4px 15px rgba(0,0,0,0.5);"></div>` : '';
        const genres = f.genero?.length ? f.genero.map(g => `<span class="tag-pill" style="font-size:0.75rem;">${g}</span>`).join('') : '<span class="text-muted small">S/ Gênero</span>';

        Swal.fire({
            title: 'Que tal assistir...', showCloseButton: true, width: htmlCapa ? '800px' : '600px',
            html: `
                <div class="suggestion-layout" style="align-items:flex-start;">${htmlCapa}
                    <div class="suggestion-main-info" style="flex:1;min-width:0;text-align:left;">
                        <h2 class="suggestion-title" style="font-size:1.8rem;line-height:1.2;margin-bottom:1rem;">${f.titulo}</h2>
                        <p class="mb-1"><strong><i class="fas fa-calendar me-2"></i>Ano:</strong> ${f.ano||'N/A'}</p>
                        <p class="mb-1"><strong><i class="fas fa-video me-2"></i>Direção:</strong> ${f.direcao?.join(', ')||'N/A'}</p>
                        <p class="mb-1 text-truncate"><strong><i class="fas fa-users me-2"></i>Atores:</strong> ${f.atores?.join(', ')||'N/A'}</p>
                    </div>
                    <div class="suggestion-side-info ms-md-2">
                        <div class="suggestion-note"><i class="fas fa-star text-warning"></i><span style="font-size:2.5rem;font-weight:700;">${(f.nota||0).toFixed(1)}</span></div>
                        <div class="suggestion-genres mt-2" style="display:flex;flex-wrap:wrap;justify-content:center;gap:0.5rem;">${genres}</div>
                    </div>
                </div>`,
            showCancelButton: true, cancelButtonText: 'Sugerir outro',
            showDenyButton: !!onMark, denyButtonText: '<i class="fas fa-check-circle me-1"></i> Marcar assistido', confirmButtonText: 'Ótima ideia!',
            customClass: { popup: 'suggestion-swal-popup', confirmButton: 'suggestion-confirm-btn', cancelButton: 'suggestion-cancel-btn', denyButton: 'suggestion-deny-btn' }
        }).then(res => {
            if (res.isDismissed && res.dismiss === Swal.DismissReason.cancel && onRetry) onRetry();
            else if (res.isDenied && onMark) onMark(f.id);
        });
    },

    // ==========================================================================
    // 10. UTILITÁRIOS
    // ==========================================================================
    
    // Permite arrastar a tabela com o mouse (Drag to Scroll)
    initDragScroll: (el) => {
        if (!el) return;
        let isDown=false, startX, scrollLeft, startY, scrollTop;
        el.addEventListener('mousedown',e=>{isDown=true;el.classList.add('active');startX=e.pageX-el.offsetLeft;scrollLeft=el.scrollLeft;startY=e.pageY-el.offsetTop;scrollTop=el.scrollTop;});
        el.addEventListener('mouseleave',()=>{isDown=false;el.classList.remove('active');});
        el.addEventListener('mouseup',()=>{isDown=false;el.classList.remove('active');});
        el.addEventListener('mousemove',e=>{if(!isDown)return;e.preventDefault();const x=e.pageX-el.offsetLeft;const walkX=(x-startX)*2;el.scrollLeft=scrollLeft-walkX;const y=e.pageY-el.offsetTop;const walkY=(y-startY)*2;el.scrollTop=scrollTop-walkY;});
    }
};