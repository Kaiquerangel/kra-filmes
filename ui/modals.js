import { templates } from './elements.js';

export const showMovieDetailModal = (f, onMarkWatched, onFetchTrailer) => {
    const htmlCapa = f.posterUrl && f.posterUrl !== 'N/A' 
        ? `<div class="suggestion-poster me-md-4 mb-3 mb-md-0" style="flex:0 0 140px;max-width:140px;"><img src="${f.posterUrl}" style="width:100%;border-radius:8px;box-shadow:0 4px 15px rgba(0,0,0,0.5);"></div>` 
        : '';
        
    const genres = f.genero?.length 
        ? f.genero.map(g => `<span class="tag-pill" style="font-size:0.75rem;">${g}</span>`).join('') 
        : '<span class="text-white-50 small">S/ Gênero</span>';
        
    const customTags = f.tags?.length 
        ? f.tags.map(t => `<span class="badge border border-secondary text-secondary me-1"><i class="fas fa-hashtag me-1"></i>${t}</span>`).join('') 
        : '';
        
    Swal.fire({
        title: f.titulo, 
        showCloseButton: true, 
        width: '800px',
        html: `
            <div class="suggestion-layout" style="align-items:flex-start;">
                ${htmlCapa}
                <div class="suggestion-main-info" style="flex:1;min-width:0;text-align:left;">
                    <p class="mt-3 mb-1"><strong class="text-white"><i class="fas fa-calendar me-2"></i>Ano:</strong> ${f.ano||'N/A'}</p>
                    <p class="mb-1"><strong class="text-white"><i class="fas fa-video me-2"></i>Direção:</strong> ${f.direcao?.join(', ')||'N/A'}</p>
                    <p class="mb-1"><strong class="text-white"><i class="fas fa-users me-2"></i>Atores:</strong> ${f.atores?.join(', ')||'N/A'}</p>
                    ${customTags ? `<div class="mt-2 mb-2">${customTags}</div>` : ''}
                    <div class="mt-3 pt-3 border-top border-secondary text-white-50 small">
                        <strong class="text-white">Status:</strong> ${templates.statusIcon(f.assistido)} ${f.assistido && f.dataAssistido ? `em ${templates.date(f.dataAssistido)}` : ''}
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
            <div id="trailer-box" class="mt-4 w-100" style="min-height: 50px;"></div>
        `,
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
    const htmlCapa = f.posterUrl && f.posterUrl !== 'N/A' 
        ? `<div class="suggestion-poster me-md-4 mb-3 mb-md-0" style="flex:0 0 140px;max-width:140px;"><img src="${f.posterUrl}" style="width:100%;border-radius:8px;box-shadow:0 4px 15px rgba(0,0,0,0.5);"></div>` 
        : '';
        
    const genres = f.genero?.length 
        ? f.genero.map(g => `<span class="tag-pill" style="font-size:0.75rem;">${g}</span>`).join('') 
        : '<span class="text-white-50 small">S/ Gênero</span>';
        
    const customTags = f.tags?.length 
        ? f.tags.map(t => `<span class="badge border border-secondary text-secondary me-1"><i class="fas fa-hashtag me-1"></i>${t}</span>`).join('') 
        : '';

    Swal.fire({
        title: 'Que tal assistir...', 
        showCloseButton: true, 
        width: '800px',
        html: `
            <div class="suggestion-layout" style="align-items:flex-start;">
                ${htmlCapa}
                <div class="suggestion-main-info" style="flex:1;min-width:0;text-align:left;">
                    <h2 class="suggestion-title" style="font-size:1.8rem;line-height:1.2;margin-bottom:1rem;">${f.titulo}</h2>
                    <p class="mb-1"><strong class="text-white"><i class="fas fa-calendar me-2"></i>Ano:</strong> ${f.ano||'N/A'}</p>
                    <p class="mb-1"><strong class="text-white"><i class="fas fa-video me-2"></i>Direção:</strong> ${f.direcao?.join(', ')||'N/A'}</p>
                    <p class="mb-1 text-truncate"><strong class="text-white"><i class="fas fa-users me-2"></i>Atores:</strong> ${f.atores?.join(', ')||'N/A'}</p>
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
            <div id="trailer-box-random" class="mt-4 w-100" style="min-height: 50px;"></div>
        `,
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