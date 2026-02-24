import { onSnapshot, query, collection } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";
import { auth, db } from './config.js';
import { AuthService, MovieService } from './services.js';
import { UI } from './ui.js';
import { Auth } from './auth.js';

let currentUser = null;          
let currentUserProfile = null;   
let unsubscribeFilmes = null;    
let filmes = [];                 
let filmesFiltrados = [];        
let filmeEmEdicaoId = null;      
let isReadOnly = false;

let currentView = 'grid'; 
let sortBy = 'cadastradoEm';     
let sortDirection = 'asc';       
let generosSelecionados = [];    
let tagsSelecionadas = [];

// PAGINAÇÃO CORRIGIDA: 40 ITENS PARA PREENCHER 5 LINHAS DE 8 COLUNAS
let paginaAtual = 1;
const ITENS_POR_PAGINA = 40;

let debounceTimer = null;

const GENEROS_PREDEFINIDOS = ["Action", "Adventure", "Animation", "Comedy", "Crime", "Documentary", "Drama", "Fantasy", "History", "Horror", "Music", "Mystery", "Romance", "Science Fiction", "Thriller", "War", "Western"].sort();

const CONQUISTAS_DEFINICOES = [
    { id: 'cinefilo_10', nome: 'Cinéfilo Iniciante', descricao: 'Cadastrou 10 filmes.', icone: 'fa-solid fa-film', check: (l) => l.length >= 10 },
    { id: 'critico_10', nome: 'Crítico Exigente', descricao: 'Deu nota 10.', icone: 'fa-solid fa-star', check: (l) => l.some(f => f.nota === 10) },
    { id: 'nacional_5', nome: 'Patriota', descricao: '5 filmes nacionais.', icone: 'fa-solid fa-flag', check: (l) => l.filter(f => f.origem === 'Nacional').length >= 5 },
    { id: 'fa_carteirinha_3', nome: 'Fã de Carteirinha', descricao: '3 filmes do mesmo diretor.', icone: 'fa-solid fa-user-check', check: (l) => { const c = {}; l.flatMap(f => f.direcao || []).forEach(d => { if(d) c[d] = (c[d] || 0) + 1 }); return Object.values(c).some(q => q >= 3); } },
    { id: 'maratonista_5', nome: 'Maratonista', descricao: '5 filmes no mesmo mês.', icone: 'fa-solid fa-person-running', check: (l) => { const c = {}; l.filter(f => f.assistido && f.dataAssistido).forEach(f => { try { const m = f.dataAssistido.slice(0, 7); c[m] = (c[m] || 0) + 1 } catch(e) {} }); return Object.values(c).some(q => q >= 5); } }
];

document.addEventListener('DOMContentLoaded', () => {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    UI.setTheme(savedTheme);

    document.getElementById('theme-toggle')?.addEventListener('click', () => {
        const novoTema = UI.toggleTheme();
        localStorage.setItem('theme', novoTema);
        if (filmesFiltrados.length > 0) {
            requestAnimationFrame(() => UI.renderCharts(filmesFiltrados.filter(f => f.assistido)));
        }
    });

    const urlParams = new URLSearchParams(window.location.search);
    const publicUser = urlParams.get('u');

    if (publicUser) {
        isReadOnly = true;
        iniciarModoPublico(publicUser);
    } else {
        Auth.init(
            (user) => { currentUser = user; iniciarAplicacao(user); },
            () => { encerrarAplicacao(); }
        );
    }
    setupImportExportListeners();
});

async function iniciarModoPublico(nickname) {
    try {
        const profile = await AuthService.getProfileByNickname(nickname);
        if (!profile) {
            UI.alert('Ops!', 'Perfil não encontrado.', 'error');
            setTimeout(() => window.location.href = window.location.pathname, 2000);
            return;
        }
        
        currentUserProfile = profile;
        UI.enableReadOnlyMode(profile);
        setupAppListeners();
        conectarBancoDeDados(profile.uid);
    } catch (error) {
        console.error(error);
        UI.toast("Erro ao carregar perfil público.", "error");
    }
}

