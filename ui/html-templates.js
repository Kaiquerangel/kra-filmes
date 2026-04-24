/**
 * html-templates.js
 * 
 * Centraliza todos os templates HTML da aplicação.
 * Cada função recebe os dados necessários e retorna uma string HTML.
 * Mantém os arquivos de lógica (lists, modals, stats, profile) mais limpos.
 */

import { templates } from './elements.js';
import { getResizedUrl } from './helpers.js';

// ─────────────────────────────────────────────
// LISTA — TABELA
// ─────────────────────────────────────────────

export const tabelaLinhaHTML = (f, index, numero = null) => {
    const tagsHtml = f.tags?.length
        ? `<div class="mt-1">${f.tags.map(t =>
            `<span class="badge border border-secondary text-secondary me-1 fw-normal">
                <i class="fas fa-hashtag me-1"></i>${t}
            </span>`).join('')}</div>`
        : '';

    const expandedPoster = f.posterUrl && f.posterUrl !== 'N/A'
        ? `<img src="${getResizedUrl(f.posterUrl, 100)}" class="rounded shadow-sm me-3"
               style="width:60px;height:90px;object-fit:cover;border:1px solid rgba(255,255,255,0.1);">`
        : `<div class="rounded shadow-sm me-3 d-flex align-items-center justify-content-center bg-dark text-muted"
               style="width:60px;height:90px;border:1px solid rgba(255,255,255,0.1);">
               <i class="fas fa-film fa-2x"></i>
           </div>`;

    return `
        <tr data-id="${f.id}" style="cursor:pointer;animation:rowFadeIn 0.25s ease forwards;animation-delay:${index*50}ms;opacity:0;">
            <td class="col-num align-middle">${numero !== null ? numero : index + 1}</td>
            <td class="col-poster align-middle">${templates.poster(f.posterUrl, 'poster-thumb')}</td>
            <td class="col-titulo align-middle fw-bold text-truncate poster-hover-cell"
                style="max-width:250px;"
                data-poster="${f.posterUrl || ''}"
                data-titulo="${f.titulo || ''}">${f.titulo || 'N/A'}</td>
            <td class="col-nota align-middle">⭐ ${(f.nota || 0).toFixed(1)}</td>
            <td class="col-ano align-middle">${f.ano || '-'}</td>
            <td class="col-direcao align-middle text-truncate" style="max-width:150px;">${f.direcao?.join(', ') || ''}</td>
            <td class="col-atores align-middle text-truncate" style="max-width:200px;">${f.atores?.join(', ') || ''}</td>
            <td class="col-genero align-middle">${f.genero?.join(', ') || ''}${tagsHtml}</td>
            <td class="col-assistido align-middle text-center">${templates.statusIcon(f.assistido)}</td>
            <td class="col-acoes align-middle text-end">
                <div class="d-flex align-items-center justify-content-end gap-2">
                    <button class="btn btn-sm btn-link text-muted btn-detalhes" type="button"
                            data-bs-toggle="collapse" data-bs-target="#detalhes-${f.id}"
                            aria-label="Ver mais detalhes">
                        <i class="fas fa-chevron-down"></i>
                    </button>
                    <div class="dropdown">
                        <button class="btn btn-sm btn-outline-secondary border-0" type="button"
                                data-bs-toggle="dropdown" aria-label="Ações">
                            <i class="fas fa-ellipsis-v"></i>
                        </button>
                        <ul class="dropdown-menu dropdown-menu-end dropdown-menu-dark shadow">
                            <li><button class="dropdown-item btn-view"><i class="fas fa-eye me-2 text-primary"></i> Ver Detalhes</button></li>
                            <li><button class="dropdown-item btn-indicar"><i class="fas fa-share-alt me-2 text-success"></i> Indicar para Amigo</button></li>
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
                                ${f.tags?.length
                                    ? `<div class="mt-1"><strong class="text-white d-block mb-1">Listas/Tags:</strong>
                                        ${f.tags.map(t => `<span class="badge border border-info text-info me-1"><i class="fas fa-hashtag me-1"></i>${t}</span>`).join('')}
                                       </div>`
                                    : ''}
                            </div>
                        </div>
                    </div>
                </div>
            </td>
        </tr>`;
};

