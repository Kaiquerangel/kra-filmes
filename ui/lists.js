import { templates } from './elements.js';
import { getResizedUrl, initDragScroll } from './helpers.js';
import { updateStats } from './stats.js';
import {
    tabelaLinhaHTML, tabelaWrapperHTML,
    gridCardHTML, emptyStateHTML, vitrineCardHTML
} from './html-templates.js';

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
    
    const emptyStateHtml = emptyStateHTML(totalBanco);
        
    if (!lista.length && !append) { container.innerHTML = emptyStateHtml; return; }

    // Numeração correta: usa offset da página + posição na lista
    let numeroInicial = offset + 1;
    if (append) { const linhas = container.querySelectorAll('tbody tr[data-id]'); numeroInicial = linhas.length + 1; }

    const rows = lista.map((f, i) => tabelaLinhaHTML(f, i)).join('');

    if (append) { 
        const tbody = container.querySelector('tbody'); 
        if (tbody) tbody.insertAdjacentHTML('beforeend', rows); 
    } else {
        container.innerHTML = tabelaWrapperHTML(rows);
        initDragScroll(container);
    }
};

export const renderGrid = (lista, container, append = false, totalBanco = 0, offset = 0) => {
    if (!container) return;
    if (!append) container.innerHTML = '';
    
    const emptyStateHtml = emptyStateHTML(totalBanco);
        
    if (!lista.length && !append) { container.innerHTML = emptyStateHtml; return; }

    const cards = lista.map((f, i) => gridCardHTML(f, i)).join('');

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
            return vitrineCardHTML(f, i, tipoSelo);
        }).join('');
    };

    contDestaques.innerHTML = gerarCardsHTML(destaques, 'nota');
    contRecomendados.innerHTML = gerarCardsHTML(recomendados, 'novo');
    initDragScroll(contDestaques); initDragScroll(contRecomendados);
};