async function iniciarAplicacao(user) {
    try {
        const profile = await AuthService.getProfile(user.uid);
        if (profile) {
            currentUserProfile = profile;
            setupAppListeners(); 
            setupFormListeners();
            
            const datalist = document.getElementById('generos-sugeridos');
            if (datalist) datalist.innerHTML = GENEROS_PREDEFINIDOS.map(g => `<option value="${g}"></option>`).join('');
            
            conectarBancoDeDados(user.uid);
        }
    } catch (error) { 
        console.error(error); 
        UI.toast("Erro ao iniciar a aplicação.", "error"); 
    }
}

function encerrarAplicacao() {
    currentUser = null; 
    currentUserProfile = null;
    filmes = []; 
    filmesFiltrados = [];
    if (unsubscribeFilmes) unsubscribeFilmes();
    const container = document.getElementById('tabela-todos-container');
    if (container) container.innerHTML = '';
}

function conectarBancoDeDados(uid) {
    if (unsubscribeFilmes) unsubscribeFilmes();
    
    UI.renderSkeletons(UI.els.tabelaTodos, currentView, 16);
    
    const q = query(collection(db, "users", uid, "filmes"));

    unsubscribeFilmes = onSnapshot(q, (snapshot) => {
        filmes = snapshot.docs.map(doc => {
            const data = doc.data();
            let dataCadastro = (data.cadastradoEm && data.cadastradoEm.toDate) 
                ? data.cadastradoEm.toDate() 
                : new Date(0);

            return { id: doc.id, ...data, cadastradoEm: dataCadastro };
        });

        filmes.sort((a, b) => a.cadastradoEm - b.cadastradoEm);

        requestAnimationFrame(() => {
            atualizarFiltrosExtras();
            verificarConquistas();
            refreshUI(); 
        });
        
    }, (error) => { 
        console.error(error); 
        UI.toast("Erro de conexão com o banco de dados.", "error"); 
    });
}

/**
 * FUNÇÃO REFORMULADA: RENDERIZA O LOTE COMPLETO (40 CARDS) DE UMA VEZ
 */
function refreshUI() {
    filmesFiltrados = aplicarFiltros(filmes);
    filmesFiltrados = aplicarOrdenacao(filmesFiltrados);
    
    const inicio = (paginaAtual - 1) * ITENS_POR_PAGINA;
    const fim = inicio + ITENS_POR_PAGINA;
    const loteExibicao = filmesFiltrados.slice(inicio, fim);
    
    // Limpeza imediata para garantir que não sobram resíduos da página anterior
    UI.els.tabelaTodos.innerHTML = '';
    UI.els.tabelaAssistidos.innerHTML = '';
    UI.els.tabelaNaoAssistidos.innerHTML = '';

    // Renderiza o lote INTEIRO de uma vez
    if (loteExibicao.length > 0) {
        UI.renderContent(loteExibicao, filmes, currentView, false);
    }
    
    atualizarControlesPaginacao();
}

function atualizarControlesPaginacao() {
    const totalPaginas = Math.ceil(filmesFiltrados.length / ITENS_POR_PAGINA);
    const btnAnt = document.getElementById('btn-pag-anterior');
    const btnProx = document.getElementById('btn-pag-proximo');
    const infoPag = document.getElementById('info-paginacao');

    if (infoPag) infoPag.textContent = `Página ${paginaAtual} de ${totalPaginas || 1}`;
    if (btnAnt) btnAnt.disabled = (paginaAtual === 1);
    if (btnProx) btnProx.disabled = (paginaAtual >= totalPaginas || totalPaginas === 0);
}