export const tabelaWrapperHTML = (rows) => `
    <table class="table table-dark table-hover table-sm tabela-filmes mb-0">
        <thead>
            <tr>
                <th>#</th>
                <th style="width:50px">Capa</th>
                <th class="sortable" data-sort="titulo">Título <i class="fas fa-sort"></i></th>
                <th class="sortable" data-sort="nota">Nota <i class="fas fa-sort"></i></th>
                <th class="sortable" data-sort="ano">Ano <i class="fas fa-sort"></i></th>
                <th>Direção</th>
                <th>Artistas</th>
                <th>Gênero / Tags</th>
                <th class="text-center">Status</th>
                <th class="text-end">Ações</th>
            </tr>
        </thead>
        <tbody>${rows}</tbody>
    </table>`;

// ─────────────────────────────────────────────
// LISTA — GRID (CARDS)
// ─────────────────────────────────────────────

export const gridCardHTML = (f, index) => `
    <div class="movie-card" data-id="${f.id}" tabindex="0" role="button"
         aria-label="Filme: ${f.titulo}, Ano: ${f.ano || 'Desconhecido'}, Nota: ${(f.nota || 0).toFixed(1)}"
         title="${f.titulo} (${f.ano || '-'}) ★ ${(f.nota || 0).toFixed(1)}"
         style="animation:cardFadeIn 0.3s ease forwards;animation-delay:${index*50}ms;opacity:0;">
        <div class="position-relative" style="height:100%;">
            ${templates.poster(f.posterUrl, 'movie-poster-img', f.titulo)}
            ${f.assistido ? '<div class="movie-watched-badge"><i class="fas fa-eye"></i></div>' : ''}
            <div class="movie-card-actions">
                ${!f.assistido
                    ? `<button class="btn-action btn-quick-watch text-success"
                              aria-label="Marcar ${f.titulo} como assistido" title="Já assisti!">
                           <i class="fas fa-check-circle" aria-hidden="true"></i>
                       </button>`
                    : ''}
                <button class="btn-action btn-view" aria-label="Ver detalhes de ${f.titulo}" title="Ver Detalhes">
                    <i class="fas fa-eye" aria-hidden="true"></i>
                </button>
                <button class="btn-action btn-indicar" aria-label="Indicar ${f.titulo}" title="Indicar para Amigo">
                    <i class="fas fa-share-alt" aria-hidden="true"></i>
                </button>
                <button class="btn-action btn-edit" aria-label="Editar ${f.titulo}" title="Editar">
                    <i class="fas fa-pen" aria-hidden="true"></i>
                </button>
                <button class="btn-action btn-delete" aria-label="Excluir ${f.titulo}" title="Excluir">
                    <i class="fas fa-trash" aria-hidden="true"></i>
                </button>
            </div>
        </div>
    </div>`;

// ─────────────────────────────────────────────
// LISTA — ESTADOS VAZIOS
// ─────────────────────────────────────────────

export const emptyStateHTML = (totalBanco) => totalBanco === 0
    ? `<div class="d-flex flex-column align-items-center justify-content-center py-5 text-muted"
            style="opacity:0.8;animation:fadeInUp 0.4s ease-out;">
           <i class="fas fa-film fa-4x mb-3 text-secondary" aria-hidden="true"></i>
           <h5 class="fw-bold">Sua jornada começa aqui!</h5>
           <p class="small mb-3">Você ainda não tem filmes cadastrados na sua coleção.</p>
           <button class="btn btn-gradient shadow-sm px-4 rounded-pill"
                   onclick="document.getElementById('nav-cadastrar-btn').click();window.scrollTo({top:0,behavior:'smooth'});">
               <i class="fas fa-plus-circle me-2"></i>Cadastre seu primeiro filme
           </button>
       </div>`
    : `<div class="d-flex flex-column align-items-center justify-content-center py-5 text-muted"
            style="opacity:0.8;animation:fadeInUp 0.4s ease-out;">
           <i class="fas fa-search fa-4x mb-3 text-secondary" aria-hidden="true"></i>
           <h5 class="fw-bold">Nenhum resultado encontrado</h5>
           <p class="small mb-3">Tente ajustar seus filtros para encontrar o que procura.</p>
           <button class="btn btn-outline-secondary btn-sm"
                   onclick="document.getElementById('limpar-filtros').click()">
               <i class="fas fa-times me-1"></i> Limpar Filtros
           </button>
       </div>`;

// ─────────────────────────────────────────────
// VITRINES
// ─────────────────────────────────────────────

