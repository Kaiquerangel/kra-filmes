/* ==========================================================================
   UI.JS - Responsável por toda a manipulação visual (DOM, Gráficos, Alertas)
   ========================================================================== */

const ChartJS = window.Chart; 

export const UI = {
    // ==========================================================================
    // 1. Cache de Elementos do DOM
    // ==========================================================================
    els: {
        body: document.body,
        appContent: document.getElementById('app-content'),
        authContainer: document.getElementById('auth-container'),
        logoutContainer: document.getElementById('logout-container'),
        welcomeMsg: document.getElementById('welcome-message'),
        navLinks: document.querySelectorAll('.app-nav'),
        themeBtn: document.getElementById('theme-toggle'),
        
        // Containers de Lista
        tabelaTodos: document.getElementById('tabela-todos-container'),
        tabelaAssistidos: document.getElementById('tabela-assistidos-container'),
        tabelaNaoAssistidos: document.getElementById('tabela-nao-assistidos-container'),
        
        // Elementos do Formulário
        form: document.getElementById('filme-form'),
        previewImg: document.getElementById('poster-preview-img'),
        previewPlaceholder: document.getElementById('poster-placeholder'),
        generoTagContainer: document.getElementById('genero-tag-container'),
        generoInput: document.getElementById('genero-input'),
        dataAssistidoGroup: document.getElementById('data-assistido-group'),
        
        // Elementos de Estatística
        statTotal: document.getElementById('stat-total-filmes'),
        statMedia: document.getElementById('stat-media-notas'),
        statPctNac: document.getElementById('stat-pct-nacionais'),
        statPctInt: document.getElementById('stat-pct-internacionais'),
        statDecada: document.getElementById('stat-decada-popular'),
        statAtor: document.getElementById('stat-ator-frequente'),
        statMelhor: document.getElementById('stat-melhor-filme'),
        statPior: document.getElementById('stat-pior-filme'),
        
        // Perfil
        perfilNome: document.getElementById('perfil-nome'),
        perfilNick: document.getElementById('perfil-nickname'),
        perfilDesde: document.getElementById('perfil-membro-desde'),
        perfilTotal: document.getElementById('perfil-total-filmes'),
        perfilAssistidos: document.getElementById('perfil-total-assistidos'),
        conquistasContainer: document.getElementById('conquistas-container')
    },

    chartsInstances: {},

    // ==========================================================================
    // 2. Feedback e Alertas
    // ==========================================================================
    
    toast: (title, icon = 'success') => {
        const Toast = Swal.mixin({
            toast: true,
            position: 'top-end',
            showConfirmButton: false,
            timer: 3000,
            timerProgressBar: true,
            didOpen: (toast) => {
                toast.addEventListener('mouseenter', Swal.stopTimer);
                toast.addEventListener('mouseleave', Swal.resumeTimer);
            }
        });
        Toast.fire({ icon, title });
    },

    alert: (title, text, icon = 'info') => {
        return Swal.fire({ title, text, icon });
    },

    confirm: async (title, text, confirmBtnText = 'Sim', cancelBtnText = 'Cancelar') => {
        return Swal.fire({
            title: title,
            text: text,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#3085d6',
            cancelButtonColor: '#d33',
            confirmButtonText: confirmBtnText,
            cancelButtonText: cancelBtnText
        });
    },

    // ==========================================================================
    // 3. Controle de Visibilidade e Autenticação
    // ==========================================================================

    toggleAuthView: (isLoggedIn, userProfile = null) => {
        if (isLoggedIn) {
            UI.els.appContent.style.display = 'block';
            UI.els.logoutContainer.style.display = 'block';
            UI.els.authContainer.style.display = 'none';
            UI.els.navLinks.forEach(link => link.style.display = 'block');
            
            if (userProfile) {
                UI.els.welcomeMsg.textContent = `Olá, ${userProfile.nickname}!`;
                UI.els.welcomeMsg.style.display = 'block';
            }
        } else {
            UI.els.appContent.style.display = 'none';
            UI.els.logoutContainer.style.display = 'none';
            UI.els.authContainer.style.display = 'block';
            UI.els.navLinks.forEach(link => link.style.display = 'none');
            UI.els.welcomeMsg.style.display = 'none';
            UI.els.welcomeMsg.textContent = '';
            
            document.getElementById('login-card').style.display = 'block';
            document.getElementById('register-card').style.display = 'none';
        }
    },

    toggleTheme: () => {
        const isDark = UI.els.body.classList.toggle('dark-mode');
        const icon = isDark ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
        if (UI.els.themeBtn) UI.els.themeBtn.innerHTML = icon;
        return isDark ? 'dark' : 'light';
    },

    setTheme: (theme) => {
        if (theme === 'dark') {
            UI.els.body.classList.add('dark-mode');
            if (UI.els.themeBtn) UI.els.themeBtn.innerHTML = '<i class="fas fa-sun"></i>';
        } else {
            UI.els.body.classList.remove('dark-mode');
            if (UI.els.themeBtn) UI.els.themeBtn.innerHTML = '<i class="fas fa-moon"></i>';
        }
    },

    // ==========================================================================
    // 4. Renderização da Lista de Filmes (Tabela e Grid)
    // ==========================================================================

    renderContent: (filmes, viewType = 'table') => {
        const todos = filmes;
        const assistidos = filmes.filter(f => f.assistido);
        const naoAssistidos = filmes.filter(f => !f.assistido);

        if (viewType === 'table') {
            UI.renderTable(todos, UI.els.tabelaTodos);
            UI.renderTable(assistidos, UI.els.tabelaAssistidos);
            UI.renderTable(naoAssistidos, UI.els.tabelaNaoAssistidos);
        } else {
            UI.renderGrid(todos, UI.els.tabelaTodos);
            UI.renderGrid(assistidos, UI.els.tabelaAssistidos);
            UI.renderGrid(naoAssistidos, UI.els.tabelaNaoAssistidos);
        }

        UI.updateStats(assistidos, todos.length);
    },

    renderTable: (listaFilmes, container) => {
        if (!container) return;
        if (listaFilmes.length === 0) {
            container.innerHTML = '<p class="text-center text-muted pt-3">Nenhum filme encontrado.</p>';
            return;
        }

        const rows = listaFilmes.map((filme, index) => {
            const dataAssistidoFormatada = filme.assistido && filme.dataAssistido 
                ? new Date(filme.dataAssistido.replace(/-/g, '/')).toLocaleDateString('pt-BR') 
                : '<i class="far fa-clock ms-1 text-muted"></i>';

            return `
            <tr data-id="${filme.id}" style="cursor: pointer;">
                <td class="col-num align-middle">${index + 1}</td>
                <td class="col-poster align-middle">
                    ${filme.posterUrl ? `<img src="${filme.posterUrl}" class="poster-thumb" alt="Capa">` : '<div class="poster-thumb d-flex align-items-center justify-content-center text-muted"><i class="fas fa-film"></i></div>'}
                </td>
                <td class="col-titulo align-middle fw-bold">${filme.titulo || 'N/A'}</td>
                <td class="col-nota align-middle">⭐ ${(filme.nota || 0).toFixed(1)}</td>
                <td class="col-ano align-middle">${filme.ano || '-'}</td>
                
                <td class="col-direcao align-middle text-truncate" style="max-width: 150px;">${filme.direcao?.join(', ') || ''}</td>
                <td class="col-atores align-middle text-truncate" style="max-width: 150px;">${filme.atores?.join(', ') || ''}</td>
                <td class="col-genero align-middle">${filme.genero?.join(', ') || ''}</td>
                
                <td class="col-assistido align-middle text-center">
                    ${filme.assistido 
                        ? '<i class="fas fa-check-circle text-success" title="Assistido"></i>' 
                        : '<i class="fas fa-clock text-warning" title="Para Assistir"></i>'} 
                </td>
                
                <td class="col-acoes align-middle text-end">
                    <div class="d-flex align-items-center justify-content-end gap-2">
                        
                        <button class="btn btn-sm btn-link text-decoration-none text-muted btn-detalhes" type="button" data-bs-toggle="collapse" data-bs-target="#detalhes-${filme.id}" aria-expanded="false" title="Ver detalhes">
                            <i class="fas fa-chevron-down"></i>
                        </button>

                        <div class="dropdown">
                            <button class="btn btn-sm btn-outline-secondary border-0" type="button" data-bs-toggle="dropdown">
                                <i class="fas fa-ellipsis-v"></i>
                            </button>
                            <ul class="dropdown-menu dropdown-menu-end dropdown-menu-dark shadow">
                                <li><button class="dropdown-item btn-edit"><i class="fas fa-pen me-2 text-info"></i> Editar</button></li>
                                <li><hr class="dropdown-divider"></li>
                                <li><button class="dropdown-item btn-delete text-danger"><i class="fas fa-trash me-2"></i> Excluir</button></li>
                            </ul>
                        </div>
                    </div>
                </td>
            </tr>
            
            <tr class="linha-detalhes">
                <td colspan="12" class="p-0 border-0">
                    <div class="collapse" id="detalhes-${filme.id}">
                        <div class="p-3 bg-dark bg-opacity-25 border-bottom border-secondary text-muted small">
                            <div class="row">
                                <div class="col-md-6 mb-2"><strong class="text-light"><i class="fas fa-globe me-2"></i>Origem:</strong> ${filme.origem || '-'}</div>
                                <div class="col-md-6 mb-2"><strong class="text-light"><i class="fas fa-calendar-day me-2"></i>Data Assistido:</strong> ${dataAssistidoFormatada}</div>
                            </div>
                        </div>
                    </div>
                </td>
            </tr>`;
        }).join('');

        container.innerHTML = `
            <table class="table table-dark table-hover table-sm tabela-filmes mb-0">
                <thead><tr>
                    <th class="col-num">#</th>
                    <th style="width: 50px;">Capa</th>
                    <th class="col-titulo sortable" data-sort="titulo">Título <i class="fas fa-sort"></i></th>
                    <th class="sortable" data-sort="nota">Nota <i class="fas fa-sort"></i></th>
                    <th class="sortable" data-sort="ano">Ano <i class="fas fa-sort"></i></th>
                    <th>Direção</th>
                    <th>Atores</th>
                    <th>Gênero</th>
                    <th class="text-center">Status</th>
                    <th class="text-end" style="width: 100px;">Ações</th>
                </tr></thead>
                <tbody>${rows}</tbody>
            </table>`;
            
        UI.initDragScroll(container);
    },

    renderGrid: (listaFilmes, container) => {
        if (!container) return;
        if (listaFilmes.length === 0) {
            container.innerHTML = '<p class="text-center text-muted pt-3">Nenhum filme encontrado.</p>';
            return;
        }

        const cards = listaFilmes.map(filme => `
            <div class="movie-card" data-id="${filme.id}">
                <div class="position-relative" style="height: 100%;">
                    ${filme.posterUrl 
                        ? `<img src="${filme.posterUrl}" class="movie-poster-img" alt="${filme.titulo}">` 
                        : `<div class="movie-poster-img d-flex align-items-center justify-content-center bg-dark text-muted"><i class="fas fa-film fa-3x"></i></div>`
                    }
                    ${filme.assistido ? '<div class="movie-watched-badge"><i class="fas fa-check"></i></div>' : ''}
                    
                    <div class="movie-info-overlay">
                        <h5 class="movie-card-title">${filme.titulo}</h5>
                        <div class="movie-card-meta">
                            <span class="movie-card-rating"><i class="fas fa-star text-warning"></i> ${(filme.nota || 0).toFixed(1)}</span>
                            <span>${filme.ano || ''}</span>
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
    // 5. Formulário e Tags
    // ==========================================================================

    // Função atualizada para lidar com erro de carregamento da imagem
    updatePreviewPoster: (url) => {
        const img = UI.els.previewImg;
        const placeholder = UI.els.previewPlaceholder;

        // 1. RESET TOTAL: Limpa eventos e o marcador de tentativa anterior
        img.onload = null;
        img.onerror = null;
        img.removeAttribute('data-tried-original'); // Remove a "bandeira"

        if (url && url !== 'N/A') {
            const hdUrl = url.replace(/_SX[0-9]+.*\./, ".");
            
            // 2. Tenta carregar a versão HD primeiro
            img.src = hdUrl;
            
            // Sucesso: Mostra a imagem
            img.onload = () => {
                img.style.display = 'block';
                placeholder.style.display = 'none';
            };
            
            // Erro: Decide o que fazer
            img.onerror = function() {
                // Verifica se já tentamos a original olhando o marcador
                if (!this.hasAttribute('data-tried-original')) {
                    console.warn('HD falhou. Tentando qualidade original...');
                    
                    // Marca que vamos tentar a original agora
                    this.setAttribute('data-tried-original', 'true');
                    this.src = url; // Tenta a URL original
                } else {
                    // Se já tinha o marcador e deu erro de novo, desistimos
                    console.warn('Original também falhou. Exibindo placeholder.');
                    this.style.display = 'none';
                    placeholder.style.display = 'block';
                }
            };
        } else {
            // Sem URL na API
            img.src = '';
            img.style.display = 'none';
            placeholder.style.display = 'block';
        }
    },

    toggleDataAssistido: (show) => {
        UI.els.dataAssistidoGroup.style.display = show ? 'block' : 'none';
        const input = UI.els.dataAssistidoGroup.querySelector('input');
        if (show) input.setAttribute('required', 'required');
        else {
            input.removeAttribute('required');
            input.value = '';
        }
    },

    renderGenerosTags: (generos, onRemove) => {
        if (!UI.els.generoTagContainer) return;
        UI.els.generoTagContainer.querySelectorAll('.tag-pill').forEach(el => el.remove());
        generos.slice().reverse().forEach(label => {
            const tagEl = document.createElement('span');
            tagEl.className = 'tag-pill';
            tagEl.innerHTML = `<span>${label}</span><button class="tag-remove-btn">&times;</button>`;
            tagEl.querySelector('button').addEventListener('click', () => onRemove(label));
            UI.els.generoTagContainer.prepend(tagEl);
        });
    },

    clearForm: () => {
        UI.els.form.reset();
        UI.els.form.classList.remove('was-validated');
        UI.updatePreviewPoster('');
        UI.toggleDataAssistido(false);
        UI.els.generoTagContainer.querySelectorAll('.tag-pill').forEach(el => el.remove());
    },

    fillForm: (filme, generosCallback) => {
        document.getElementById('titulo').value = filme.titulo;
        document.getElementById('ano').value = filme.ano;
        document.getElementById('nota').value = filme.nota;
        document.getElementById('direcao').value = filme.direcao?.join(', ') || '';
        document.getElementById('atores').value = filme.atores?.join(', ') || '';
        document.getElementById('origem').value = filme.origem || "";
        
        const selectAssistido = document.getElementById('assistido');
        selectAssistido.value = filme.assistido ? 'sim' : 'nao';
        UI.toggleDataAssistido(filme.assistido);
        if (filme.assistido) document.getElementById('data-assistido').value = filme.dataAssistido;

        UI.updatePreviewPoster(filme.posterUrl);
        if (filme.genero && generosCallback) generosCallback(filme.genero);
    },

    // ==========================================================================
    // 6. Estatísticas, Rankings e Gráficos
    // ==========================================================================

    updateStats: (filmesAssistidos, totalCadastrados) => {
        UI.els.statTotal.textContent = filmesAssistidos.length;
        const media = filmesAssistidos.length ? (filmesAssistidos.reduce((acc, f) => acc + (f.nota || 0), 0) / filmesAssistidos.length).toFixed(1) : '0.0';
        UI.els.statMedia.textContent = media;

        const nacionais = filmesAssistidos.filter(f => f.origem === 'Nacional').length;
        const total = filmesAssistidos.length || 1;
        UI.els.statPctNac.textContent = `${Math.round((nacionais / total) * 100)}%`;
        UI.els.statPctInt.textContent = `${Math.round(((filmesAssistidos.length - nacionais) / total) * 100)}%`;

        const countFrequency = (list, key) => {
            const counts = {};
            list.forEach(f => {
                const items = Array.isArray(f[key]) ? f[key] : [f[key]];
                items.forEach(i => { if(i) counts[i] = (counts[i] || 0) + 1; });
            });
            return Object.entries(counts).sort((a,b) => b[1] - a[1]);
        };

        const topAtores = countFrequency(filmesAssistidos, 'atores');
        UI.els.statAtor.textContent = topAtores.length ? topAtores[0][0] : '-';

        const decadas = {};
        filmesAssistidos.forEach(f => { if(f.ano) { const d = Math.floor(f.ano/10)*10; decadas[d] = (decadas[d]||0)+1; }});
        const topDecada = Object.entries(decadas).sort((a,b) => b[1]-a[1]);
        UI.els.statDecada.textContent = topDecada.length ? `Anos ${topDecada[0][0]}` : '-';

        const melhor = filmesAssistidos.reduce((prev, curr) => (prev.nota || 0) > (curr.nota || 0) ? prev : curr, {});
        UI.els.statMelhor.textContent = melhor.titulo || '-';

        const pior = filmesAssistidos.reduce((prev, curr) => (prev.nota || 10) < (curr.nota || 10) ? prev : curr, {});
        UI.els.statPior.textContent = pior.titulo || '-';

        UI.renderRankings('ranking-generos-bars', countFrequency(filmesAssistidos, 'genero').slice(0, 12));
        UI.renderRankings('ranking-atores-bars', topAtores.slice(0, 12));
        UI.renderRankings('ranking-diretores-bars', countFrequency(filmesAssistidos, 'direcao').slice(0, 12));
        
        const anosData = Object.entries(filmesAssistidos.reduce((acc, f) => { if(f.ano) acc[f.ano] = (acc[f.ano]||0)+1; return acc; }, {})).sort((a,b) => b[1]-a[1]).slice(0,12);
        UI.renderRankings('ranking-anos-bars', anosData);

        UI.renderCharts(filmesAssistidos);
    },

    renderRankings: (elementId, data) => {
        const container = document.getElementById(elementId);
        if (!container) return;
        container.innerHTML = '';
        if (!data.length) { container.innerHTML = '<p class="text-muted small">N/A</p>'; return; }
        
        const max = Math.max(...data.map(d => d[1]));
        
        data.forEach(([label, count]) => {
            const pct = (count / max) * 100;
            container.innerHTML += `
            <div class="ranking-bar-item mb-2">
                <span class="ranking-bar-label">${label}</span>
                <div class="ranking-bar-container">
                    <div class="ranking-bar" style="width: ${pct}%" title="${label}: ${count}"></div>
                </div>
                <span class="ranking-bar-count">${count}</span>
            </div>`;
        });
    },

    // ==========================================================================
    // CORREÇÃO DOS GRÁFICOS (CORES E BORDAS)
    // ==========================================================================
    renderCharts: (filmes) => {
        if (!ChartJS) return;
        const isDark = UI.els.body.classList.contains('dark-mode');
        
        const colorText = isDark ? 'rgba(226, 232, 240, 0.8)' : 'rgba(0, 0, 0, 0.7)';
        const colorGrid = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';
        
        ChartJS.defaults.color = colorText;
        ChartJS.defaults.borderColor = colorGrid;

        const createChart = (id, type, labels, data, labelStr, bgColors, borderColor, options = {}, borderWidth = 0) => {
            const ctx = document.getElementById(id)?.getContext('2d');
            if (!ctx) return;
            if (UI.chartsInstances[id]) UI.chartsInstances[id].destroy();

            UI.chartsInstances[id] = new ChartJS(ctx, {
                type: type,
                data: {
                    labels: labels,
                    datasets: [{
                        label: labelStr,
                        data: data,
                        backgroundColor: bgColors,
                        borderColor: borderColor || (Array.isArray(bgColors) ? bgColors[0] : bgColors),
                        borderWidth: borderWidth,
                        fill: true,
                        tension: 0.3
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { 
                        legend: { 
                            display: true,
                            labels: { color: colorText, boxWidth: 12 }
                        } 
                    },
                    scales: options.scales || {},
                    indexAxis: options.indexAxis || 'x'
                }
            });
        };

        const countBy = (key) => {
            const c = {};
            filmes.forEach(f => {
                const items = Array.isArray(f[key]) ? f[key] : [f[key]];
                items.forEach(i => { if(i) c[i] = (c[i]||0)+1; });
            });
            return Object.entries(c).sort((a,b)=>b[1]-a[1]).slice(0,5);
        };

        // 1. Gêneros (Flat - Sem borda)
        const generos = countBy('genero');
        createChart('generosChart', 'doughnut', generos.map(d=>d[0]), generos.map(d=>d[1]), 'Filmes', ['#a855f7', '#3b82f6', '#ec4899', '#f97316', '#14b8a6'], null, {}, 0);

        // 2. Diretores (Flat)
        const diretores = countBy('direcao');
        createChart('diretoresChart', 'bar', diretores.map(d=>d[0]), diretores.map(d=>d[1]), 'Qtd. de Filmes', 'rgba(236, 72, 153, 0.7)', null, { indexAxis: 'y' }, 0);

        // 3. Origem (Flat)
        const origemC = {}; filmes.forEach(f => { if(f.origem) origemC[f.origem] = (origemC[f.origem]||0)+1; });
        createChart('origemChart', 'pie', Object.keys(origemC), Object.values(origemC), 'Origem', ['#3b82f6', '#14b8a6'], null, {}, 0);

        // 4. Anos (Flat)
        const anosC = {}; filmes.forEach(f => { if(f.ano) anosC[f.ano] = (anosC[f.ano]||0)+1; });
        const topAnos = Object.entries(anosC).sort((a,b)=>b[0]-a[0]).slice(0,10).reverse();
        createChart('anosChart', 'bar', topAnos.map(d=>d[0]), topAnos.map(d=>d[1]), 'Qtd. de Filmes', 'rgba(59, 130, 246, 0.7)', null, { indexAxis: 'y' }, 0);

        // 5. Distribuição de Notas (Line - Borda 2px, Cor Rosa)
        const notasC = {}; filmes.forEach(f => { if(f.nota!=null) { const n=Math.round(f.nota); notasC[n]=(notasC[n]||0)+1; }});
        const notasLabels = Object.keys(notasC).sort((a,b)=>a-b);
        createChart('notasChart', 'line', notasLabels, notasLabels.map(l=>notasC[l]), 'Distribuição', 'rgba(236, 72, 153, 0.2)', '#ec4899', {
            scales: {
                y: { title: { display: true, text: 'Quantidade de Filmes', color: colorText } },
                x: { title: { display: true, text: 'Nota', color: colorText } }
            }
        }, 2);

        // 6. Média Notas por Ano (Line - Borda 2px, Cor Laranja)
        const mediaAno = {};
        filmes.forEach(f => {
            if(f.ano && f.nota) {
                if(!mediaAno[f.ano]) mediaAno[f.ano] = {soma:0, count:0};
                mediaAno[f.ano].soma += f.nota; mediaAno[f.ano].count++;
            }
        });
        const anosMedia = Object.keys(mediaAno).sort();
        createChart('mediaNotasAnoChart', 'line', anosMedia, anosMedia.map(a => (mediaAno[a].soma/mediaAno[a].count).toFixed(1)), 'Média de Notas', 'rgba(249, 115, 22, 0.2)', '#f97316', {}, 2);

        // 7. Assistidos por Mês (Bar - Flat)
        const mesesLabel = []; const mesesData = [];
        const hoje = new Date();
        const mapMes = {};
        const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);
        
        for(let i=11; i>=0; i--) {
            const d = new Date(hoje.getFullYear(), hoje.getMonth()-i, 1);
            const mesStr = d.toLocaleString('pt-BR',{month:'short'}).replace('.',''); 
            const k = `${capitalize(mesStr)}/${d.getFullYear().toString().slice(-2)}`;
            mesesLabel.push(k); mapMes[k] = 0;
        }
        filmes.forEach(f => {
            if(f.assistido && f.dataAssistido) {
                const d = new Date(f.dataAssistido);
                const mesStr = d.toLocaleString('pt-BR',{month:'short'}).replace('.','');
                const k = `${capitalize(mesStr)}/${d.getFullYear().toString().slice(-2)}`;
                if(mapMes[k] !== undefined) mapMes[k]++;
            }
        });
        createChart('assistidosMesChart', 'bar', mesesLabel, mesesLabel.map(k=>mapMes[k]), 'Qtd. de Filmes Assistidos', 'rgba(168, 85, 247, 0.7)', null, {}, 0);
    },

    // ==========================================================================
    // 7. Perfil e Conquistas
    // ==========================================================================

    renderProfile: (profile, filmes) => {
        if (!profile) return;
        UI.els.perfilNome.textContent = profile.nome;
        UI.els.perfilNick.textContent = `@${profile.nickname}`;
        if (profile.membroDesde) {
            UI.els.perfilDesde.textContent = `Membro desde ${new Date(profile.membroDesde.seconds * 1000).toLocaleDateString('pt-BR', { year: 'numeric', month: 'long' })}`;
        }
        UI.els.perfilTotal.textContent = filmes.length;
        UI.els.perfilAssistidos.textContent = filmes.filter(f => f.assistido).length;
    },

    renderAchievements: (conquistas) => {
        const container = UI.els.conquistasContainer;
        if (!container) return;
        container.innerHTML = '';
        
        if (!conquistas.length) {
            container.innerHTML = '<p class="text-muted">Nenhuma conquista ainda.</p>';
            return;
        }

        conquistas.forEach(c => {
            container.innerHTML += `
                <div class="conquista-selo ${c.unlocked ? 'unlocked' : ''}" title="${c.descricao}">
                    <i class="${c.icone}"></i>
                    <span>${c.nome}</span>
                </div>
            `;
        });
    },

    // ==========================================================================
    // 8. Modais (COM LAYOUT RESTAURADO)
    // ==========================================================================

    showMovieDetailModal: (filme, onMarkWatched) => {
        const temCapa = filme.posterUrl && filme.posterUrl !== 'N/A';
        const htmlCapa = temCapa ? `
            <div class="suggestion-poster me-md-4 mb-3 mb-md-0" style="flex: 0 0 140px; max-width: 140px;">
                <img src="${filme.posterUrl}" style="width:100%; border-radius:8px; box-shadow: 0 4px 15px rgba(0,0,0,0.5);">
            </div>
        ` : '';

        let statusHtml;
        if (filme.assistido) {
            const dataFmt = filme.dataAssistido 
                ? new Date(filme.dataAssistido.replace(/-/g, '/')).toLocaleDateString('pt-BR') 
                : 'Data desconhecida';
            statusHtml = `<span class="text-success"><i class="fas fa-check-circle"></i> Assistido em ${dataFmt}</span>`;
        } else {
            statusHtml = '<span class="text-warning"><i class="fas fa-clock"></i> Para Assistir</span>';
        }

        const genresHtml = filme.genero && filme.genero.length 
            ? filme.genero.map(g => `<span class="tag-pill" style="font-size: 0.75rem;">${g}</span>`).join('') 
            : '<span class="text-muted small">S/ Gênero</span>';

        Swal.fire({
            title: filme.titulo,
            showCloseButton: true,
            width: temCapa ? '800px' : '600px',
            html: `
                <div class="suggestion-layout" style="align-items: flex-start;">
                    ${htmlCapa}
                    
                    <div class="suggestion-main-info" style="flex: 1; min-width: 0; text-align: left;">
                        <p class="mt-3 mb-1"><strong><i class="fas fa-calendar me-2"></i>Ano:</strong> ${filme.ano || 'N/A'}</p>
                        <p class="mb-1"><strong><i class="fas fa-video me-2"></i>Direção:</strong> ${filme.direcao?.join(', ') || 'N/A'}</p>
                        <p class="mb-1"><strong><i class="fas fa-users me-2"></i>Atores:</strong> ${filme.atores?.join(', ') || 'N/A'}</p>
                        <p class="mb-1"><strong>Origem:</strong> ${filme.origem || '-'}</p>
                        
                        <div class="mt-3 pt-3 border-top border-secondary text-muted small">
                            <strong>Status:</strong> ${statusHtml}
                        </div>
                    </div>

                    <div class="suggestion-side-info ms-md-2">
                        <div class="suggestion-note">
                            <i class="fas fa-star" style="color: #FFD700; margin-bottom: 5px;"></i>
                            <span style="font-size: 2.5rem; font-weight: 700;">${(filme.nota || 0).toFixed(1)}</span>
                        </div>
                        <div class="suggestion-genres mt-2" style="display: flex; flex-wrap: wrap; justify-content: center; gap: 0.5rem;">
                            ${genresHtml}
                        </div>
                    </div>
                </div>
            `,
            showConfirmButton: !filme.assistido,
            showCancelButton: true,
            confirmButtonText: '<i class="fas fa-check-circle me-1"></i> Marcar como assistido',
            cancelButtonText: 'Fechar',
            customClass: { 
                popup: 'suggestion-swal-popup',
                confirmButton: 'suggestion-deny-btn',
                cancelButton: 'suggestion-cancel-btn'
            }
        }).then(async (result) => {
            if (result.isConfirmed && onMarkWatched) onMarkWatched(filme.id);
        });
    },

    showRandomSuggestion: (filme, onMarkWatched, onTryAgain) => {
        const temCapa = filme.posterUrl && filme.posterUrl !== 'N/A';
        const htmlCapa = temCapa ? `<div class="suggestion-poster me-md-4 mb-3 mb-md-0" style="flex: 0 0 140px; max-width: 140px;"><img src="${filme.posterUrl}" style="width:100%; border-radius:8px; box-shadow: 0 4px 15px rgba(0,0,0,0.5);"></div>` : '';

        const genresHtml = filme.genero && filme.genero.length 
            ? filme.genero.map(g => `<span class="tag-pill" style="font-size: 0.75rem;">${g}</span>`).join('') 
            : '<span class="text-muted small">S/ Gênero</span>';

        Swal.fire({
            title: 'Que tal assistir...',
            showCloseButton: true,
            width: temCapa ? '800px' : '600px',
            html: `
                <div class="suggestion-layout" style="align-items: flex-start;">
                    ${htmlCapa}
                    
                    <div class="suggestion-main-info" style="flex: 1; min-width: 0; text-align: left;">
                        <h2 class="suggestion-title" style="font-size: 1.8rem; line-height: 1.2; margin-bottom: 1rem;">${filme.titulo}</h2>
                        <p class="mb-1"><strong><i class="fas fa-calendar me-2"></i>Ano:</strong> ${filme.ano || 'N/A'}</p>
                        <p class="mb-1"><strong><i class="fas fa-video me-2"></i>Direção:</strong> ${filme.direcao?.join(', ') || 'N/A'}</p>
                        <p class="mb-1 text-truncate"><strong><i class="fas fa-users me-2"></i>Atores:</strong> ${filme.atores?.join(', ') || 'N/A'}</p>
                    </div>

                    <div class="suggestion-side-info ms-md-2">
                        <div class="suggestion-note">
                            <i class="fas fa-star" style="color: #FFD700;"></i>
                            <span style="font-size: 2.5rem; font-weight: 700;">${(filme.nota || 0).toFixed(1)}</span>
                        </div>
                        <div class="suggestion-genres mt-2" style="display: flex; flex-wrap: wrap; justify-content: center; gap: 0.5rem;">
                            ${genresHtml}
                        </div>
                    </div>
                </div>
            `,
            showCancelButton: true,
            cancelButtonText: 'Sugerir outro',
            showDenyButton: true,
            denyButtonText: '<i class="fas fa-check-circle me-1"></i> Marcar assistido',
            confirmButtonText: 'Ótima ideia!',
            customClass: { 
                popup: 'suggestion-swal-popup',
                confirmButton: 'suggestion-confirm-btn',
                cancelButton: 'suggestion-cancel-btn',
                denyButton: 'suggestion-deny-btn'
            }
        }).then((res) => {
            if (res.isDismissed && res.dismiss === Swal.DismissReason.cancel && onTryAgain) onTryAgain();
            else if (res.isDenied && onMarkWatched) onMarkWatched(filme.id);
        });
    },

    // ==========================================================================
    // 9. Utilitários
    // ==========================================================================
    initDragScroll: (element) => {
        if (!element) return;
        let isDown = false;
        let startX, scrollLeft;
        let startY, scrollTop;

        element.addEventListener('mousedown', (e) => {
            isDown = true;
            element.classList.add('active');
            startX = e.pageX - element.offsetLeft;
            scrollLeft = element.scrollLeft;
            startY = e.pageY - element.offsetTop;
            scrollTop = element.scrollTop;
        });

        element.addEventListener('mouseleave', () => { isDown = false; element.classList.remove('active'); });
        element.addEventListener('mouseup', () => { isDown = false; element.classList.remove('active'); });

        element.addEventListener('mousemove', (e) => {
            if (!isDown) return;
            e.preventDefault();
            const x = e.pageX - element.offsetLeft;
            const walkX = (x - startX) * 2;
            element.scrollLeft = scrollLeft - walkX;
            const y = e.pageY - element.offsetTop;
            const walkY = (y - startY) * 2;
            element.scrollTop = scrollTop - walkY;
        });
    }
};