import { templates } from './elements.js';
import { getResizedUrl, initDragScroll } from './helpers.js';
import { updateStats } from './stats.js';

export const renderSkeletons = (container, viewType = 'table', qtd = 12) => {
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
};

export const renderContent = (filmesVisiveis, listaCompleta, viewType = 'table', append = false, totalBanco = 0, offset = 0, listaFiltradaCompleta = null) => {
    const renderFn = viewType === 'table' ? renderTable : renderGrid;
    
    // Aba "Todos": mostra apenas a página atual (com numeração correta pelo offset)
    renderFn(filmesVisiveis, document.getElementById('tabela-todos-container'), false, totalBanco, offset);
    
    // Sub-abas: mostram TODA a lista filtrada (independente da página atual)
    const listaBase = listaFiltradaCompleta || filmesVisiveis;
    const assistidosVisiveis    = listaBase.filter(f => f.assistido);
    const naoAssistidosVisiveis = listaBase.filter(f => !f.assistido);
    const favoritosVisiveis     = listaBase.filter(f => (f.nota || 0) >= 8);
    
    renderFn(assistidosVisiveis,    document.getElementById('tabela-assistidos-container'),     false, totalBanco, 0);
    renderFn(naoAssistidosVisiveis, document.getElementById('tabela-nao-assistidos-container'), false, totalBanco, 0);
    
    const tabFavoritos = document.getElementById('tabela-favoritos-container');
    if (tabFavoritos) {
        renderFn(favoritosVisiveis, tabFavoritos, false, totalBanco, 0);
    }
    
    if (!append) { 
        const assistidosTotal = listaCompleta.filter(f => f.assistido); 
        requestAnimationFrame(() => {
            updateStats(assistidosTotal, listaCompleta.length, listaCompleta);
        }); 
    }
};