export const vitrineCardHTML = (f, index, tipoSelo) => {
    const imgUrl = getResizedUrl(f.posterUrl, 300);
    const imgHtml = (imgUrl && imgUrl !== 'N/A')
        ? `<img src="${imgUrl}" loading="lazy" alt="${f.titulo}">`
        : `<div class="d-flex align-items-center justify-content-center h-100 bg-dark">
               <i class="fas fa-film fa-2x text-muted"></i>
           </div>`;

    let badgeHtml = '';
    if (tipoSelo === 'nota')
        badgeHtml = `<div class="vitrine-badge badge-dark"><i class="fas fa-star text-warning"></i> ${(f.nota||0).toFixed(1)}</div>`;
    else if (tipoSelo === 'novo')
        badgeHtml = `<div class="vitrine-badge">Para Você</div>`;

    return `<div class="vitrine-card" data-id="${f.id}"
                 title="${f.titulo} (${f.ano || '-'})"
                 style="animation:fadeInUp 0.4s ease forwards;animation-delay:${index*70}ms;opacity:0;">
                ${badgeHtml}${imgHtml}
            </div>`;
};

// ─────────────────────────────────────────────
// CAROUSEL (Últimos Assistidos)
// ─────────────────────────────────────────────

export const carouselCardHTML = (f, index) => `
    <div class="flex-shrink-0 mini-movie-card js-carousel-card" data-target-id="${f.id}" tabindex="0"
         style="animation:slideInRight 0.35s ease forwards;animation-delay:${index*70}ms;opacity:0;cursor:pointer;"
         title="Ver ${f.titulo}">
        <div class="mini-poster-wrapper mb-2">
            <img src="${getResizedUrl(f.posterUrl, 200)}" loading="lazy" decoding="async"
                 class="movie-poster-img" width="110" height="165" style="object-fit:cover;"
                 alt="${f.titulo}" onerror="this.style.display='none';">
            <div class="mini-date-badge">
                <i class="fas fa-calendar-check me-1"></i>
                ${f.dataAssistido ? new Date(f.dataAssistido.replace(/-/g,'/')).toLocaleDateString('pt-BR') : ''}
            </div>
        </div>
        <div class="text-truncate text-center fw-medium px-1 text-muted" style="font-size:0.8rem;">
            ${f.titulo}
        </div>
    </div>`;

export const carouselEmptyHTML = () =>
    `<div class="d-flex align-items-center justify-content-center w-100 p-4 text-muted border rounded"
          style="background:rgba(0,0,0,0.05);">
         <i class="fas fa-history me-2"></i> Nenhum filme assistido.
     </div>`;

// ─────────────────────────────────────────────
// RANKINGS (barras horizontais)
// ─────────────────────────────────────────────

export const rankingBarsHTML = (data) => {
    if (!data.length) return '<p class="text-muted small">N/A</p>';
    const max = Math.max(...data.map(d => d[1]));
    return data.map(([label, count]) => `
        <div class="ranking-bar-item mb-2">
            <span class="ranking-bar-label">${label}</span>
            <div class="ranking-bar-container">
                <div class="ranking-bar" style="width:${(count/max)*100}%" title="${label}: ${count}"></div>
            </div>
            <span class="ranking-bar-count">${count}</span>
        </div>`).join('');
};

// ─────────────────────────────────────────────
// MODAL DE DETALHES
// ─────────────────────────────────────────────

