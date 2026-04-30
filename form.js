import { UI } from './ui.js';
import { MovieService } from './services.js';

const isValidPosterUrl = (url) => url && url.startsWith('http') && !url.includes(window.location.origin);

// Validação robusta dos campos antes de salvar
function validarCampos(dados) {
    const erros = [];

    if (!dados.titulo?.trim())
        erros.push('Título é obrigatório.');
    else if (dados.titulo.trim().length > 200)
        erros.push('Título deve ter no máximo 200 caracteres.');

    if (dados.ano != null && dados.ano !== '') {
        const ano = parseInt(dados.ano);
        if (isNaN(ano) || ano < 1888 || ano > new Date().getFullYear() + 5)
            erros.push(`Ano inválido. Deve ser entre 1888 e ${new Date().getFullYear() + 5}.`);
    }

    if (dados.nota != null && dados.nota !== '') {
        const nota = parseFloat(dados.nota);
        if (isNaN(nota) || nota < 0 || nota > 10)
            erros.push('Nota deve ser entre 0 e 10.');
    }

    if (dados.assistido && !dados.dataAssistido)
        erros.push('Informe a data em que assistiu o filme.');

    if (dados.assistido && dados.dataAssistido) {
        const data = new Date(dados.dataAssistido);
        if (isNaN(data.getTime()) || data > new Date())
            erros.push('Data assistido inválida ou no futuro.');
    }

    return erros;
}

const TMDB_KEY = ''; // Deixe vazio — usa fallback automático
const TMDB_BASE = 'https://api.themoviedb.org/3';

