const ChartJS = window.Chart; 

export const UI = {
    els: {
        body: document.body,
        appContent: document.getElementById('app-content'),
        authContainer: document.getElementById('auth-container'),
        logoutContainer: document.getElementById('logout-container'),
        welcomeMsg: document.getElementById('welcome-message'),
        navLinks: document.querySelectorAll('.app-nav'),
        themeBtn: document.getElementById('theme-toggle'),
        tabelaTodos: document.getElementById('tabela-todos-container'),
        tabelaAssistidos: document.getElementById('tabela-assistidos-container'),
        tabelaNaoAssistidos: document.getElementById('tabela-nao-assistidos-container'),
        form: document.getElementById('filme-form'),
        previewImg: document.getElementById('poster-preview-img'),
        previewPlaceholder: document.getElementById('poster-placeholder'),
        generoTagContainer: document.getElementById('genero-tag-container'),
        generoInput: document.getElementById('genero-input'),
        tagsTagContainer: document.getElementById('tags-tag-container'),
        tagsInput: document.getElementById('tags-input'),
        dataAssistidoGroup: document.getElementById('data-assistido-group'),
        statTotal: document.getElementById('stat-total-filmes'),
        statMedia: document.getElementById('stat-media-notas'),
        statPctNac: document.getElementById('stat-pct-nacionais'),
        statPctInt: document.getElementById('stat-pct-internacionais'),
        statDecada: document.getElementById('stat-decada-popular'),
        statAtor: document.getElementById('stat-ator-frequente'),
        statMelhor: document.getElementById('stat-melhor-filme'),
        statPior: document.getElementById('stat-pior-filme'),
        perfilNome: document.getElementById('perfil-nome'),
        perfilNick: document.getElementById('perfil-nickname'),
        perfilDesde: document.getElementById('perfil-membro-desde'),
        perfilTotal: document.getElementById('perfil-total-filmes'),
        perfilAssistidos: document.getElementById('perfil-total-assistidos'),
        conquistasContainer: document.getElementById('conquistas-container')
    },

    chartsInstances: {}, 

    templates: {
        poster: (url, cssClass = 'poster-thumb', alt = 'Capa') => {
            if (url && url !== 'N/A') {
                let src = url;
                if (cssClass === 'poster-thumb' && url.includes('amazon.com')) {
                    src = url.replace(/(\.[a-z]+)$/i, "._V1_SX100$1");
                }
                const sizeAttr = cssClass === 'poster-thumb' ? 'width="40" height="60"' : '';

                return `
                    <img src="${src}" ${sizeAttr} loading="lazy" decoding="async" class="${cssClass}" alt="${alt}" 
                         onerror="this.style.display='none'; this.nextElementSibling.style.display='flex'">
                    <div class="${cssClass} d-flex align-items-center justify-content-center bg-dark text-muted" 
                         style="display:none !important;"><i class="fas fa-film ${cssClass === 'movie-poster-img' ? 'fa-3x' : ''}"></i></div>
                `;
            }
            return `<div class="${cssClass} d-flex align-items-center justify-content-center bg-dark text-muted"><i class="fas fa-film ${cssClass === 'movie-poster-img' ? 'fa-3x' : ''}"></i></div>`;
        },

        date: (dateString) => {
            if (!dateString) return '<i class="far fa-clock ms-1 text-muted"></i>';
            return new Date(dateString.replace(/-/g, '/')).toLocaleDateString('pt-BR');
        },

        statusIcon: (assistido) => {
            return assistido 
                ? '<i class="fas fa-check-circle text-success" title="Assistido"></i>' 
                : '<i class="fas fa-clock text-warning" title="Para Assistir"></i>';
        }
    },

    toast: (title, icon = 'success') => {
        const Toast = Swal.mixin({
            toast: true, position: 'top-end', showConfirmButton: false, timer: 3000, timerProgressBar: true,
            didOpen: (t) => { t.addEventListener('mouseenter', Swal.stopTimer); t.addEventListener('mouseleave', Swal.resumeTimer); }
        });
        Toast.fire({ icon, title });
    },

    alert: (title, text, icon = 'info') => Swal.fire({ title, text, icon }),

    confirm: (title, text, confirmBtnText = 'Sim', cancelBtnText = 'Cancelar') => {
        return Swal.fire({
            title, text, icon: 'warning', showCancelButton: true,
            confirmButtonColor: '#3085d6', cancelButtonColor: '#d33',
            confirmButtonText: confirmBtnText, cancelButtonText: cancelBtnText
        });
    },

    toggleAuthView: (isLoggedIn, userProfile = null) => {
        const { appContent, logoutContainer, authContainer, navLinks, welcomeMsg } = UI.els;
        
        appContent.style.display = isLoggedIn ? 'block' : 'none';
        logoutContainer.style.display = isLoggedIn ? 'block' : 'none';
        authContainer.style.display = isLoggedIn ? 'none' : 'block';
        navLinks.forEach(link => link.style.display = isLoggedIn ? 'block' : 'none');

        if (isLoggedIn && userProfile) {
            welcomeMsg.textContent = `Olá, ${userProfile.nickname}!`;
            welcomeMsg.style.display = 'block';
        } else {
            welcomeMsg.style.display = 'none';
            const lCard = document.getElementById('login-card');
            const rCard = document.getElementById('register-card');
            if(lCard) lCard.style.display = 'block';
            if(rCard) rCard.style.display = 'none';
        }
    },

    toggleTheme: () => {
        const isDark = UI.els.body.classList.toggle('dark-mode');
        UI.els.themeBtn.innerHTML = isDark ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
        return isDark ? 'dark' : 'light';
    },

    setTheme: (theme) => {
        const isDark = theme === 'dark';
        if (isDark) UI.els.body.classList.add('dark-mode');
        else UI.els.body.classList.remove('dark-mode');
        UI.els.themeBtn.innerHTML = isDark ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
    },

    enableReadOnlyMode: (profile) => {
        UI.els.body.classList.add('read-only');
        if (UI.els.authContainer) UI.els.authContainer.style.display = 'none';
        if (UI.els.appContent) UI.els.appContent.style.display = 'block';
        
        UI.els.navLinks.forEach(link => {
            const href = link.querySelector('a')?.getAttribute('href');
            if (href === '#cadastro-section' || link.querySelector('a')?.id === 'nav-sugerir-btn') {
                link.style.display = 'none';
            } else {
                link.style.display = 'block';
            }
        });

        if (UI.els.welcomeMsg && profile) {
            UI.els.welcomeMsg.textContent = `Visualizando perfil de @${profile.nickname}`;
            UI.els.welcomeMsg.style.display = 'block';
        }
        
        if (UI.els.logoutContainer) {
            UI.els.logoutContainer.innerHTML = `<a href="?" class="btn btn-primary btn-sm"><i class="fas fa-home me-1"></i> Criar meu Perfil</a>`;
            UI.els.logoutContainer.style.display = 'block';
        }

        const banner = document.getElementById('visitor-banner');
        if (banner && profile) {
            banner.textContent = `Modo Visitante: Você está visualizando a lista de @${profile.nickname}`;
            banner.style.display = 'block';
        }
    },

    // NOVA FUNÇÃO DE SKELETON SCREEN
    renderSkeletons: (container, viewType = 'table', qtd = 12) => {
        if (!container) return;
        
        if (viewType === 'grid') {
            const skeletons = Array(qtd).fill(`
                <div class="movie-card skeleton">
                    <div class="skeleton-card-grid"></div>
                </div>
            `).join('');
            container.innerHTML = `<div class="movies-grid">${skeletons}</div>`;
        } else {
            const rows = Array(qtd).fill(`
                <tr>
                    <td colspan="10" class="p-3">
                        <div class="skeleton" style="height: 25px; width: 100%;"></div>
                    </td>
                </tr>
            `).join('');
            container.innerHTML = `<table class="table table-dark tabela-filmes"><tbody>${rows}</tbody></table>`;
        }
    },

    renderContent: (filmesVisiveis, listaCompleta, viewType = 'table', append = false) => {
        const assistidosVisiveis = filmesVisiveis.filter(f => f.assistido);
        const naoAssistidosVisiveis = filmesVisiveis.filter(f => !f.assistido);
        const renderFn = viewType === 'table' ? UI.renderTable : UI.renderGrid;
        
        renderFn(filmesVisiveis, UI.els.tabelaTodos, false);
        renderFn(assistidosVisiveis, UI.els.tabelaAssistidos, false);
        renderFn(naoAssistidosVisiveis, UI.els.tabelaNaoAssistidos, false);
        
        if (!append) {
            const assistidosTotal = listaCompleta.filter(f => f.assistido);
            requestAnimationFrame(() => UI.updateStats(assistidosTotal, listaCompleta.length));
        }
    },

    renderTable: (lista, container, append = false) => {
        if (!container) return;
        if (!append) container.innerHTML = '';
        if (!lista.length && !append) { container.innerHTML = '<p class="text-center text-muted pt-3">Nenhum filme encontrado.</p>'; return; }

        let numeroInicial = 1;
        if (append) {
            const linhas = container.querySelectorAll('tbody tr[data-id]');
            numeroInicial = linhas.length + 1;
        }

        const rows = lista.map((f, i) => {
            const tagsHtml = f.tags?.length 
                ? `<div class="mt-1">${f.tags.map(t => `<span class="badge border border-secondary text-secondary me-1 fw-normal"><i class="fas fa-hashtag me-1"></i>${t}</span>`).join('')}</div>` 
                : '';

            return `
            <tr data-id="${f.id}" style="cursor: pointer;">
                <td class="col-num align-middle">${numeroInicial + i}</td>
                <td class="col-poster align-middle">${UI.templates.poster(f.posterUrl, 'poster-thumb')}</td>
                <td class="col-titulo align-middle fw-bold text-truncate" style="max-width: 250px;">${f.titulo || 'N/A'}</td>
                <td class="col-nota align-middle">⭐ ${(f.nota || 0).toFixed(1)}</td>
                <td class="col-ano align-middle">${f.ano || '-'}</td>
                <td class="col-direcao align-middle text-truncate" style="max-width: 150px;">${f.direcao?.join(', ') || ''}</td>
                <td class="col-atores align-middle text-truncate" style="max-width: 200px;">${f.atores?.join(', ') || ''}</td>
                <td class="col-genero align-middle">
                    ${f.genero?.join(', ') || ''}
                    ${tagsHtml}
                </td>
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
                    <div class="p-3 bg-dark bg-opacity-25 border-bottom border-secondary text-white-50 small">
                    <div class="row">
                    <div class="col-md-6 mb-2"><strong class="text-white"><i class="fas fa-globe me-2"></i>Origem:</strong> ${f.origem || '-'}</div>
                    <div class="col-md-6 mb-2"><strong class="text-white"><i class="fas fa-calendar-day me-2"></i>Data Assistido:</strong> ${f.assistido ? UI.templates.date(f.dataAssistido) : '-'}</div>
                        </div>
                    </div>
                </div>
            </td></tr>
        `}).join('');

        if (append) {
            const tbody = container.querySelector('tbody');
            if(tbody) tbody.insertAdjacentHTML('beforeend', rows);
        } else {
            container.innerHTML = `<table class="table table-dark table-hover table-sm tabela-filmes mb-0"><thead><tr>
                <th>#</th><th style="width:50px">Capa</th><th class="sortable" data-sort="titulo">Título <i class="fas fa-sort"></i></th>
                <th class="sortable" data-sort="nota">Nota <i class="fas fa-sort"></i></th><th class="sortable" data-sort="ano">Ano <i class="fas fa-sort"></i></th>
                <th>Direção</th><th>Atores</th><th>Gênero / Tags</th><th class="text-center">Status</th><th class="text-end">Ações</th>
            </tr></thead><tbody>${rows}</tbody></table>`;
            UI.initDragScroll(container);
        }
    },

    renderGrid: (lista, container, append = false) => {
        if (!container) return;
        if (!append) container.innerHTML = '';
        if (!lista.length && !append) { container.innerHTML = '<p class="text-center text-muted pt-3">Nenhum filme encontrado.</p>'; return; }

        const cards = lista.map(f => `
            <div class="movie-card" data-id="${f.id}" title="${f.titulo} (${f.ano || '-'}) ★ ${(f.nota || 0).toFixed(1)}">
                <div class="position-relative" style="height: 100%;">
                    ${UI.templates.poster(f.posterUrl, 'movie-poster-img', f.titulo)}
                    
                    ${f.assistido ? '<div class="movie-watched-badge"><i class="fas fa-eye"></i></div>' : ''}
                    
                    <div class="movie-card-actions">
                        <button class="btn-action btn-view" title="Ver Detalhes"><i class="fas fa-eye"></i></button>
                        <button class="btn-action btn-edit" title="Editar"><i class="fas fa-ellipsis-h"></i></button>
                        <button class="btn-action btn-delete" title="Excluir"><i class="fas fa-trash"></i></button>
                    </div>
                </div>
            </div>
        `).join('');

        if (append) {
            const grid = container.querySelector('.movies-grid');
            if(grid) grid.insertAdjacentHTML('beforeend', cards);
        } else {
            container.innerHTML = `<div class="movies-grid">${cards}</div>`;
        }
    },

    updatePreviewPoster: (url) => {
        const { previewImg: img, previewPlaceholder: placeholder } = UI.els;
        img.onload = null; img.onerror = null; img.removeAttribute('data-tried-original');

        if (url && url !== 'N/A') {
            const hdUrl = url.replace(/_SX[0-9]+.*\./, ".");
            img.src = hdUrl;
            
            img.onload = () => { img.style.display = 'block'; placeholder.style.display = 'none'; };
            
            img.onerror = function() {
                if (!this.hasAttribute('data-tried-original')) {
                    this.setAttribute('data-tried-original', 'true');
                    this.src = url;
                } else {
                    this.style.display = 'none'; placeholder.style.display = 'block';
                }
            };
        } else {
            img.src = ''; img.style.display = 'none'; placeholder.style.display = 'block';
        }
    },

    toggleDataAssistido: (show) => {
        UI.els.dataAssistidoGroup.style.display = show ? 'block' : 'none';
        const input = UI.els.dataAssistidoGroup.querySelector('input');
        if (show) input.setAttribute('required', 'required');
        else { input.removeAttribute('required'); input.value = ''; }
    },

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

    renderCustomTags: (tags, onRemove) => {
        if (!UI.els.tagsTagContainer) return;
        UI.els.tagsTagContainer.querySelectorAll('.tag-pill-custom').forEach(el => el.remove());
        
        tags.slice().reverse().forEach(label => {
            const tagEl = document.createElement('span'); 
            tagEl.className = 'tag-pill-custom';
            tagEl.innerHTML = `<span><i class="fas fa-hashtag me-1" style="font-size: 0.7em;"></i>${label}</span><button class="tag-remove-btn">&times;</button>`;
            tagEl.querySelector('button').addEventListener('click', () => onRemove(label));
            UI.els.tagsTagContainer.prepend(tagEl);
        });
    },

    clearForm: () => {
        UI.els.form.reset();
        UI.els.form.classList.remove('was-validated');
        UI.updatePreviewPoster('');
        UI.toggleDataAssistido(false);
        UI.els.generoTagContainer.querySelectorAll('.tag-pill').forEach(el => el.remove());
        if (UI.els.tagsTagContainer) {
            UI.els.tagsTagContainer.querySelectorAll('.tag-pill-custom').forEach(el => el.remove());
        }
    },

    fillForm: (f, generosCallback, tagsCallback) => {
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
        if (f.tags && tagsCallback) tagsCallback(f.tags);
    },

    // UPDATESTATS OTIMIZADO
    updateStats: (assistidos, total) => {
        UI.els.statTotal.textContent = assistidos.length;
        UI.els.statMedia.textContent = assistidos.length 
            ? (assistidos.reduce((a, f) => a + (f.nota || 0), 0) / assistidos.length).toFixed(1) 
            : '0.0';

        const processarEstatisticas = () => {
            if (!assistidos.length) {
                const containers = ['ranking-generos-bars', 'ranking-atores-bars', 'ranking-diretores-bars', 'ranking-anos-bars', 'ranking-decadas-bars', 'ranking-anos-assistidos-bars'];
                containers.forEach(id => {
                    const el = document.getElementById(id);
                    if (el) el.innerHTML = '<p class="text-muted small">N/A</p>';
                });
                return;
            }

            const nac = assistidos.filter(f => f.origem === 'Nacional').length;
            UI.els.statPctNac.textContent = `${Math.round((nac / assistidos.length) * 100)}%`;
            UI.els.statPctInt.textContent = `${Math.round(((assistidos.length - nac) / assistidos.length) * 100)}%`;

            const counts = { genero: {}, atores: {}, direcao: {}, decadas: {}, anos: {}, anosAssistidos: {} };
            let melhor = assistidos[0], pior = assistidos[0];

            assistidos.forEach(f => {
                ['genero', 'atores', 'direcao'].forEach(key => {
                    const items = Array.isArray(f[key]) ? f[key] : [f[key]];
                    items.forEach(i => { if(i) counts[key][i] = (counts[key][i] || 0) + 1; });
                });

                if(f.ano) {
                    const d = `Anos ${Math.floor(f.ano / 10) * 10}`;
                    counts.decadas[d] = (counts.decadas[d] || 0) + 1;
                    counts.anos[f.ano] = (counts.anos[f.ano] || 0) + 1;
                }

                if(f.dataAssistido) {
                    const anoA = f.dataAssistido.substring(0, 4);
                    counts.anosAssistidos[anoA] = (counts.anosAssistidos[anoA] || 0) + 1;
                }

                if ((f.nota || 0) > (melhor.nota || 0)) melhor = f;
                if ((f.nota || 10) < (pior.nota || 10)) pior = f;
            });

            UI.els.statMelhor.textContent = melhor.titulo || '-';
            UI.els.statPior.textContent = pior.titulo || '-';

            const topAtores = Object.entries(counts.atores).sort((a,b) => b[1] - a[1]);
            UI.els.statAtor.textContent = topAtores.length ? topAtores[0][0] : '-';
            
            const topDec = Object.entries(counts.decadas).sort((a,b) => b[1] - a[1]);
            UI.els.statDecada.textContent = topDec.length ? topDec[0][0] : '-';

            UI.renderRankings('ranking-generos-bars', Object.entries(counts.genero).sort((a,b)=>b[1]-a[1]).slice(0, 15));
            UI.renderRankings('ranking-atores-bars', topAtores.slice(0, 15));
            UI.renderRankings('ranking-diretores-bars', Object.entries(counts.direcao).sort((a,b)=>b[1]-a[1]).slice(0, 15));
            UI.renderRankings('ranking-anos-bars', Object.entries(counts.anos).sort((a,b)=>b[1]-a[1]).slice(0, 15));
            UI.renderRankings('ranking-decadas-bars', topDec.slice(0, 5));
            UI.renderRankings('ranking-anos-assistidos-bars', Object.entries(counts.anosAssistidos).sort((a,b)=>b[1]-a[1]).slice(0, 10));

            if (window.carouselTimeout) clearTimeout(window.carouselTimeout);
            window.carouselTimeout = setTimeout(() => UI.renderCarousel(assistidos), 100);
            
            const sectionStats = document.getElementById('estatisticas-section');
            if (sectionStats && sectionStats.style.display !== 'none') {
                if (window.statsTimeout) clearTimeout(window.statsTimeout);
                window.statsTimeout = setTimeout(() => UI.renderCharts(assistidos), 200);
            }
        };

        if (window.requestIdleCallback) {
            window.requestIdleCallback(processarEstatisticas);
        } else {
            setTimeout(processarEstatisticas, 100);
        }
    },

    renderCarousel: (assistidos) => {
        const containerUltimos = document.getElementById('ultimos-assistidos-container');
        if (!containerUltimos) return;

        const ultimos10 = assistidos
            .filter(f => f.assistido && f.dataAssistido)
            .sort((a, b) => (b.dataAssistido > a.dataAssistido ? 1 : -1))
            .slice(0, 10);

        if (ultimos10.length === 0) {
            containerUltimos.innerHTML = `<div class="d-flex align-items-center justify-content-center w-100 p-4 text-muted border rounded" style="background: rgba(0,0,0,0.05);"><i class="fas fa-history me-2"></i> Nenhum filme assistido.</div>`;
        } else {
            const html = ultimos10.map((f, i) => `
                <div class="flex-shrink-0 mini-movie-card" 
                     style="animation: fadeInUp 0.5s ease forwards; animation-delay: ${i * 50}ms; opacity: 0; cursor: pointer;"
                     onclick="document.querySelector('tr[data-id=\\'${f.id}\\'] .btn-detalhes')?.click(); document.getElementById('view-btn-table').click(); document.getElementById('lista-section').scrollIntoView({behavior: 'smooth'});">
                    <div class="mini-poster-wrapper mb-2">
                        <img src="${f.posterUrl}" loading="lazy" decoding="async" class="movie-poster-img" width="110" height="165" style="object-fit:cover;" alt="${f.titulo}" onerror="this.style.display='none';">
                        <div class="mini-date-badge"><i class="fas fa-calendar-check me-1"></i>${UI.templates.date(f.dataAssistido)}</div>
                    </div>
                    <div class="text-truncate text-center fw-medium px-1 text-muted" style="font-size: 0.8rem;" title="${f.titulo}">${f.titulo}</div>
                </div>
            `).join('');
            
            requestAnimationFrame(() => { containerUltimos.innerHTML = html; });
        }
    },

    renderRankings: (elId, data) => {
        const container = document.getElementById(elId);
        if (!container) return;
        if (!data.length) { container.innerHTML = '<p class="text-muted small">N/A</p>'; return; }
        const max = Math.max(...data.map(d => d[1]));
        const html = data.map(([label, count]) => `
            <div class="ranking-bar-item mb-2">
                <span class="ranking-bar-label">${label}</span>
                <div class="ranking-bar-container"><div class="ranking-bar" style="width: ${(count/max)*100}%" title="${label}: ${count}"></div></div>
                <span class="ranking-bar-count">${count}</span>
            </div>
        `).join('');
        container.innerHTML = html;
    },

    renderCharts: (filmes) => {
        if (!ChartJS) return;
        
        const isDark = UI.els.body.classList.contains('dark-mode');
        const colorText = isDark ? 'rgba(226, 232, 240, 0.8)' : 'rgba(0, 0, 0, 0.7)';
        const colorGrid = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';
        
        ChartJS.defaults.color = colorText;
        ChartJS.defaults.borderColor = colorGrid;

        const createChart = (id, type, labels, data, labelStr, bgColors, borderColor, opts={}) => {
            const ctx = document.getElementById(id)?.getContext('2d');
            if (!ctx) return;
            
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

        const count = (k) => { const c={}; filmes.forEach(f => (Array.isArray(f[k])?f[k]:[f[k]]).forEach(i=>{if(i)c[i]=(c[i]||0)+1})); return Object.entries(c).sort((a,b)=>b[1]-a[1]).slice(0,5); };
        
        const gens = count('genero');
        createChart('generosChart','doughnut',gens.map(x=>x[0]),gens.map(x=>x[1]),'Filmes',['#a855f7','#3b82f6','#ec4899','#f97316','#14b8a6']);
        
        const dirs = count('direcao');
        createChart('diretoresChart','bar',dirs.map(x=>x[0]),dirs.map(x=>x[1]),'Qtd.','rgba(236,72,153,0.7)',null,{indexAxis:'y'});
        
        const origs={}; filmes.forEach(f=>{if(f.origem)origs[f.origem]=(origs[f.origem]||0)+1});
        createChart('origemChart','pie',Object.keys(origs),Object.values(origs),'Origem',['#3b82f6','#14b8a6']);
        
        const anosC={}; filmes.forEach(f=>{if(f.ano)anosC[f.ano]=(anosC[f.ano]||0)+1});
        const topAnos=Object.entries(anosC).sort((a,b)=>b[0]-a[0]).slice(0,10).reverse();
        createChart('anosChart','bar',topAnos.map(x=>x[0]),topAnos.map(x=>x[1]),'Qtd.','rgba(59,130,246,0.7)',null,{indexAxis:'y'});
        
        const notasC={}; filmes.forEach(f=>{if(f.nota!=null){const n=Math.round(f.nota);notasC[n]=(notasC[n]||0)+1}});
        const nLabels=Object.keys(notasC).sort((a,b)=>a-b);
        createChart('notasChart','line',nLabels,nLabels.map(l=>notasC[l]),'Qtd.','rgba(236,72,153,0.2)','#ec4899');
        
        const medAno={}; filmes.forEach(f=>{if(f.ano&&f.nota){if(!medAno[f.ano])medAno[f.ano]={s:0,c:0};medAno[f.ano].s+=f.nota;medAno[f.ano].c++}});
        const anosM=Object.keys(medAno).sort();
        createChart('mediaNotasAnoChart','line',anosM,anosM.map(a=>(medAno[a].s/medAno[a].c).toFixed(1)),'Média','rgba(249,115,22,0.2)','#f97316');
        
        const mLab=[]; const mapM={}; const hoje=new Date();
        const cap = s => s.charAt(0).toUpperCase()+s.slice(1);
        for(let i=11;i>=0;i--){const d=new Date(hoje.getFullYear(),hoje.getMonth()-i,1);const k=`${cap(d.toLocaleString('pt-BR',{month:'short'}).replace('.',''))}/${d.getFullYear().toString().slice(-2)}`;mLab.push(k);mapM[k]=0;}
        filmes.forEach(f=>{if(f.assistido&&f.dataAssistido){const d=new Date(f.dataAssistido);const k=`${cap(d.toLocaleString('pt-BR',{month:'short'}).replace('.',''))}/${d.getFullYear().toString().slice(-2)}`;if(mapM[k]!==undefined)mapM[k]++}});
        createChart('assistidosMesChart','bar',mLab,mLab.map(k=>mapM[k]),'Assistidos','rgba(168,85,247,0.7)');
    },

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
        container.innerHTML = conquistas.map(c => `
            <div class="conquista-selo ${c.unlocked?'unlocked':''}" title="${c.descricao}">
                <i class="${c.icone}"></i><span>${c.nome}</span>
            </div>`).join('');
    },

    showMovieDetailModal: (f, onMarkWatched, onFetchTrailer) => {
        const htmlCapa = f.posterUrl && f.posterUrl !== 'N/A' 
            ? `<div class="suggestion-poster me-md-4 mb-3 mb-md-0" style="flex:0 0 140px;max-width:140px;"><img src="${f.posterUrl}" style="width:100%;border-radius:8px;box-shadow:0 4px 15px rgba(0,0,0,0.5);"></div>` : '';
        const genres = f.genero?.length ? f.genero.map(g => `<span class="tag-pill" style="font-size:0.75rem;">${g}</span>`).join('') : '<span class="text-white-50 small">S/ Gênero</span>';
        const customTags = f.tags?.length ? f.tags.map(t => `<span class="badge border border-secondary text-secondary me-1"><i class="fas fa-hashtag me-1"></i>${t}</span>`).join('') : '';
        
        Swal.fire({
            title: f.titulo, showCloseButton: true, width: '800px',
            html: `
                <div class="suggestion-layout" style="align-items:flex-start;">${htmlCapa}
                    <div class="suggestion-main-info" style="flex:1;min-width:0;text-align:left;">
                        <p class="mt-3 mb-1"><strong class="text-white"><i class="fas fa-calendar me-2"></i>Ano:</strong> ${f.ano||'N/A'}</p>
                        <p class="mb-1"><strong class="text-white"><i class="fas fa-video me-2"></i>Direção:</strong> ${f.direcao?.join(', ')||'N/A'}</p>
                        <p class="mb-1"><strong class="text-white"><i class="fas fa-users me-2"></i>Atores:</strong> ${f.atores?.join(', ')||'N/A'}</p>
                        ${customTags ? `<div class="mt-2 mb-2">${customTags}</div>` : ''}
                        <div class="mt-3 pt-3 border-top border-secondary text-white-50 small">
                            <strong class="text-white">Status:</strong> ${UI.templates.statusIcon(f.assistido)} ${f.assistido && f.dataAssistido ? `em ${UI.templates.date(f.dataAssistido)}` : ''}
                        </div>
                    </div>
                    <div class="suggestion-side-info ms-md-2">
                        <div class="suggestion-note"><i class="fas fa-star text-warning"></i><span style="font-size:2.5rem;font-weight:700;">${(f.nota||0).toFixed(1)}</span></div>
                        <div class="suggestion-genres mt-2" style="display:flex;flex-wrap:wrap;justify-content:center;gap:0.5rem;">${genres}</div>
                    </div>
                </div>
                <div id="trailer-box" class="mt-4 w-100" style="min-height: 50px;"></div>`,
            showConfirmButton: !f.assistido && onMarkWatched, showCancelButton: true,
            confirmButtonText: '<i class="fas fa-check-circle me-1"></i> Marcar assistido', cancelButtonText: 'Fechar',
            customClass: { popup: 'suggestion-swal-popup', confirmButton: 'suggestion-deny-btn', cancelButton: 'suggestion-cancel-btn' },
            didOpen: () => {
                if (onFetchTrailer) {
                    const box = document.getElementById('trailer-box');
                    if (box) box.innerHTML = '<div class="text-center text-white-50 small my-3"><i class="fas fa-spinner fa-spin me-2"></i>Buscando trailer...</div>';
                    
                    onFetchTrailer(f.titulo, f.ano).then(videoId => {
                        if (videoId && box) {
                            box.innerHTML = `<div class="ratio ratio-16x9 rounded overflow-hidden shadow"><iframe src="https://www.youtube.com/embed/${videoId}?rel=0" allowfullscreen></iframe></div>`;
                        } else if (box) {
                            box.innerHTML = '<div class="text-center text-white-50 small my-3"><i class="fas fa-video-slash me-2"></i>Trailer indisponível</div>';
                        }
                    });
                }
            }
        }).then(res => { if(res.isConfirmed && onMarkWatched) onMarkWatched(f.id); });
    },

    showRandomSuggestion: (f, onMark, onRetry, onFetchTrailer) => {
        const htmlCapa = f.posterUrl && f.posterUrl !== 'N/A' 
            ? `<div class="suggestion-poster me-md-4 mb-3 mb-md-0" style="flex:0 0 140px;max-width:140px;"><img src="${f.posterUrl}" style="width:100%;border-radius:8px;box-shadow:0 4px 15px rgba(0,0,0,0.5);"></div>` : '';
        const genres = f.genero?.length ? f.genero.map(g => `<span class="tag-pill" style="font-size:0.75rem;">${g}</span>`).join('') : '<span class="text-white-50 small">S/ Gênero</span>';
        const customTags = f.tags?.length ? f.tags.map(t => `<span class="badge border border-secondary text-secondary me-1"><i class="fas fa-hashtag me-1"></i>${t}</span>`).join('') : '';

        Swal.fire({
            title: 'Que tal assistir...', showCloseButton: true, width: '800px',
            html: `
                <div class="suggestion-layout" style="align-items:flex-start;">${htmlCapa}
                    <div class="suggestion-main-info" style="flex:1;min-width:0;text-align:left;">
                        <h2 class="suggestion-title" style="font-size:1.8rem;line-height:1.2;margin-bottom:1rem;">${f.titulo}</h2>
                        <p class="mb-1"><strong class="text-white"><i class="fas fa-calendar me-2"></i>Ano:</strong> ${f.ano||'N/A'}</p>
                        <p class="mb-1"><strong class="text-white"><i class="fas fa-video me-2"></i>Direção:</strong> ${f.direcao?.join(', ')||'N/A'}</p>
                        <p class="mb-1 text-truncate"><strong class="text-white"><i class="fas fa-users me-2"></i>Atores:</strong> ${f.atores?.join(', ')||'N/A'}</p>
                        ${customTags ? `<div class="mt-2 mb-2">${customTags}</div>` : ''}
                    </div>
                    <div class="suggestion-side-info ms-md-2">
                        <div class="suggestion-note"><i class="fas fa-star text-warning"></i><span style="font-size:2.5rem;font-weight:700;">${(f.nota||0).toFixed(1)}</span></div>
                        <div class="suggestion-genres mt-2" style="display:flex;flex-wrap:wrap;justify-content:center;gap:0.5rem;">${genres}</div>
                    </div>
                </div>
                <div id="trailer-box-random" class="mt-4 w-100" style="min-height: 50px;"></div>`,
            showCancelButton: true, cancelButtonText: 'Sugerir outro',
            showDenyButton: !!onMark, denyButtonText: '<i class="fas fa-check-circle me-1"></i> Marcar assistido', confirmButtonText: 'Ótima ideia!',
            customClass: { popup: 'suggestion-swal-popup', confirmButton: 'suggestion-confirm-btn', cancelButton: 'suggestion-cancel-btn', denyButton: 'suggestion-deny-btn' },
            didOpen: () => {
                if (onFetchTrailer) {
                    const box = document.getElementById('trailer-box-random');
                    if (box) box.innerHTML = '<div class="text-center text-white-50 small my-3"><i class="fas fa-spinner fa-spin me-2"></i>Buscando trailer...</div>';
                    
                    onFetchTrailer(f.titulo, f.ano).then(videoId => {
                        if (videoId && box) {
                            box.innerHTML = `<div class="ratio ratio-16x9 rounded overflow-hidden shadow"><iframe src="https://www.youtube.com/embed/${videoId}?rel=0" allowfullscreen></iframe></div>`;
                        } else if (box) {
                            box.innerHTML = '<div class="text-center text-white-50 small my-3"><i class="fas fa-video-slash me-2"></i>Trailer indisponível</div>';
                        }
                    });
                }
            }
        }).then(res => {
            if (res.isDismissed && res.dismiss === Swal.DismissReason.cancel && onRetry) onRetry();
            else if (res.isDenied && onMark) onMark(f.id);
        });
    },

    initDragScroll: (el) => {
        if (!el) return;
        let isDown = false;
        let startX, scrollLeft;
        let animationFrameId; 
        
        el.addEventListener('mousedown', (e) => {
            isDown = true;
            el.classList.add('active'); 
            startX = e.pageX - el.offsetLeft;
            scrollLeft = el.scrollLeft;
            cancelAnimationFrame(animationFrameId); 
        });
        
        const stopDrag = () => {
            isDown = false;
            el.classList.remove('active');
            cancelAnimationFrame(animationFrameId);
        };
        
        el.addEventListener('mouseleave', stopDrag);
        el.addEventListener('mouseup', stopDrag);
        
        el.addEventListener('mousemove', (e) => {
            if (!isDown) return;
            e.preventDefault();
            
            cancelAnimationFrame(animationFrameId);
            animationFrameId = requestAnimationFrame(() => {
                const x = e.pageX - el.offsetLeft;
                const walk = (x - startX) * 2; 
                el.scrollLeft = scrollLeft - walk;
            });
        });
    }
};