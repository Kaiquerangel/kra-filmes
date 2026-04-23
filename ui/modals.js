import { templates } from './elements.js';
import { modalDetalhesHTML, modalSugestaoHTML } from './html-templates.js';

export const showMovieDetailModal = (f, onMarkWatched, onFetchTrailer) => {

        
    Swal.fire({
        title: f.titulo, 
        showCloseButton: true, 
        width: '800px',
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
    }).then(res => { 
        if(res.isConfirmed && onMarkWatched) onMarkWatched(f.id, !f.assistido); 
    });
};

export const showRandomSuggestion = (f, onMark, onRetry, onFetchTrailer) => {


    Swal.fire({
        title: 'Que tal assistir...', 
        showCloseButton: true, 
        width: '800px',
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