function aplicarFiltros(lista) {
    const termo = val('filtro-busca');
    const genero = val('filtro-genero');
    const tagFiltro = val('filtro-tag');
    const diretor = val('filtro-diretor');
    const ator = val('filtro-ator');
    const ano = document.getElementById('filtro-ano')?.value || 'todos';
    const origem = document.getElementById('filtro-origem')?.value || 'todos';
    const status = document.getElementById('filtro-assistido')?.value || 'todos';
    const anoAssist = document.getElementById('filtro-ano-assistido')?.value || 'todos';
    const dtIni = document.getElementById('filtro-data-inicio')?.value;
    const dtFim = document.getElementById('filtro-data-fim')?.value;

    return lista.filter(f => {
        if (termo && !f.titulo.toLowerCase().includes(termo)) return false;
        if (genero && !f.genero?.some(g => g.toLowerCase().includes(genero))) return false;
        if (tagFiltro && !f.tags?.some(t => t.toLowerCase().includes(tagFiltro))) return false;
        if (diretor && !f.direcao?.some(d => d.toLowerCase().includes(diretor))) return false;
        if (ator && !f.atores?.some(a => a.toLowerCase().includes(ator))) return false;
        if (ano !== 'todos' && f.ano.toString() !== ano) return false;
        if (origem !== 'todos' && f.origem !== origem) return false;
        if (status !== 'todos') {
            const isAssistido = status === 'sim';
            if (f.assistido !== isAssistido) return false;
        }
        if (anoAssist !== 'todos') {
            if (!f.assistido || !f.dataAssistido || !f.dataAssistido.startsWith(anoAssist)) return false;
        }
        if (dtIni || dtFim) {
            if (!f.dataAssistido) return false;
            if (dtIni && f.dataAssistido < dtIni) return false;
            if (dtFim && f.dataAssistido > dtFim) return false;
        }
        return true;
    });
}

function val(id) { 
    return document.getElementById(id)?.value.toLowerCase().trim() || ''; 
}

function aplicarOrdenacao(lista) {
    return lista.sort((a, b) => {
        let valorA = a[sortBy] ?? '';
        let valorB = b[sortBy] ?? '';
        let comparacao = 0;

        if (valorA instanceof Date && valorB instanceof Date) comparacao = valorA - valorB;
        else if (typeof valorA === 'number' && typeof valorB === 'number') comparacao = valorA - valorB;
        else comparacao = String(valorA).localeCompare(String(valorB));
        
        return sortDirection === 'asc' ? comparacao : -comparacao;
    });
}

function atualizarFiltrosExtras() {
    const anos = [...new Set(filmes.map(f => f.ano).filter(Boolean))].sort((a, b) => b - a);
    updateSelect('filtro-ano', anos, 'Ano Lanç.');
    
    const anosAssistidos = [...new Set(filmes.filter(f => f.assistido && f.dataAssistido).map(f => f.dataAssistido.slice(0, 4)))].sort((a, b) => b - a);
    updateSelect('filtro-ano-assistido', anosAssistidos, 'Ano Assist.');
}

function updateSelect(id, values, defaultText) {
    const selectEl = document.getElementById(id);
    if (!selectEl) return;
    
    const valorAtual = selectEl.value;
    selectEl.innerHTML = `<option value="todos">${defaultText}</option>` + values.map(v => `<option value="${v}">${v}</option>`).join('');
    
    if (values.includes(Number(valorAtual)) || values.includes(valorAtual)) {
        selectEl.value = valorAtual;
    }
}

function verificarConquistas() {
    if (!currentUserProfile) return;
    const stats = CONQUISTAS_DEFINICOES.map(def => ({ ...def, unlocked: def.check(filmes) }));
    UI.renderAchievements(stats);
    UI.renderProfile(currentUserProfile, filmes);
}