export const renderTable = (lista, container, append = false, totalBanco = 0, offset = 0) => {
    if (!container) return;
    if (!append) container.innerHTML = '';
    
    const emptyStateHtml = totalBanco === 0 
        ? `<div class="d-flex flex-column align-items-center justify-content-center py-5 text-muted" style="opacity: 0.8; animation: fadeInUp 0.4s ease-out;">
            <i class="fas fa-film fa-4x mb-3 text-secondary" aria-hidden="true"></i>
            <h5 class="fw-bold">Sua jornada começa aqui!</h5>
            <p class="small mb-3">Você ainda não tem filmes cadastrados na sua coleção.</p>
            <button class="btn btn-gradient shadow-sm px-4 rounded-pill" onclick="document.getElementById('nav-cadastrar-btn').click(); window.scrollTo({top: 0, behavior: 'smooth'});">
                <i class="fas fa-plus-circle me-2"></i>Cadastre seu primeiro filme
            </button>
           </div>`
        : `<div class="d-flex flex-column align-items-center justify-content-center py-5 text-muted" style="opacity: 0.8; animation: fadeInUp 0.4s ease-out;">
            <i class="fas fa-search fa-4x mb-3 text-secondary" aria-hidden="true"></i>
            <h5 class="fw-bold">Nenhum resultado encontrado</h5>
            <p class="small mb-3">Tente ajustar seus filtros para encontrar o que procura.</p>
            <button class="btn btn-outline-secondary btn-sm" onclick="document.getElementById('limpar-filtros').click()">
                <i class="fas fa-times me-1"></i> Limpar Filtros
            </button>
           </div>`;
        
    if (!lista.length && !append) { container.innerHTML = emptyStateHtml; return; }

    // Numeração correta: usa offset da página + posição na lista
    let numeroInicial = offset + 1;
    if (append) { const linhas = container.querySelectorAll('tbody tr[data-id]'); numeroInicial = linhas.length + 1; }

    const rows = lista.map((f, i) => {
        const tagsHtml = f.tags?.length ? `<div class="mt-1">${f.tags.map(t => `<span class="badge border border-secondary text-secondary me-1 fw-normal"><i class="fas fa-hashtag me-1"></i>${t}</span>`).join('')}</div>` : '';
        const expandedPoster = f.posterUrl && f.posterUrl !== 'N/A'
            ? `<img src="${getResizedUrl(f.posterUrl, 100)}" class="rounded shadow-sm me-3" style="width: 60px; height: 90px; object-fit: cover; border: 1px solid rgba(255,255,255,0.1);">`
            : `<div class="rounded shadow-sm me-3 d-flex align-items-center justify-content-center bg-dark text-muted" style="width: 60px; height: 90px; border: 1px solid rgba(255,255,255,0.1);"><i class="fas fa-film fa-2x"></i></div>`;
            
        return `
        <tr data-id="${f.id}" style="cursor:pointer;animation:rowFadeIn 0.25s ease forwards;animation-delay:${i*50}ms;opacity:0;">
            <td class="col-num align-middle">${numeroInicial + i}</td>
            <td class="col-poster align-middle">${templates.poster(f.posterUrl, 'poster-thumb')}</td>
            <td class="col-titulo align-middle fw-bold text-truncate poster-hover-cell" style="max-width: 250px;" data-poster="${f.posterUrl || ''}" data-titulo="${f.titulo || ''}">${f.titulo || 'N/A'}</td>
            <td class="col-nota align-middle">⭐ ${(f.nota || 0).toFixed(1)}</td>
            <td class="col-ano align-middle">${f.ano || '-'}</td>
            <td class="col-direcao align-middle text-truncate" style="max-width: 150px;">${f.direcao?.join(', ') || ''}</td>
            <td class="col-atores align-middle text-truncate" style="max-width: 200px;">${f.atores?.join(', ') || ''}</td>
            <td class="col-genero align-middle">${f.genero?.join(', ') || ''}${tagsHtml}</td>
            <td class="col-assistido align-middle text-center">${templates.statusIcon(f.assistido)}</td>
            <td class="col-acoes align-middle text-end">
                <div class="d-flex align-items-center justify-content-end gap-2">
                    <button class="btn btn-sm btn-link text-muted btn-detalhes" type="button" data-bs-toggle="collapse" data-bs-target="#detalhes-${f.id}" aria-label="Ver mais detalhes"><i class="fas fa-chevron-down"></i></button>
                    <div class="dropdown">
                        <button class="btn btn-sm btn-outline-secondary border-0" type="button" data-bs-toggle="dropdown" aria-label="Ações"><i class="fas fa-ellipsis-v"></i></button>
                        <ul class="dropdown-menu dropdown-menu-end dropdown-menu-dark shadow">
                            <li><button class="dropdown-item btn-view"><i class="fas fa-eye me-2 text-primary"></i> Ver Detalhes</button></li>
                            <li class="btn-edit-item"><button class="dropdown-item btn-edit"><i class="fas fa-pen me-2 text-info"></i> Editar</button></li>
                            <li class="btn-delete-item"><hr class="dropdown-divider"></li>
                            <li class="btn-delete-item"><button class="dropdown-item btn-delete text-danger"><i class="fas fa-trash me-2"></i> Excluir</button></li>
                        </ul>
                    </div>
                </div>
            </td>
        </tr>
        <tr class="linha-detalhes">
            <td colspan="12" class="p-0 border-0">
                <div class="collapse" id="detalhes-${f.id}">
                    <div class="p-3 bg-dark bg-opacity-25 border-bottom border-secondary text-white-50 small">
                        <div class="d-flex align-items-start">
                            ${expandedPoster}
                            <div class="flex-grow-1">
                                <div class="row">
                                    <div class="col-md-6 mb-2"><strong class="text-white"><i class="fas fa-globe me-2"></i>Origem:</strong> ${f.origem || '-'}</div>
                                    <div class="col-md-6 mb-2"><strong class="text-white"><i class="fas fa-calendar-day me-2"></i>Data Assistido:</strong> ${f.assistido ? templates.date(f.dataAssistido) : '-'}</div>
                                </div>
                                ${f.tags?.length ? `<div class="mt-1"><strong class="text-white d-block mb-1">Listas/Tags:</strong> ${f.tags.map(t => `<span class="badge border border-info text-info me-1"><i class="fas fa-hashtag me-1"></i>${t}</span>`).join('')}</div>` : ''}
                            </div>
                        </div>
                    </div>
                </div>
            </td>
        </tr>`;
    }).join('');

    if (append) { 
        const tbody = container.querySelector('tbody'); 
        if (tbody) tbody.insertAdjacentHTML('beforeend', rows); 
    } else {
        container.innerHTML = `
        <table class="table table-dark table-hover table-sm tabela-filmes mb-0">
            <thead>
                <tr>
                    <th>#</th><th style="width:50px">Capa</th><th class="sortable" data-sort="titulo">Título <i class="fas fa-sort"></i></th>
                    <th class="sortable" data-sort="nota">Nota <i class="fas fa-sort"></i></th><th class="sortable" data-sort="ano">Ano <i class="fas fa-sort"></i></th>
                    <th>Direção</th><th>Artistas</th><th>Gênero / Tags</th><th class="text-center">Status</th><th class="text-end">Ações</th>
                </tr>
            </thead>
            <tbody>${rows}</tbody>
        </table>`;
        initDragScroll(container);
    }
};

