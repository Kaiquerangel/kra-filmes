import { templates } from './elements.js';

const TMDB_BASE = 'https://api.themoviedb.org/3';

// Busca sinopse PT-BR: tenta TMDB por imdbId, depois por título, depois OMDb EN
async function _buscarSinopseModal(f) {
    const key = window._TMDB_KEY;
    const omdbKey = window._OMDB_KEY;

    // Se não tem chave TMDB, pula para OMDb direto
    if (!key && !omdbKey) return '';

    // Estratégia 1: TMDB por imdbId (mais preciso, não depende de tradução do título)
    if (key && f.imdbId) {
        try {
            const r = await fetch(`${TMDB_BASE}/find/${f.imdbId}?api_key=${key}&external_source=imdb_id&language=pt-BR`);
            const d = await r.json();
            const filme = d.movie_results?.[0];
            if (filme?.id) {
                const det = await fetch(`${TMDB_BASE}/movie/${filme.id}?api_key=${key}&language=pt-BR`);
                const dd  = await det.json();
                if (dd.overview?.trim().length > 20) return dd.overview;
                // Fallback EN no mesmo filme
                const eng = await fetch(`${TMDB_BASE}/movie/${filme.id}?api_key=${key}&language=en-US`);
                const de  = await eng.json();
                if (de.overview?.trim()) return de.overview;
            }
        } catch(e) {}
    }

    // Estratégia 2: TMDB por título + ano (filmes sem imdbId salvo)
    if (key && f.titulo) {
        try {
            const q = encodeURIComponent(f.titulo);
            const r = await fetch(`${TMDB_BASE}/search/movie?api_key=${key}&query=${q}${f.ano?'&year='+f.ano:''}&language=pt-BR`);
            const d = await r.json();
            const filme = d.results?.[0];
            if (filme?.id) {
                const det = await fetch(`${TMDB_BASE}/movie/${filme.id}?api_key=${key}&language=pt-BR`);
                const dd  = await det.json();
                if (dd.overview?.trim().length > 20) return dd.overview;
            }
        } catch(e) {}
    }

    // Estratégia 3: OMDb em inglês (último recurso)
    if (omdbKey && f.titulo) {
        try {
            const url = f.imdbId
                ? `https://www.omdbapi.com/?i=${f.imdbId}&apikey=${omdbKey}`
                : `https://www.omdbapi.com/?t=${encodeURIComponent(f.titulo)}${f.ano?'&y='+f.ano:''}&apikey=${omdbKey}`;
            const r = await fetch(url);
            const d = await r.json();
            if (d.Plot && d.Plot !== 'N/A') return d.Plot;
        } catch(e) {}
    }

    return '';
}
import { modalDetalhesHTML, modalSugestaoHTML } from './html-templates.js';

export const showMovieDetailModal = (f, onMarkWatched, onFetchTrailer, onSaveSinopse, onReavaliar) => {

        
    Swal.fire({
        title: f.titulo, 
        showCloseButton: true, 
        width: 'min(800px, 95vw)',
        html: modalDetalhesHTML(f),
        showConfirmButton: !!onMarkWatched, 
        showCancelButton: true, 
        confirmButtonText: f.assistido 
            ? '<i class="fas fa-times-circle me-1"></i> Desmarcar Assistido'
            : '<i class="fas fa-check-circle me-1"></i> Marcar Assistido',
        showDenyButton: f.assistido && !!f.nota,
        denyButtonText: '<i class="fas fa-star me-1"></i> Reavaliar', 
        cancelButtonText: 'Fechar',
        customClass: { 
            popup: 'suggestion-swal-popup', 
            confirmButton: 'suggestion-deny-btn', 
            cancelButton: 'suggestion-cancel-btn' 
        },
        didOpen: () => {
            // Busca sinopse PT-BR via TMDB para filmes sem sinopse salva
            if (!f.sinopse) {
                const sinopseBox = document.getElementById('sinopse-box');
                if (sinopseBox) {
                    _buscarSinopseModal(f).then(texto => {
                        if (!texto || !Swal.isVisible()) return;

                        // Exibe no modal
                        if (sinopseBox) {
                            sinopseBox.innerHTML = `
                                <div class="mt-3 pt-3" style="border-top:1px solid rgba(255,255,255,0.07);">
                                    <p style="font-size:0.72rem;color:rgba(255,255,255,0.3);text-transform:uppercase;
                                               letter-spacing:0.07em;margin-bottom:6px;">
                                        <i class="fas fa-align-left me-1"></i> Sinopse
                                    </p>
                                    <p style="font-size:0.82rem;color:rgba(255,255,255,0.55);line-height:1.6;margin:0;">
                                        ${texto}
                                    </p>
                                </div>`;
                        }

                        // Salva no Firestore para não buscar de novo na próxima abertura
                        if (onSaveSinopse) onSaveSinopse(f.id, texto);
                    });
                }
            }

            if (onFetchTrailer) {
                const box = document.getElementById('trailer-box');
                if (!Swal.isVisible()) return;
                if (box) box.innerHTML = '<div class="text-center text-white-50 small my-3"><i class="fas fa-spinner fa-spin me-2"></i>Buscando trailer...</div>';
                onFetchTrailer(f.titulo, f.ano).then(videoId => {
                    if (!Swal.isVisible()) return;
                    if (videoId && box) {
                        box.innerHTML = `<div class="ratio ratio-16x9 rounded overflow-hidden shadow"><iframe src="https://www.youtube.com/embed/${videoId}?rel=0" allowfullscreen></iframe></div>`;
                    } else if (box) {
                        box.innerHTML = '<div class="text-center text-white-50 small my-3"><i class="fas fa-video-slash me-2"></i>Trailer indisponível</div>';
                    }
                });
            }
        }
    }).then(res => {
        if (res.isConfirmed && onMarkWatched) onMarkWatched(f.id, !f.assistido);
        if (res.isDenied && onReavaliar)      onReavaliar(f);
    });
};

export const showRandomSuggestion = (f, onMark, onRetry, onFetchTrailer) => {


    Swal.fire({
        title: 'Que tal assistir...', 
        showCloseButton: true, 
        width: 'min(800px, 95vw)',
        html: modalSugestaoHTML(f),
        showCancelButton: true, 
        cancelButtonText: 'Sugerir outro', 
        showDenyButton: !!onMark, 
        denyButtonText: '<i class="fas fa-check-circle me-1"></i> Marcar assistido', 
        confirmButtonText: 'Ótima ideia!',
        customClass: { 
            popup: 'suggestion-swal-popup', 
            confirmButton: 'suggestion-confirm-btn', 
            cancelButton: 'suggestion-cancel-btn', 
            denyButton: 'suggestion-deny-btn' 
        },
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
};