function setupAppListeners() {
    document.getElementById('nav-sugerir-btn')?.addEventListener('click', (e) => {
        e.preventDefault();
        sugerirFilmeAleatorio();
    });
    
    document.getElementById('nav-graficos-btn')?.addEventListener('click', (e) => {
        e.preventDefault();
        const section = document.getElementById('graficos-section');
        
        if (section.style.display === 'none') {
            section.style.display = 'block';
            const listaParaGraficos = filmesFiltrados.filter(f => f.assistido);
            if (listaParaGraficos.length > 0) {
                requestAnimationFrame(() => UI.renderCharts(listaParaGraficos));
            }
            section.scrollIntoView({ behavior: 'smooth' });
        } else {
            section.style.display = 'none';
        }
    });
    
    document.getElementById('nav-perfil-btn')?.addEventListener('click', (e) => {
        e.preventDefault();
        const section = document.getElementById('perfil-section');
        
        if (section.style.display === 'none') {
            section.style.display = 'block';
            section.scrollIntoView({ behavior: 'smooth' });
        } else {
            section.style.display = 'none';
        }
    });

    document.getElementById('btn-compartilhar-perfil')?.addEventListener('click', () => {
        const url = `${window.location.origin}${window.location.pathname}?u=${currentUserProfile.nickname}`;
        navigator.clipboard.writeText(url).then(() => {
            UI.toast('Link copiado para a área de transferência!');
        });
    });

    document.getElementById('limpar-filtros')?.addEventListener('click', resetarFiltros);
    
    document.querySelectorAll('#filtros-container input, #filtros-container select').forEach(el => {
        if (el.id === 'filtro-periodo-rapido') return;
        
        const eventType = el.tagName === 'SELECT' ? 'change' : 'input';
        
        el.addEventListener(eventType, () => {
             paginaAtual = 1;
             
             if (el.id.includes('data')) { 
                 sortBy = 'dataAssistido'; 
                 sortDirection = 'desc'; 
             }
             
             if (el.tagName === 'INPUT' && el.type === 'text') {
                 clearTimeout(debounceTimer);
                 debounceTimer = setTimeout(refreshUI, 300);
             } else {
                 refreshUI();
             }
        });
    });

    document.getElementById('filtro-periodo-rapido')?.addEventListener('change', (e) => {
        const periodo = e.target.value;
        const hoje = new Date();
        let dataInicio = null;
        let dataFim = null;
        paginaAtual = 1;

        if (periodo === '30d') {
            dataInicio = new Date(hoje.getTime() - 30 * 24 * 60 * 60 * 1000);
        } else if (periodo === 'mes_atual') {
            dataInicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
            dataFim = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
        } else if (periodo === 'este_ano') {
            dataInicio = new Date(hoje.getFullYear(), 0, 1);
            dataFim = new Date(hoje.getFullYear(), 11, 31);
        }
        
        if (dataInicio) {
            document.getElementById('filtro-data-inicio').value = dataInicio.toISOString().split('T')[0];
            document.getElementById('filtro-data-fim').value = dataFim ? dataFim.toISOString().split('T')[0] : hoje.toISOString().split('T')[0];
            sortBy = 'dataAssistido'; 
            sortDirection = 'desc'; 
        } else if (periodo === 'todos') { 
            sortBy = 'cadastradoEm'; 
            sortDirection = 'asc'; 
        }
        refreshUI();
    });

    const btnTable = document.getElementById('view-btn-table');
    const btnGrid = document.getElementById('view-btn-grid');

    btnTable?.addEventListener('click', () => {
        currentView = 'table';
        btnTable.classList.add('active');
        btnGrid.classList.remove('active');
        refreshUI();
    });

    btnGrid?.addEventListener('click', () => {
        currentView = 'grid';
        btnGrid.classList.add('active');
        btnTable.classList.remove('active');
        refreshUI();
    });

    // BOTÕES DE NAVEGAÇÃO: SALTO INSTANTÂNEO PARA FLUÍDEZ
    document.getElementById('btn-pag-anterior')?.addEventListener('click', () => {
        if (paginaAtual > 1) {
            paginaAtual--;
            document.getElementById('lista-section')?.scrollIntoView({ behavior: 'auto', block: 'start' });
            refreshUI();
        }
    });

    document.getElementById('btn-pag-proximo')?.addEventListener('click', () => {
        const totalPaginas = Math.ceil(filmesFiltrados.length / ITENS_POR_PAGINA);
        if (paginaAtual < totalPaginas) {
            paginaAtual++;
            document.getElementById('lista-section')?.scrollIntoView({ behavior: 'auto', block: 'start' });
            refreshUI();
        }
    });

    document.addEventListener('click', async (e) => {
        const target = e.target;
        const head = target.closest('th.sortable');
        
        if (head) {
            const col = head.dataset.sort;
            if (sortBy === col) {
                sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
            } else { 
                sortBy = col; 
                sortDirection = 'asc'; 
            }
            refreshUI(); 
            return;
        }

        const item = target.closest('[data-id]');
        if (!item) return;
        
        const id = item.dataset.id;
        
        if (target.closest('.btn-edit')) { 
            e.stopPropagation(); 
            carregarParaEdicao(id); 
            return; 
        }
        
        if (target.closest('.btn-delete')) {
            e.stopPropagation();
            if ((await UI.confirm('Excluir filme?', 'Esta ação é irreversível.')).isConfirmed) {
                try { 
                    await MovieService.delete(currentUser.uid, id); 
                    UI.toast('Filme excluído.'); 
                } catch(err) { 
                    UI.alert('Erro', err.message, 'error'); 
                }
            }
            return;
        }
        
        const btnDetalhes = target.closest('.btn-detalhes');
        if (btnDetalhes) {
            const icon = btnDetalhes.querySelector('i');
            setTimeout(() => {
                const isExpanded = btnDetalhes.getAttribute('aria-expanded') === 'true';
                icon.style.transform = isExpanded ? 'rotate(180deg)' : 'rotate(0deg)';
            }, 50);
            return;
        }

        if (currentView === 'table' && !target.closest('.dropdown') && !target.closest('button') && !target.closest('a')) {
             const btn = item.querySelector('.btn-detalhes');
             if (btn) btn.click();
             return;
        }
        
        if (currentView === 'grid') {
            const filme = filmes.find(x => x.id === id);
            if (filme) {
                UI.showMovieDetailModal(
                    filme, 
                    !isReadOnly ? async (fid) => { 
                        await MovieService.toggleAssistido(currentUser?.uid, fid, true); 
                        UI.toast('Marcado como assistido!'); 
                    } : null,
                    (titulo, ano) => MovieService.getTrailer(titulo, ano)
                );
            }
        }
    });
}