export const renderGrid = (lista, container, append = false, totalBanco = 0, offset = 0) => {
    if (!container) return;
    if (!append) container.innerHTML = '';
    
    const emptyStateHtml = totalBanco === 0 
        ? `<div class="d-flex flex-column align-items-center justify-content-center py-5 text-muted" style="opacity: 0.8; animation: fadeInUp 0.4s ease-out;"><i class="fas fa-film fa-4x mb-3 text-secondary" aria-hidden="true"></i><h5 class="fw-bold">Sua jornada começa aqui!</h5><p class="small mb-3">Você ainda não tem filmes cadastrados na sua coleção.</p><button class="btn btn-gradient shadow-sm px-4 rounded-pill" onclick="document.getElementById('nav-cadastrar-btn').click(); window.scrollTo({top: 0, behavior: 'smooth'});"><i class="fas fa-plus-circle me-2"></i>Cadastre seu primeiro filme</button></div>`
        : `<div class="d-flex flex-column align-items-center justify-content-center py-5 text-muted" style="opacity: 0.8; animation: fadeInUp 0.4s ease-out;"><i class="fas fa-search fa-4x mb-3 text-secondary" aria-hidden="true"></i><h5 class="fw-bold">Nenhum resultado encontrado</h5><p class="small mb-3">Tente ajustar seus filtros para encontrar o que procura.</p><button class="btn btn-outline-secondary btn-sm" onclick="document.getElementById('limpar-filtros').click()"><i class="fas fa-times me-1"></i> Limpar Filtros</button></div>`;
        
    if (!lista.length && !append) { container.innerHTML = emptyStateHtml; return; }

    const cards = lista.map((f, i) => `
        <div class="movie-card" data-id="${f.id}" tabindex="0" role="button" aria-label="Filme: ${f.titulo}, Ano: ${f.ano || 'Desconhecido'}, Nota: ${(f.nota || 0).toFixed(1)}" title="${f.titulo} (${f.ano || '-'}) ★ ${(f.nota || 0).toFixed(1)}" style="animation:cardFadeIn 0.3s ease forwards;animation-delay:${i*50}ms;opacity:0;">
            <div class="position-relative" style="height: 100%;">
                ${templates.poster(f.posterUrl, 'movie-poster-img', f.titulo)}
                ${f.assistido ? '<div class="movie-watched-badge"><i class="fas fa-eye"></i></div>' : ''}
                <div class="movie-card-actions">
                    ${!f.assistido ? `<button class="btn-action btn-quick-watch text-success" aria-label="Marcar ${f.titulo} como assistido" title="Já assisti!"><i class="fas fa-check-circle" aria-hidden="true"></i></button>` : ''}
                    <button class="btn-action btn-view" aria-label="Ver detalhes de ${f.titulo}" title="Ver Detalhes"><i class="fas fa-eye" aria-hidden="true"></i></button>
                    <button class="btn-action btn-edit" aria-label="Editar ${f.titulo}" title="Editar"><i class="fas fa-pen" aria-hidden="true"></i></button>
                    <button class="btn-action btn-delete" aria-label="Excluir ${f.titulo}" title="Excluir"><i class="fas fa-trash" aria-hidden="true"></i></button>
                </div>
            </div>
        </div>
    `).join('');

    if (append) { const grid = container.querySelector('.movies-grid'); if (grid) grid.insertAdjacentHTML('beforeend', cards); } 
    else { container.innerHTML = `<div class="movies-grid">${cards}</div>`; }
};

export const renderVitrines = (todosFilmes) => {
    const vitrinesSection = document.getElementById('vitrines-section');
    const contDestaques = document.getElementById('vitrine-destaques');
    const contRecomendados = document.getElementById('vitrine-recomendados');
    
    if (!vitrinesSection || !contDestaques || !contRecomendados) return;
    if (todosFilmes.length < 3) { vitrinesSection.style.display = 'none'; return; }
    
    vitrinesSection.style.display = 'block';

    const assistidos = [...todosFilmes].filter(f => f.assistido && f.nota >= 7.0);
    assistidos.sort((a, b) => b.nota - a.nota); 
    const poolMelhores = assistidos.slice(0, 30); 
    const destaques = poolMelhores.map(value => ({ value, sort: Math.random() })).sort((a, b) => a.sort - b.sort).map(({ value }) => value).slice(0, 15);

    const pendentes = todosFilmes.filter(f => !f.assistido);
    const recomendados = pendentes.map(value => ({ value, sort: Math.random() })).sort((a, b) => a.sort - b.sort).map(({ value }) => value).slice(0, 15);

    const gerarCardsHTML = (filmesLista, tipoSelo) => {
        if (filmesLista.length === 0) return '<p class="text-muted small p-3">Não há filmes suficientes para esta lista.</p>';
        return filmesLista.map((f, i) => {
            const imgUrl = getResizedUrl(f.posterUrl, 300);
            const imgHtml = (imgUrl && imgUrl !== 'N/A') ? `<img src="${imgUrl}" loading="lazy" alt="${f.titulo}">` : `<div class="d-flex align-items-center justify-content-center h-100 bg-dark"><i class="fas fa-film fa-2x text-muted"></i></div>`;
            let badgeHtml = '';
            if (tipoSelo === 'nota') badgeHtml = `<div class="vitrine-badge badge-dark"><i class="fas fa-star text-warning"></i> ${(f.nota||0).toFixed(1)}</div>`;
            else if (tipoSelo === 'novo') badgeHtml = `<div class="vitrine-badge">Para Você</div>`;

            return `<div class="vitrine-card" data-id="${f.id}" title="${f.titulo} (${f.ano || '-'})" style="animation:fadeInUp 0.4s ease forwards;animation-delay:${i*70}ms;opacity:0;">${badgeHtml}${imgHtml}</div>`;
        }).join('');
    };

    contDestaques.innerHTML = gerarCardsHTML(destaques, 'nota');
    contRecomendados.innerHTML = gerarCardsHTML(recomendados, 'novo');
    initDragScroll(contDestaques); initDragScroll(contRecomendados);
};