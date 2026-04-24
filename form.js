import { UI } from './ui.js';
import { MovieService } from './services.js';

const isValidPosterUrl = (url) => url && url.startsWith('http') && !url.includes(window.location.origin);

export const FormManager = {
    filmeEmEdicaoId: null,
    generosSelecionados: [],
    tagsSelecionadas: [],
    GENEROS_PREDEFINIDOS: [
        "Action", "Adventure", "Animation", "Comedy", "Crime", 
        "Documentary", "Drama", "Fantasy", "History", "Horror", 
        "Music", "Mystery", "Romance", "Science Fiction", 
        "Thriller", "War", "Western"
    ].sort(),

    init: (getUserId, getFilmes) => {
        FormManager.getUserId = getUserId; 
        FormManager.getFilmes = getFilmes; 

        const datalist = document.getElementById('generos-sugeridos');
        if (datalist) {
            datalist.innerHTML = FormManager.GENEROS_PREDEFINIDOS
                .map(g => `<option value="${g}"></option>`)
                .join('');
        }

        FormManager.setupListeners();
    },

    setupListeners: () => {
        const form = document.getElementById('filme-form'); 
        if (!form) return;
        
        document.getElementById('btn-buscar-omdb')?.addEventListener('click', FormManager.buscarOMDb);
        
        document.getElementById('titulo')?.addEventListener('keypress', e => { 
            if (e.key === 'Enter') { 
                e.preventDefault(); 
                FormManager.buscarOMDb(); 
            } 
        });

        // Autocomplete: busca automaticamente enquanto o usuário digita (debounce 600ms)
        let _autocompletTimer = null;
        document.getElementById('titulo')?.addEventListener('input', () => {
            clearTimeout(_autocompletTimer);
            const val = document.getElementById('titulo').value.trim();
            if (val.length < 3) return; // só busca a partir de 3 caracteres
            _autocompletTimer = setTimeout(() => {
                FormManager.buscarOMDb(true); // silencioso no autocomplete
            }, 600);
        });
        
        const inputGenero = document.getElementById('genero-input');
        inputGenero?.addEventListener('keydown', e => {
            if (e.key === 'Enter') { 
                e.preventDefault(); 
                FormManager.adicionarGenero(inputGenero.value); 
            }
            if (e.key === 'Backspace' && !inputGenero.value && FormManager.generosSelecionados.length) {
                FormManager.removerGenero(FormManager.generosSelecionados[FormManager.generosSelecionados.length - 1]);
            }
        });
        
        inputGenero?.addEventListener('input', () => { 
            if (FormManager.GENEROS_PREDEFINIDOS.includes(inputGenero.value)) {
                FormManager.adicionarGenero(inputGenero.value); 
            }
        });

        const inputTags = document.getElementById('tags-input');
        inputTags?.addEventListener('keydown', e => {
            if (e.key === 'Enter') { 
                e.preventDefault(); 
                FormManager.adicionarTag(inputTags.value); 
            }
            if (e.key === 'Backspace' && !inputTags.value && FormManager.tagsSelecionadas.length) {
                FormManager.removerTag(FormManager.tagsSelecionadas[FormManager.tagsSelecionadas.length - 1]);
            }
        });

        document.getElementById('assistido')?.addEventListener('change', e => { 
            UI.toggleDataAssistido(e.target.value === 'sim'); 
        });

        form.addEventListener('submit', async (e) => {
            e.preventDefault(); 
            if (!form.checkValidity()) { 
                form.classList.add('was-validated'); 
                return; 
            }
            
            const assistido = document.getElementById('assistido').value === 'sim';
            const imgPreviewSrc = document.getElementById('poster-preview-img').src;
            
            const finalPosterUrl = isValidPosterUrl(imgPreviewSrc) ? imgPreviewSrc : '';
            
            const dados = {
                titulo: document.getElementById('titulo').value.trim(),
                ano: parseInt(document.getElementById('ano').value) || null,
                nota: parseFloat(document.getElementById('nota').value) || 0,
                direcao: document.getElementById('direcao').value.split(',').filter(Boolean).map(s => s.trim()),
                atores: document.getElementById('atores').value.split(',').filter(Boolean).map(s => s.trim()),
                genero: [...FormManager.generosSelecionados], 
                tags: [...FormManager.tagsSelecionadas],
                origem: document.getElementById('origem').value, 
                assistido: assistido,
                dataAssistido: assistido ? document.getElementById('data-assistido').value : null,
                posterUrl: finalPosterUrl,
                sinopse: document.getElementById('sinopse-hidden')?.value || ''
            };

            const btnSubmit = form.querySelector('button[type="submit"]');
            const originalText = btnSubmit.innerHTML; 
            
            btnSubmit.innerHTML = 'Salvando...'; 
            btnSubmit.disabled = true;
            
            try {
                const uid = FormManager.getUserId();
                if (!uid) throw new Error("Usuário não autenticado.");

                await MovieService.save(uid, dados, FormManager.filmeEmEdicaoId);
                UI.toast('Salvo com sucesso!'); 
                UI.clearForm(); 
                FormManager.generosSelecionados = []; 
                FormManager.tagsSelecionadas = []; 
                FormManager.filmeEmEdicaoId = null;
                document.getElementById('cadastro-titulo').innerHTML = '<i class="fas fa-edit me-2"></i> Cadastro de Filme';
            } catch(err) { 
                UI.alert('Erro', err.message, 'error'); 
            } finally { 
                btnSubmit.innerHTML = originalText; 
                btnSubmit.disabled = false; 
            }
        });
    },

    buscarOMDb: async (silencioso = false) => {
        const titulo = document.getElementById('titulo').value; 
        const ano = document.getElementById('ano').value;
        
        if (!titulo) return;
        
        document.getElementById('api-loading').style.display = 'flex';
        
        try {
            const data = await MovieService.searchOMDb(titulo, ano);
            let posterOriginal = data.Poster;
            
            if (posterOriginal && posterOriginal !== 'N/A') {
                posterOriginal = posterOriginal.replace(/_SX[0-9]+.*\./, ".");
            }

            document.getElementById('titulo').value = data.Title;
            document.getElementById('ano').value = parseInt(data.Year) || '';
            
            // CORREÇÃO: Tratamento estrito do parseFloat para evitar que nota 0 fique vazia
            const rating = parseFloat(data.imdbRating);
            document.getElementById('nota').value = !isNaN(rating) ? rating : '';

            document.getElementById('direcao').value = data.Director !== 'N/A' ? data.Director : '';
            document.getElementById('atores').value = data.Actors !== 'N/A' ? data.Actors : '';
            
            if (data.Country) {
                document.getElementById('origem').value = data.Country.includes("Brazil") ? "Nacional" : "Internacional";
            }
            
            UI.updatePreviewPoster(posterOriginal !== 'N/A' ? posterOriginal : '');
            
            FormManager.generosSelecionados = []; 
            if (data.Genre !== 'N/A') {
                data.Genre.split(', ').forEach(g => FormManager.adicionarGenero(g));
            }
            
            // Salva sinopse em campo oculto para persistir no Firestore
            const sinopseField = document.getElementById('sinopse-hidden');
            if (sinopseField) sinopseField.value = (data.Plot && data.Plot !== 'N/A') ? data.Plot : '';

            if (!silencioso) UI.toast('Filme encontrado!');
        } catch(err) { 
            console.log("Não encontrado automaticamente", err); 
        } finally { 
            document.getElementById('api-loading').style.display = 'none'; 
        }
    },

    adicionarGenero: (genero) => {
        const limpo = genero.trim(); 
        if (limpo && !FormManager.generosSelecionados.includes(limpo)) {
            FormManager.generosSelecionados.push(limpo); 
            UI.renderGenerosTags(FormManager.generosSelecionados, FormManager.removerGenero); 
            document.getElementById('genero-input').value = '';
        }
    },

    removerGenero: (genero) => {
        FormManager.generosSelecionados = FormManager.generosSelecionados.filter(g => g !== genero); 
        UI.renderGenerosTags(FormManager.generosSelecionados, FormManager.removerGenero); 
    },

    adicionarTag: (tag) => {
        const limpo = tag.trim(); 
        if (limpo && !FormManager.tagsSelecionadas.includes(limpo)) {
            FormManager.tagsSelecionadas.push(limpo); 
            UI.renderCustomTags(FormManager.tagsSelecionadas, FormManager.removerTag); 
            document.getElementById('tags-input').value = '';
        }
    },

    removerTag: (tag) => {
        FormManager.tagsSelecionadas = FormManager.tagsSelecionadas.filter(t => t !== tag); 
        UI.renderCustomTags(FormManager.tagsSelecionadas, FormManager.removerTag); 
    },

    carregarParaEdicao: (id) => {
        const filmes = FormManager.getFilmes();
        const filme = filmes.find(x => x.id === id); 
        if (!filme) return;
        
        FormManager.filmeEmEdicaoId = id; 
        document.getElementById('cadastro-titulo').innerHTML = `Editando: ${filme.titulo}`;
        
        FormManager.generosSelecionados = filme.genero ? [...filme.genero] : [];
        FormManager.tagsSelecionadas = filme.tags ? [...filme.tags] : [];
        const sinopseHidden = document.getElementById('sinopse-hidden');
        if (sinopseHidden) sinopseHidden.value = filme.sinopse || '';
        
        UI.fillForm(
            filme, 
            (generos) => UI.renderGenerosTags(generos, FormManager.removerGenero), 
            (tags) => UI.renderCustomTags(tags, FormManager.removerTag)
        );
        
        const sectionCadastro = document.getElementById('cadastro-section');
        if (sectionCadastro && sectionCadastro.style.display === 'none') {
            sectionCadastro.style.display = 'block';
            sectionCadastro.style.animation = 'fadeInUp 0.4s ease-out forwards';
        }
        document.getElementById('cadastro-section').scrollIntoView({ behavior: 'smooth', block: 'start' });
    },

    // Chamado ao fechar o formulário sem salvar — limpa estado de edição
    cancelarEdicao: () => {
        FormManager.filmeEmEdicaoId = null;
        FormManager.generosSelecionados = [];
        FormManager.tagsSelecionadas = [];
        UI.clearForm?.();
        const titulo = document.getElementById('cadastro-titulo');
        if (titulo) titulo.innerHTML = '<i class="fas fa-edit me-2"></i> Cadastre Seu Filme';
    }
};