function resetarFiltros() {
    document.querySelectorAll('#filtros-container input').forEach(input => input.value = '');
    document.querySelectorAll('#filtros-container select').forEach(select => select.value = 'todos');
    document.getElementById('filtro-periodo-rapido').value = 'custom';
    sortBy = 'cadastradoEm'; 
    sortDirection = 'asc';
    paginaAtual = 1;
    refreshUI();
}

function setupFormListeners() {
    const form = document.getElementById('filme-form'); 
    if (!form) return;
    
    document.getElementById('btn-buscar-omdb')?.addEventListener('click', buscarOMDb);
    document.getElementById('titulo')?.addEventListener('keypress', e => {
        if (e.key === 'Enter') {
            e.preventDefault();
            buscarOMDb();
        }
    });
    
    const inputGenero = document.getElementById('genero-input');
    inputGenero?.addEventListener('keydown', e => {
        if (e.key === 'Enter') {
            e.preventDefault(); 
            adicionarGenero(inputGenero.value);
        }
        if (e.key === 'Backspace' && !inputGenero.value && generosSelecionados.length) {
            removerGenero(generosSelecionados[generosSelecionados.length - 1]);
        }
    });
    inputGenero?.addEventListener('input', () => { 
        if (GENEROS_PREDEFINIDOS.includes(inputGenero.value)) {
            adicionarGenero(inputGenero.value); 
        }
    });

    const inputTags = document.getElementById('tags-input');
    inputTags?.addEventListener('keydown', e => {
        if (e.key === 'Enter') {
            e.preventDefault(); 
            adicionarTag(inputTags.value);
        }
        if (e.key === 'Backspace' && !inputTags.value && tagsSelecionadas.length) {
            removerTag(tagsSelecionadas[tagsSelecionadas.length - 1]);
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
        
        const dados = {
            titulo: document.getElementById('titulo').value.trim(),
            ano: parseInt(document.getElementById('ano').value) || null,
            nota: parseFloat(document.getElementById('nota').value) || 0,
            direcao: document.getElementById('direcao').value.split(',').filter(Boolean).map(s => s.trim()),
            atores: document.getElementById('atores').value.split(',').filter(Boolean).map(s => s.trim()),
            genero: [...generosSelecionados],
            tags: [...tagsSelecionadas],
            origem: document.getElementById('origem').value,
            assistido: assistido,
            dataAssistido: assistido ? document.getElementById('data-assistido').value : null,
            posterUrl: imgPreviewSrc.includes(window.location.href) ? '' : imgPreviewSrc
        };

        const btnSubmit = form.querySelector('button[type="submit"]');
        const originalText = btnSubmit.innerHTML; 
        
        btnSubmit.innerHTML = 'Salvando...'; 
        btnSubmit.disabled = true;
        
        try {
            await MovieService.save(currentUser.uid, dados, filmeEmEdicaoId);
            UI.toast('Salvo com sucesso!');
            UI.clearForm(); 
            generosSelecionados = []; 
            tagsSelecionadas = [];
            filmeEmEdicaoId = null;
            document.getElementById('cadastro-titulo').innerHTML = '<i class=\"fas fa-edit me-2\"></i> Cadastro de Filme';
        } catch(err) { 
            UI.alert('Erro', err.message, 'error'); 
        } finally { 
            btnSubmit.innerHTML = originalText; 
            btnSubmit.disabled = false; 
        }
    });
}

async function buscarOMDb() {
    const titulo = document.getElementById('titulo').value;
    const ano = document.getElementById('ano').value;
    
    if (!titulo) return UI.toast('Digite um título para buscar', 'warning');
    
    document.getElementById('api-loading').style.display = 'flex';
    
    try {
        const data = await MovieService.searchOMDb(titulo, ano);
        document.getElementById('titulo').value = data.Title;
        document.getElementById('ano').value = parseInt(data.Year) || '';
        document.getElementById('nota').value = parseFloat(data.imdbRating) || '';
        document.getElementById('direcao').value = data.Director !== 'N/A' ? data.Director : '';
        document.getElementById('atores').value = data.Actors !== 'N/A' ? data.Actors : '';
        
        if (data.Country) {
            document.getElementById('origem').value = data.Country.includes("Brazil") ? "Nacional" : "Internacional";
        }
        
        UI.updatePreviewPoster(data.Poster !== 'N/A' ? data.Poster : '');
        generosSelecionados = []; 
        
        if (data.Genre !== 'N/A') {
            data.Genre.split(', ').forEach(g => adicionarGenero(g));
        }
        
        UI.toast('Filme encontrado!');
    } catch(err) { 
        UI.toast(err.message, 'error'); 
    } finally { 
        document.getElementById('api-loading').style.display = 'none'; 
    }
}

function adicionarGenero(genero) {
    const limpo = genero.trim(); 
    if (limpo && !generosSelecionados.includes(limpo)) {
        generosSelecionados.push(limpo); 
        UI.renderGenerosTags(generosSelecionados, removerGenero); 
        document.getElementById('genero-input').value = '';
    }
}

function removerGenero(genero) { 
    generosSelecionados = generosSelecionados.filter(g => g !== genero); 
    UI.renderGenerosTags(generosSelecionados, removerGenero); 
}

function adicionarTag(tag) {
    const limpo = tag.trim(); 
    if (limpo && !tagsSelecionadas.includes(limpo)) {
        tagsSelecionadas.push(limpo); 
        UI.renderCustomTags(tagsSelecionadas, removerTag); 
        document.getElementById('tags-input').value = '';
    }
}

function removerTag(tag) { 
    tagsSelecionadas = tagsSelecionadas.filter(t => t !== tag); 
    UI.renderCustomTags(tagsSelecionadas, removerTag); 
}

function carregarParaEdicao(id) {
    const filme = filmes.find(x => x.id === id); 
    if (!filme) return;
    
    filmeEmEdicaoId = id; 
    document.getElementById('cadastro-titulo').innerHTML = `Editando: ${filme.titulo}`;
    generosSelecionados = filme.genero ? [...filme.genero] : [];
    tagsSelecionadas = filme.tags ? [...filme.tags] : [];
    
    UI.fillForm(filme, 
        (generos) => UI.renderGenerosTags(generos, removerGenero),
        (tags) => UI.renderCustomTags(tags, removerTag)
    );
    document.getElementById('cadastro-section').scrollIntoView({ behavior: 'smooth' });
}

function sugerirFilmeAleatorio() {
    const pendentes = filmes.filter(f => !f.assistido);
    if (!pendentes.length) return UI.alert('Lista zerada!', 'Você já assistiu a todos os filmes cadastrados.', 'success');
    
    const filmeSorteado = pendentes[Math.floor(Math.random() * pendentes.length)];
    
    UI.showRandomSuggestion(
        filmeSorteado, 
        async (id) => {
            await MovieService.toggleAssistido(currentUser.uid, id, true);
            UI.toast('Marcado como assistido!');
        }, 
        sugerirFilmeAleatorio,
        (titulo, ano) => MovieService.getTrailer(titulo, ano)
    );
}

function setupImportExportListeners() {
    document.getElementById('export-json-btn')?.addEventListener('click', () => {
        if (!filmesFiltrados.length) return UI.toast('Nenhum dado para exportar', 'warning');
        downloadFile(JSON.stringify(filmesFiltrados, null, 2), `meus_filmes.json`, 'application/json');
    });
    document.getElementById('export-csv-btn')?.addEventListener('click', exportarCSV);
    document.getElementById('import-btn')?.addEventListener('click', () => document.getElementById('import-file-input').click());
    document.getElementById('import-file-input')?.addEventListener('change', importarArquivo);
}

function exportarCSV() {
    if (!filmesFiltrados.length) return UI.toast('Lista vazia', 'warning');
    
    const headers = ['titulo', 'ano', 'nota', 'direcao', 'atores', 'genero', 'tags', 'origem', 'assistido', 'dataAssistido', 'posterUrl'];
    
    const rows = filmesFiltrados.map(f => headers.map(header => { 
        let val = f[header]; 
        if (Array.isArray(val)) val = val.join('; '); 
        if (val == null) val = ''; 
        
        val = String(val).replace(/"/g, '""'); 
        if (val.includes(',')) val = `"${val}"`; 
        return val; 
    }).join(','));

    const csvContent = [headers.join(','), ...rows].join('\n');
    downloadFile(csvContent, `meus_filmes.csv`, 'text/csv;charset=utf-8;');
}

function downloadFile(content, fileName, contentType) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([content], { type: contentType }));
    a.download = fileName;
    a.click();
}