export const modalDetalhesHTML = (f) => {
    const htmlCapa = f.posterUrl && f.posterUrl !== 'N/A'
        ? `<div class="suggestion-poster me-md-4 mb-3 mb-md-0" style="flex:0 0 140px;max-width:140px;">
               <img src="${f.posterUrl}" style="width:100%;border-radius:8px;box-shadow:0 4px 15px rgba(0,0,0,0.5);">
           </div>`
        : '';

    const genres = f.genero?.length
        ? f.genero.map(g => `<span class="tag-pill" style="font-size:0.75rem;">${g}</span>`).join('')
        : '<span class="text-white-50 small">S/ Gênero</span>';

    const customTags = f.tags?.length
        ? f.tags.map(t => `<span class="badge border border-secondary text-secondary me-1"><i class="fas fa-hashtag me-1"></i>${t}</span>`).join('')
        : '';

    const statusTxt = f.assistido && f.dataAssistido
        ? `em ${new Date(f.dataAssistido.replace(/-/g,'/')).toLocaleDateString('pt-BR')}`
        : '';
    const statusIcon = f.assistido
        ? '<i class="fas fa-check-circle text-success"></i>'
        : '<i class="fas fa-clock text-warning"></i>';

    return `
        <div class="suggestion-layout" style="align-items:flex-start;">
            ${htmlCapa}
            <div class="suggestion-main-info" style="flex:1;min-width:0;text-align:left;">
                <p class="mt-3 mb-1"><strong class="text-white"><i class="fas fa-calendar me-2"></i>Ano:</strong> ${f.ano||'N/A'}</p>
                <p class="mb-1"><strong class="text-white"><i class="fas fa-video me-2"></i>Direção:</strong> ${f.direcao?.join(', ')||'N/A'}</p>
                <p class="mb-1"><strong class="text-white"><i class="fas fa-users me-2"></i>Artistas:</strong> ${f.atores?.join(', ')||'N/A'}</p>
                ${customTags ? `<div class="mt-2 mb-2">${customTags}</div>` : ''}
                <div class="mt-3 pt-3 border-top border-secondary text-white-50 small">
                    <strong class="text-white">Status:</strong> ${statusIcon} ${statusTxt}
                </div>
            </div>
            <div class="suggestion-side-info ms-md-2">
                <div class="suggestion-note">
                    <i class="fas fa-star text-warning"></i>
                    <span style="font-size:2.5rem;font-weight:700;">${(f.nota||0).toFixed(1)}</span>
                </div>
                <div class="suggestion-genres mt-2" style="display:flex;flex-wrap:wrap;justify-content:center;gap:0.5rem;">
                    ${genres}
                </div>
            </div>
        </div>
        ${f.sinopse
            ? `<div class="mt-3 pt-3" style="border-top:1px solid rgba(255,255,255,0.07);">
                   <p style="font-size:0.72rem;color:rgba(255,255,255,0.3);text-transform:uppercase;letter-spacing:0.07em;margin-bottom:6px;">
                       <i class="fas fa-align-left me-1"></i> Sinopse
                   </p>
                   <p style="font-size:0.82rem;color:rgba(255,255,255,0.55);line-height:1.6;margin:0;">${f.sinopse}</p>
               </div>`
            : '<div id="sinopse-box"></div>'}
        <div id="trailer-box" class="mt-4 w-100" style="min-height:50px;"></div>`;
};

// ─────────────────────────────────────────────
// MODAL DE SUGESTÃO ALEATÓRIA
// ─────────────────────────────────────────────

export const modalSugestaoHTML = (f) => {
    const htmlCapa = f.posterUrl && f.posterUrl !== 'N/A'
        ? `<div class="suggestion-poster me-md-4 mb-3 mb-md-0" style="flex:0 0 140px;max-width:140px;">
               <img src="${f.posterUrl}" style="width:100%;border-radius:8px;box-shadow:0 4px 15px rgba(0,0,0,0.5);">
           </div>`
        : '';

    const genres = f.genero?.length
        ? f.genero.map(g => `<span class="tag-pill" style="font-size:0.75rem;">${g}</span>`).join('')
        : '<span class="text-white-50 small">S/ Gênero</span>';

    const customTags = f.tags?.length
        ? f.tags.map(t => `<span class="badge border border-secondary text-secondary me-1"><i class="fas fa-hashtag me-1"></i>${t}</span>`).join('')
        : '';

    return `
        <div class="suggestion-layout" style="align-items:flex-start;">
            ${htmlCapa}
            <div class="suggestion-main-info" style="flex:1;min-width:0;text-align:left;">
                <h2 class="suggestion-title" style="font-size:1.8rem;line-height:1.2;margin-bottom:1rem;">${f.titulo}</h2>
                <p class="mb-1"><strong class="text-white"><i class="fas fa-calendar me-2"></i>Ano:</strong> ${f.ano||'N/A'}</p>
                <p class="mb-1"><strong class="text-white"><i class="fas fa-video me-2"></i>Direção:</strong> ${f.direcao?.join(', ')||'N/A'}</p>
                <p class="mb-1 text-truncate"><strong class="text-white"><i class="fas fa-users me-2"></i>Artistas:</strong> ${f.atores?.join(', ')||'N/A'}</p>
                ${customTags ? `<div class="mt-2 mb-2">${customTags}</div>` : ''}
            </div>
            <div class="suggestion-side-info ms-md-2">
                <div class="suggestion-note">
                    <i class="fas fa-star text-warning"></i>
                    <span style="font-size:2.5rem;font-weight:700;">${(f.nota||0).toFixed(1)}</span>
                </div>
                <div class="suggestion-genres mt-2" style="display:flex;flex-wrap:wrap;justify-content:center;gap:0.5rem;">
                    ${genres}
                </div>
            </div>
        </div>
        <div id="trailer-box-random" class="mt-4 w-100" style="min-height:50px;"></div>`;
};
