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
            item.style.cssText = `
                display:flex;align-items:center;gap:12px;padding:8px 10px;
                border-radius:10px;cursor:pointer;transition:background 0.13s;
                position:relative;overflow:hidden;`;

            const temPoster = filme.Poster && filme.Poster !== 'N/A';
            const poster = temPoster
                ? `<div style="width:38px;height:56px;border-radius:7px;overflow:hidden;flex-shrink:0;
                              border:1px solid rgba(255,255,255,0.06);">
                      <img src="${filme.Poster}" style="width:100%;height:100%;object-fit:cover;">
                   </div>`
                : `<div style="width:38px;height:56px;border-radius:7px;flex-shrink:0;
                              background:#1e2a3a;border:1px solid rgba(255,255,255,0.06);
                              display:flex;align-items:center;justify-content:center;">
                      <i class="fas fa-film" style="font-size:0.85rem;color:rgba(255,255,255,0.12);"></i>
                   </div>`;

            const isTmdb = filme._tmdbId != null;
            const badge  = isTmdb
                ? `<span style="font-size:0.6rem;padding:1px 5px;border-radius:4px;font-weight:600;
                               text-transform:uppercase;letter-spacing:0.05em;
                               background:rgba(1,180,228,0.12);color:#01b4e4;
                               border:1px solid rgba(1,180,228,0.2);">TMDB</span>`
                : '';

            item.innerHTML = `
                ${poster}
                <div style="flex:1;min-width:0;">
                    <div style="font-size:0.88rem;font-weight:600;color:rgba(255,255,255,0.82);
                                white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
                                margin-bottom:4px;transition:color 0.13s;" class="sug-title">
                        ${filme.Title}
                    </div>
                    <div style="display:flex;align-items:center;gap:6px;">
                        <span style="font-size:0.72rem;color:rgba(255,255,255,0.3);font-variant-numeric:tabular-nums;">
                            ${filme.Year || ''}
                        </span>
                        ${badge}
                    </div>
                </div>
                <i class="fas fa-chevron-right" style="font-size:0.6rem;color:rgba(56,189,248,0.5);flex-shrink:0;
                          opacity:0;transform:translateX(-4px);transition:opacity 0.13s,transform 0.13s;"
                   class="sug-arrow"></i>`;

            item.addEventListener('mouseenter', () => {
                item.style.background = 'rgba(56,189,248,0.07)';
                const t = item.querySelector('.sug-title');
                const a = item.querySelector('.sug-arrow');
                if (t) t.style.color = '#e2e8f0';
                if (a) { a.style.opacity = '1'; a.style.transform = 'translateX(0)'; }
            });
            item.addEventListener('mouseleave', () => {
                item.style.background = '';
                const t = item.querySelector('.sug-title');
                const a = item.querySelector('.sug-arrow');
                if (t) t.style.color = 'rgba(255,255,255,0.82)';
                if (a) { a.style.opacity = '0'; a.style.transform = 'translateX(-4px)'; }
            });

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
            box.style.cssText = `
                position:fixed;top:${rect.bottom + 6}px;left:${rect.left}px;
                width:${Math.max(rect.width, 360)}px;
                background:#111827;
                border:1px solid rgba(255,255,255,0.08);
                border-radius:14px;overflow:hidden;
                box-shadow:0 24px 64px rgba(0,0,0,0.7),0 0 0 1px rgba(255,255,255,0.04) inset;
                z-index:99999;
                animation:sugDropIn 0.18s cubic-bezier(0.16,1,0.3,1);`;

            // Injeta keyframe de animação uma vez
            if (!document.getElementById('sug-anim-style')) {
                const st = document.createElement('style');
                st.id = 'sug-anim-style';
                st.textContent = `
                    @keyframes sugDropIn {
                        from { opacity:0; transform:translateY(-6px) scale(0.98); }
                        to   { opacity:1; transform:translateY(0)    scale(1);    }
                    }`;
                document.head.appendChild(st);
            }

            // Header
            const header = document.createElement('div');
            header.style.cssText = `
                display:flex;justify-content:space-between;align-items:center;
                padding:10px 14px;border-bottom:1px solid rgba(255,255,255,0.05);
                background:rgba(255,255,255,0.02);`;
            header.innerHTML = `
                <div style="display:flex;align-items:center;gap:6px;
                            font-size:0.68rem;text-transform:uppercase;letter-spacing:0.08em;
                            color:rgba(255,255,255,0.25);">
                    <div style="width:5px;height:5px;border-radius:50%;
                                background:#38bdf8;box-shadow:0 0 6px #38bdf8;"></div>
                    ${resultados.length} resultado${resultados.length > 1 ? 's' : ''} para "${query}"
                </div>
                <button onclick="document.getElementById('sugestoes-box')?.remove()"
                    style="background:none;border:none;color:rgba(255,255,255,0.2);cursor:pointer;
                           font-size:0.8rem;width:22px;height:22px;border-radius:6px;
                           display:flex;align-items:center;justify-content:center;
                           transition:background 0.15s,color 0.15s;"
                    onmouseenter="this.style.background='rgba(255,255,255,0.07)';this.style.color='rgba(255,255,255,0.5)'"
                    onmouseleave="this.style.background='';this.style.color='rgba(255,255,255,0.2)'">✕</button>`;
            box.appendChild(header);

            // Lista com padding interno
            const lista = document.createElement('div');
            lista.style.cssText = `padding:4px;max-height:280px;overflow-y:auto;`;
            resultados.forEach(f => lista.appendChild(criarSugestaoItem(f)));
            box.appendChild(lista);

            // Footer
            const footer = document.createElement('div');
            footer.style.cssText = `
                display:flex;align-items:center;justify-content:center;gap:6px;
                padding:10px 14px;border-top:1px solid rgba(255,255,255,0.05);
                cursor:pointer;color:rgba(255,255,255,0.25);font-size:0.74rem;
                transition:color 0.13s;background:rgba(255,255,255,0.01);`;
            footer.innerHTML = `<i class="fas fa-pen-to-square" style="font-size:0.7rem;"></i>
                Não encontrou? <span style="color:#60a5fa;">Preencha manualmente</span>`;
            footer.addEventListener('mouseenter', () => footer.style.color = 'rgba(255,255,255,0.45)');
            footer.addEventListener('mouseleave', () => footer.style.color = 'rgba(255,255,255,0.25)');
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