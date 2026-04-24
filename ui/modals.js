import { templates } from './elements.js';
import { modalDetalhesHTML, modalSugestaoHTML } from './html-templates.js';

export const showMovieDetailModal = (f, onMarkWatched, onFetchTrailer) => {

        
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
        cancelButtonText: 'Fechar',
        customClass: { 
            popup: 'suggestion-swal-popup', 
            confirmButton: 'suggestion-deny-btn', 
            cancelButton: 'suggestion-cancel-btn' 
        },
        didOpen: () => {
            // Busca sinopse via OMDb se não estiver salva (filmes cadastrados antes desta feature)
            if (!f.sinopse) {
                const sinopseBox = document.getElementById('sinopse-box');
                if (sinopseBox && window._OMDB_KEY) {
                    fetch(`https://www.omdbapi.com/?t=${encodeURIComponent(f.titulo)}${f.ano?'&y='+f.ano:''}&apikey=${window._OMDB_KEY}`)
                        .then(r => r.json())
                        .then(data => {
                            if (data.Plot && data.Plot !== 'N/A' && sinopseBox) {
                                sinopseBox.innerHTML = `
                                    <div class="mt-3 pt-3" style="border-top:1px solid rgba(255,255,255,0.07);">
                                        <p style="font-size:0.72rem;color:rgba(255,255,255,0.3);text-transform:uppercase;letter-spacing:0.07em;margin-bottom:6px;">
                                            <i class="fas fa-align-left me-1"></i> Sinopse
                                        </p>
                                        <p style="font-size:0.82rem;color:rgba(255,255,255,0.55);line-height:1.6;margin:0;">${data.Plot}</p>
                                    </div>`;
                            }
                        }).catch(() => {});
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
        if(res.isConfirmed && onMarkWatched) onMarkWatched(f.id, !f.assistido); 
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