// Busca sinopse PT-BR: TMDB (por imdbID) → OMDb em inglês como fallback
async function buscarSinopsePtBr(imdbId) {
    if (!imdbId) return '';
    try {
        // 1. Busca o filme no TMDB pelo ID do IMDb
        const findRes = await fetch(
            `${TMDB_BASE}/find/${imdbId}?api_key=${window._TMDB_KEY || TMDB_KEY}&external_source=imdb_id&language=pt-BR`
        );
        const findData = await findRes.json();
        const tmdbFilme = findData.movie_results?.[0];
        if (!tmdbFilme) return '';

        // 2. Busca detalhes em PT-BR
        const detRes = await fetch(
            `${TMDB_BASE}/movie/${tmdbFilme.id}?api_key=${window._TMDB_KEY || TMDB_KEY}&language=pt-BR`
        );
        const detData = await detRes.json();

        // 3. Retorna overview PT-BR se disponível e não vazio
        if (detData.overview && detData.overview.trim().length > 20) {
            return detData.overview;
        }

        // 4. Fallback: overview em inglês
        const engRes = await fetch(
            `${TMDB_BASE}/movie/${tmdbFilme.id}?api_key=${window._TMDB_KEY || TMDB_KEY}&language=en-US`
        );
        const engData = await engRes.json();
        return engData.overview || '';
    } catch (e) {
        console.warn('[Sinopse] Falha no TMDB:', e.message);
        return '';
    }
}

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

        // Busca de sugestões — lista de filmes para o usuário escolher
        let _sugTimer = null;
        let _sugAberto = false;

        const inputTitulo = document.getElementById('titulo');

        function fecharSugestoes() {
            const box = document.getElementById('sugestoes-box');
            if (box) box.remove();
            _sugAberto = false;
        }

        function criarSugestaoItem(filme) {
            const item = document.createElement('div');
            item.className = 'sug-item';
            item.style.cssText = `display:flex;align-items:center;gap:10px;padding:8px 12px;
                cursor:pointer;border-bottom:1px solid rgba(255,255,255,0.05);transition:background 0.12s;`;

            const poster = filme.Poster && filme.Poster !== 'N/A'
                ? `<img src="${filme.Poster}" style="width:32px;height:48px;object-fit:cover;border-radius:3px;flex-shrink:0;">`
                : `<div style="width:32px;height:48px;background:rgba(255,255,255,0.06);border-radius:3px;flex-shrink:0;display:flex;align-items:center;justify-content:center;"><i class="fas fa-film" style="font-size:0.6rem;color:rgba(255,255,255,0.2);"></i></div>`;

            item.innerHTML = `
                ${poster}
                <div style="min-width:0;flex:1;">
                    <div style="font-size:0.85rem;font-weight:600;color:rgba(255,255,255,0.92);
                                white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                        ${filme.Title}
                    </div>
                    <div style="font-size:0.72rem;color:rgba(255,255,255,0.4);margin-top:2px;">
                        ${filme.Year || ''}
                    </div>
                </div>
                <i class="fas fa-chevron-right" style="font-size:0.65rem;color:rgba(255,255,255,0.2);flex-shrink:0;"></i>`;

            item.addEventListener('mouseenter', () => item.style.background = 'rgba(59,130,246,0.12)');
            item.addEventListener('mouseleave', () => item.style.background = '');

            item.addEventListener('click', async () => {
                fecharSugestoes();
                if (inputTitulo) inputTitulo.value = filme.Title;
                // Busca detalhes completos pelo imdbID
                document.getElementById('api-loading').style.display = 'flex';
                try {
                    const data = await MovieService.getOMDbById(filme.imdbID);
                    await FormManager.preencherComDados(data);
                    UI.toast('Filme encontrado!');
                } catch(e) {
                    UI.toast('Erro ao carregar detalhes.', 'error');
                } finally {
                    document.getElementById('api-loading').style.display = 'none';
                }
            });

            return item;
        }

        async function mostrarSugestoes(query) {
            fecharSugestoes();
            const resultados = await MovieService.searchOMDbSugestoes(query);
            if (!resultados.length || !inputTitulo) return;

            const rect = inputTitulo.getBoundingClientRect();
            const box  = document.createElement('div');
            box.id = 'sugestoes-box';
            box.style.cssText = `position:fixed;top:${rect.bottom + 4}px;left:${rect.left}px;
                width:${Math.max(rect.width, 340)}px;max-height:320px;overflow-y:auto;
                background:#1a2235;border:1px solid rgba(255,255,255,0.12);border-radius:10px;
                box-shadow:0 8px 32px rgba(0,0,0,0.5);z-index:99999;`;

            // Header
            const header = document.createElement('div');
            header.style.cssText = `padding:8px 12px;font-size:0.68rem;color:rgba(255,255,255,0.35);
                text-transform:uppercase;letter-spacing:0.06em;border-bottom:1px solid rgba(255,255,255,0.06);
                display:flex;justify-content:space-between;align-items:center;`;
            header.innerHTML = `<span>${resultados.length} resultado${resultados.length > 1 ? 's' : ''} para "${query}"</span>
                <button onclick="document.getElementById('sugestoes-box')?.remove()"
                    style="background:none;border:none;color:rgba(255,255,255,0.3);cursor:pointer;font-size:0.75rem;">✕</button>`;
            box.appendChild(header);

            resultados.forEach(f => box.appendChild(criarSugestaoItem(f)));

            // Footer — opção de busca manual
            const footer = document.createElement('div');
            footer.style.cssText = `padding:8px 12px;font-size:0.75rem;color:rgba(255,255,255,0.35);
                text-align:center;border-top:1px solid rgba(255,255,255,0.06);cursor:pointer;
                transition:color 0.12s;`;
            footer.innerHTML = `<i class="fas fa-keyboard me-1"></i>Não é o que procura? <span style="color:#60a5fa;">Preencha manualmente</span>`;
            footer.addEventListener('click', () => {
                fecharSugestoes();
                if (inputTitulo) inputTitulo.focus();
            });
            box.appendChild(footer);

            document.body.appendChild(box);
            _sugAberto = true;

            // Fecha ao clicar fora
            setTimeout(() => {
                document.addEventListener('click', function handler(e) {
                    if (!box.contains(e.target) && e.target !== inputTitulo) {
                        fecharSugestoes();
                        document.removeEventListener('click', handler);
                    }
                });
            }, 100);
        }

        inputTitulo?.addEventListener('input', () => {
            clearTimeout(_sugTimer);
            const val = inputTitulo.value.trim();

            if (val.length < 2) { fecharSugestoes(); return; }

            // IMDb URL — busca direto sem mostrar sugestões
            if (/tt\d{7,8}/.test(val)) {
                fecharSugestoes();
                _sugTimer = setTimeout(() => FormManager.buscarOMDb(false), 300);
                return;
            }

            // Sugestões a partir de 2 caracteres, debounce 500ms
            _sugTimer = setTimeout(() => mostrarSugestoes(val), 500);
        });

        inputTitulo?.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') fecharSugestoes();
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
            
            // Validação extra antes de salvar
            const tituloVal = document.getElementById('titulo').value.trim();
            const anoVal    = parseInt(document.getElementById('ano').value) || null;
            const notaVal   = parseFloat(document.getElementById('nota').value) || 0;

            if (!tituloVal) return UI.alert('Atenção', 'O título é obrigatório.', 'warning');
            if (tituloVal.length > 200) return UI.alert('Atenção', 'Título muito longo (máx. 200 caracteres).', 'warning');
            if (anoVal && (anoVal < 1888 || anoVal > 2100)) return UI.alert('Atenção', 'Ano inválido. Cinema existe desde 1888.', 'warning');
            if (notaVal < 0 || notaVal > 10) return UI.alert('Atenção', 'Nota deve ser entre 0 e 10.', 'warning');

            const dados = {
                titulo: tituloVal,
                ano: anoVal,
                nota: notaVal,
                direcao: document.getElementById('direcao').value.split(',').filter(Boolean).map(s => s.trim()),
                atores: document.getElementById('atores').value.split(',').filter(Boolean).map(s => s.trim()),
                genero: [...FormManager.generosSelecionados], 
                tags: [...FormManager.tagsSelecionadas],
                origem: document.getElementById('origem').value, 
                assistido: assistido,
                dataAssistido: assistido ? document.getElementById('data-assistido').value : null,
                posterUrl: finalPosterUrl,
                sinopse: document.getElementById('sinopse-hidden')?.value || '',
                imdbId:  document.getElementById('imdb-id-hidden')?.value || '',
                pais:    document.getElementById('pais-hidden')?.value || ''
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

    preencherComDados: async (data) => {
        let posterOriginal = data.Poster;
        if (posterOriginal && posterOriginal !== 'N/A') {
            posterOriginal = posterOriginal.replace(/_SX[0-9]+.*\./, ".");
        }
        document.getElementById('titulo').value = data.Title || '';
        document.getElementById('ano').value = parseInt(data.Year) || '';
        const rating = parseFloat(data.imdbRating);
        document.getElementById('nota').value = !isNaN(rating) ? rating : '';
        document.getElementById('direcao').value = data.Director !== 'N/A' ? data.Director : '';
        document.getElementById('atores').value = data.Actors !== 'N/A' ? data.Actors : '';
        if (data.Country) {
            document.getElementById('origem').value = data.Country.includes("Brazil") ? "Nacional" : "Internacional";
        }
        UI.updatePreviewPoster(posterOriginal && posterOriginal !== 'N/A' ? posterOriginal : '');
        FormManager.generosSelecionados = [];
        if (data.Genre && data.Genre !== 'N/A') {
            data.Genre.split(', ').forEach(g => FormManager.adicionarGenero(g));
        }
        const imdbIdField = document.getElementById('imdb-id-hidden');
        if (imdbIdField) imdbIdField.value = data.imdbID || '';
        const sinopseField = document.getElementById('sinopse-hidden');
        if (sinopseField && data.imdbID) {
            buscarSinopsePtBr(data.imdbID).then(s => { if (sinopseField) sinopseField.value = s || ''; });
        }
    },

    buscarOMDb: async (silencioso = false) => {
        const titulo = document.getElementById('titulo').value; 
        const ano = document.getElementById('ano').value;
        
        if (!titulo) return;
        
        document.getElementById('api-loading').style.display = 'flex';
        
        try {
            const data = await MovieService.searchOMDb(titulo, ano);
            await FormManager.preencherComDados(data);
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
        const imdbIdHidden = document.getElementById('imdb-id-hidden');
        if (imdbIdHidden) imdbIdHidden.value = filme.imdbId || '';
        const paisHid = document.getElementById('pais-hidden');
        if (paisHid) paisHid.value = filme.pais || '';
        
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
        const sinopseHidden = document.getElementById('sinopse-hidden');
        const imdbIdHidden  = document.getElementById('imdb-id-hidden');
        if (sinopseHidden) sinopseHidden.value = '';
        if (imdbIdHidden)  imdbIdHidden.value  = '';
        const paisHidden = document.getElementById('pais-hidden');
        if (paisHidden) paisHidden.value = '';
        UI.clearForm?.();
        const titulo = document.getElementById('cadastro-titulo');
        if (titulo) titulo.innerHTML = '<i class="fas fa-edit me-2"></i> Cadastre Seu Filme';
    }
};