function importarArquivo(e) {
    const file = e.target.files[0]; 
    if (!file) return; 
    
    const reader = new FileReader();
    
    reader.onload = async (ev) => {
        try {
            let dadosImportados = []; 
            const content = ev.target.result;
            
            if (file.name.endsWith('.json')) { 
                dadosImportados = JSON.parse(content); 
            } 
            
            const novosFilmes = dadosImportados.filter(novo => 
                !filmes.some(existente => existente.titulo.toLowerCase() === novo.titulo.toLowerCase())
            );
            
            if (!novosFilmes.length) return UI.alert('Informação', 'Nenhum filme novo encontrado no arquivo.', 'info');
            
            const confirmacao = await UI.confirm('Importar Dados', `Deseja importar ${novosFilmes.length} filmes?`);
            
            if (confirmacao.isConfirmed) {
                UI.toast('Importando...'); 
                const { serverTimestamp } = await import("https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js");
                
                for (const filme of novosFilmes) {
                    await MovieService.save(currentUser.uid, { ...filme, cadastradoEm: serverTimestamp() });
                }
                UI.toast('Importação concluída!');
            }
        } catch(err) {
            UI.alert('Erro na Importação', err.message, 'error');
        } 
        
        e.target.value = '';
    }; 
    
    reader.readAsText(file);
}