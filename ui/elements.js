import { getResizedUrl } from './helpers.js';

export const els = {
    body: document.body, appContent: document.getElementById('app-content'), authContainer: document.getElementById('auth-container'),
    logoutContainer: document.getElementById('logout-container'), welcomeMsg: document.getElementById('welcome-message'), navLinks: document.querySelectorAll('.app-nav'), 
    themeBtn: document.getElementById('theme-toggle'), tabelaTodos: document.getElementById('tabela-todos-container'), tabelaAssistidos: document.getElementById('tabela-assistidos-container'),
    tabelaNaoAssistidos: document.getElementById('tabela-nao-assistidos-container'), form: document.getElementById('filme-form'), previewImg: document.getElementById('poster-preview-img'), 
    previewPlaceholder: document.getElementById('poster-placeholder'), generoTagContainer: document.getElementById('genero-tag-container'), generoInput: document.getElementById('genero-input'),
    tagsTagContainer: document.getElementById('tags-tag-container'), tagsInput: document.getElementById('tags-input'), dataAssistidoGroup: document.getElementById('data-assistido-group'), 
    statTotal: document.getElementById('stat-total-filmes'), statMedia: document.getElementById('stat-media-notas'), statPctNac: document.getElementById('stat-pct-nacionais'),
    statPctInt: document.getElementById('stat-pct-internacionais'), statDecada: document.getElementById('stat-decada-popular'), statAtor: document.getElementById('stat-ator-frequente'), 
    statMelhor: document.getElementById('stat-melhor-filme'), statPior: document.getElementById('stat-pior-filme'), perfilNome: document.getElementById('perfil-nome'),
    perfilNick: document.getElementById('perfil-nickname'), perfilDesde: document.getElementById('perfil-membro-desde'), perfilTotal: document.getElementById('perfil-total-filmes'), 
    perfilAssistidos: document.getElementById('perfil-total-assistidos'), conquistasContainer: document.getElementById('conquistas-container')
};

export const templates = {
    poster: (url, cssClass = 'poster-thumb', alt = 'Capa') => {
        if (url && url !== 'N/A') {
            const isSmallView = cssClass === 'poster-thumb' || cssClass === 'movie-poster-img';
            const finalSrc = isSmallView ? getResizedUrl(url, 250) : url;
            const sizeAttr = cssClass === 'poster-thumb' ? 'width="40" height="60"' : '';
            return `<img src="${finalSrc}" ${sizeAttr} loading="lazy" decoding="async" class="${cssClass}" alt="${alt}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex'">
                    <div class="${cssClass} d-flex align-items-center justify-content-center bg-dark text-muted" style="display:none !important;"><i class="fas fa-film ${cssClass === 'movie-poster-img' ? 'fa-3x' : ''}"></i></div>`;
        }
        return `<div class="${cssClass} d-flex align-items-center justify-content-center bg-dark text-muted"><i class="fas fa-film ${cssClass === 'movie-poster-img' ? 'fa-3x' : ''}"></i></div>`;
    },
    date: (dateString) => dateString ? new Date(dateString.replace(/-/g, '/')).toLocaleDateString('pt-BR') : '<i class="far fa-clock ms-1 text-muted"></i>',
    statusIcon: (assistido) => assistido ? '<i class="fas fa-check-circle text-success" title="Assistido"></i>' : '<i class="fas fa-clock text-warning" title="Para Assistir"></i>'
};