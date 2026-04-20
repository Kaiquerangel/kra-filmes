import { els } from './elements.js';

export const updatePreviewPoster = (url) => {
    const { previewImg: img, previewPlaceholder: placeholder } = els;
    img.onload = null; 
    img.onerror = null; 
    img.removeAttribute('data-tried-original');
    
    if (url && url !== 'N/A') {
        const hdUrl = url.replace(/_SX[0-9]+.*\./, "."); 
        img.src = hdUrl;
        
        img.onload = () => { 
            img.style.display = 'block'; 
            placeholder.style.display = 'none'; 
        };
        
        img.onerror = function() {
            if (!this.hasAttribute('data-tried-original')) { 
                this.setAttribute('data-tried-original', 'true'); 
                this.src = url; 
            } else { 
                this.style.display = 'none'; 
                placeholder.style.display = 'block'; 
            }
        };
    } else { 
        img.src = ''; 
        img.style.display = 'none'; 
        placeholder.style.display = 'block'; 
    }
};

export const toggleDataAssistido = (show) => {
    els.dataAssistidoGroup.style.display = show ? 'block' : 'none';
    const input = els.dataAssistidoGroup.querySelector('input');
    if (show) input.setAttribute('required', 'required'); 
    else { input.removeAttribute('required'); input.value = ''; }
};

export const renderGenerosTags = (generos, onRemove) => {
    if (!els.generoTagContainer) return;
    els.generoTagContainer.querySelectorAll('.tag-pill').forEach(el => el.remove());
    generos.slice().reverse().forEach(label => {
        const tagEl = document.createElement('span'); 
        tagEl.className = 'tag-pill';
        tagEl.innerHTML = `<span>${label}</span><button class="tag-remove-btn" aria-label="Remover gênero ${label}">&times;</button>`;
        tagEl.querySelector('button').addEventListener('click', () => onRemove(label));
        els.generoTagContainer.prepend(tagEl);
    });
};

export const renderCustomTags = (tags, onRemove) => {
    if (!els.tagsTagContainer) return;
    els.tagsTagContainer.querySelectorAll('.tag-pill-custom').forEach(el => el.remove());
    tags.slice().reverse().forEach(label => {
        const tagEl = document.createElement('span'); 
        tagEl.className = 'tag-pill-custom';
        tagEl.innerHTML = `<span><i class="fas fa-hashtag me-1" style="font-size: 0.7em;"></i>${label}</span><button class="tag-remove-btn" aria-label="Remover tag ${label}">&times;</button>`;
        tagEl.querySelector('button').addEventListener('click', () => onRemove(label));
        els.tagsTagContainer.prepend(tagEl);
    });
};

export const clearForm = () => {
    els.form.reset(); 
    els.form.classList.remove('was-validated'); 
    updatePreviewPoster(''); 
    toggleDataAssistido(false);
    
    const notaDisplay = document.getElementById('nota-display'); 
    if (notaDisplay) notaDisplay.innerHTML = `<i class="fas fa-star me-1"></i>0.0`;
    
    els.generoTagContainer.querySelectorAll('.tag-pill').forEach(el => el.remove());
    if (els.tagsTagContainer) els.tagsTagContainer.querySelectorAll('.tag-pill-custom').forEach(el => el.remove()); 
};

export const fillForm = (f, generosCallback, tagsCallback) => {
    document.getElementById('titulo').value = f.titulo; 
    document.getElementById('ano').value = f.ano;
    document.getElementById('nota').value = f.nota;
    
    const notaDisplay = document.getElementById('nota-display'); 
    if (notaDisplay) notaDisplay.innerHTML = `<i class="fas fa-star me-1"></i>${parseFloat(f.nota||0).toFixed(1)}`;
    
    document.getElementById('direcao').value = f.direcao?.join(', ') || ''; 
    document.getElementById('atores').value = f.atores?.join(', ') || '';
    document.getElementById('origem').value = f.origem || ""; 
    document.getElementById('assistido').value = f.assistido ? 'sim' : 'nao';
    
    toggleDataAssistido(f.assistido);
    if (f.assistido) document.getElementById('data-assistido').value = f.dataAssistido;
    
    updatePreviewPoster(f.posterUrl);
    if (f.genero && generosCallback) generosCallback(f.genero); 
    if (f.tags && tagsCallback) tagsCallback(f.tags);
};