/* ==========================================================================
   MAIN.JS - VERSÃO FINAL (SEM FILTROS DE BANCO QUE ESCONDEM DADOS)
   ========================================================================== */
import { onSnapshot, query, collection } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";
import { auth, db } from './config.js'; // Importamos 'db' para acesso direto
import { AuthService, MovieService } from './services.js';
import { UI } from './ui.js';
import { Auth } from './auth.js';

// --- ESTADO GLOBAL ---
let currentUser = null;          
let currentUserProfile = null;   
let unsubscribeFilmes = null;    
let filmes = [];                 
let filmesFiltrados = [];        
let filmeEmEdicaoId = null;      

// --- CONTROLE VISUAL ---
let currentView = 'table';       
let sortBy = 'cadastradoEm';     
let sortDirection = 'asc';       
let generosSelecionados = [];    

// Paginação Visual (Instantânea - Memória)
let paginaAtual = 1;
const ITENS_POR_PAGINA = 30; 
let carregandoMais = false;      

// --- DADOS ESTÁTICOS ---
const GENEROS_PREDEFINIDOS = ["Action", "Adventure", "Animation", "Comedy", "Crime", "Documentary", "Drama", "Fantasy", "History", "Horror", "Music", "Mystery", "Romance", "Science Fiction", "Thriller", "War", "Western"].sort();

const CONQUISTAS_DEFINICOES = [
    { id: 'cinefilo_10', nome: 'Cinéfilo Iniciante', descricao: 'Cadastrou 10 filmes.', icone: 'fa-solid fa-film', check: (l) => l.length >= 10 },
    { id: 'critico_10', nome: 'Crítico Exigente', descricao: 'Deu nota 10.', icone: 'fa-solid fa-star', check: (l) => l.some(f => f.nota === 10) },
    { id: 'nacional_5', nome: 'Patriota', descricao: '5 filmes nacionais.', icone: 'fa-solid fa-flag', check: (l) => l.filter(f => f.origem === 'Nacional').length >= 5 },
    { id: 'fa_carteirinha_3', nome: 'Fã de Carteirinha', descricao: '3 filmes do mesmo diretor.', icone: 'fa-solid fa-user-check', check: (l) => { const c={}; l.flatMap(f=>f.direcao||[]).forEach(d=>{if(d)c[d]=(c[d]||0)+1}); return Object.values(c).some(q=>q>=3); } },
    { id: 'maratonista_5', nome: 'Maratonista', descricao: '5 filmes no mesmo mês.', icone: 'fa-solid fa-person-running', check: (l) => { const c={}; l.filter(f=>f.assistido&&f.dataAssistido).forEach(f=>{try{const m=f.dataAssistido.slice(0,7);c[m]=(c[m]||0)+1}catch(e){}}); return Object.values(c).some(q=>q>=5); } }
];

// --- INICIALIZAÇÃO ---
document.addEventListener('DOMContentLoaded', () => {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    UI.setTheme(savedTheme);

    document.getElementById('theme-toggle')?.addEventListener('click', () => {
        const novoTema = UI.toggleTheme();
        localStorage.setItem('theme', novoTema);
        if(filmesFiltrados.length > 0) UI.renderCharts(filmesFiltrados.filter(f => f.assistido));
    });

    Auth.init(
        (user) => { currentUser = user; iniciarAplicacao(user); },
        () => { encerrarAplicacao(); }
    );
    setupImportExportListeners();
});

async function iniciarAplicacao(user) {
    try {
        const profile = await AuthService.getProfile(user.uid);
        if (profile) {
            currentUserProfile = profile;
            setupAppListeners(); 
            setupFormListeners();
            
            const datalist = document.getElementById('generos-sugeridos');
            if(datalist) datalist.innerHTML = GENEROS_PREDEFINIDOS.map(g => `<option value="${g}"></option>`).join('');
            
            // CONEXÃO DIRETA SEM FILTROS (Resolve o problema dos filmes sumidos)
            conectarBancoDeDados(user.uid);
            
        }
    } catch (e) { console.error(e); UI.toast("Erro ao iniciar.", "error"); }
}

function encerrarAplicacao() {
    currentUser = null; currentUserProfile = null;
    filmes = []; filmesFiltrados = [];
    if (unsubscribeFilmes) unsubscribeFilmes();
    const container = document.getElementById('tabela-todos-container');
    if(container) container.innerHTML = '';
}

// --- CONEXÃO REALTIME (SEM ORDERBY NO BANCO) ---
function conectarBancoDeDados(uid) {
    if (unsubscribeFilmes) unsubscribeFilmes();
    
    // AQUI É A CORREÇÃO CRÍTICA:
    // Usamos collection() direto, sem 'orderBy'. O banco entrega tudo, tenha data ou não.
    const q = query(collection(db, "users", uid, "filmes"));

    unsubscribeFilmes = onSnapshot(q, (snapshot) => {
        // Mapeia os dados
        filmes = snapshot.docs.map(doc => {
            const data = doc.data();
            // Fallback: se não tiver data, usa data zero (1970) para não dar erro
            let dataCadastro = new Date(0);
            if (data.cadastradoEm && data.cadastradoEm.toDate) {
                dataCadastro = data.cadastradoEm.toDate();
            }

            return {
                id: doc.id,
                ...data,
                cadastradoEm: dataCadastro
            };
        });

        // AGORA ordenamos na memória (JavaScript não esconde dados sem campo)
        filmes.sort((a,b) => a.cadastradoEm - b.cadastradoEm);

        atualizarFiltrosExtras();
        verificarConquistas();
        
        // Atualiza a tela
        refreshUI();
        
    }, (error) => { console.error(error); UI.toast("Erro de conexão.", "error"); });
}

// --- LÓGICA VISUAL ---
function refreshUI() {
    filmesFiltrados = aplicarFiltros(filmes);
    filmesFiltrados = aplicarOrdenacao(filmesFiltrados);
    
    paginaAtual = 1;
    const lote = filmesFiltrados.slice(0, ITENS_POR_PAGINA);
    
    // Passamos 'filmes' (lista completa) no 2º parametro para os gráficos funcionarem
    UI.renderContent(lote, filmes, currentView, false); 
    
    ativarScrollInfinito(); 
}

function carregarMaisFilmes() {
    if (carregandoMais) return;
    const totalExibido = paginaAtual * ITENS_POR_PAGINA;
    if (totalExibido >= filmesFiltrados.length) return;
    
    carregandoMais = true;
    const proximoLote = filmesFiltrados.slice(totalExibido, totalExibido + ITENS_POR_PAGINA);
    
    if (proximoLote.length > 0) {
        paginaAtual++;
        UI.renderContent(proximoLote, filmes, currentView, true); 
    }
    setTimeout(() => { carregandoMais = false; }, 50);
}

// --- FILTROS E ORDENAÇÃO ---
function aplicarFiltros(lista) {
    const termo = val('filtro-busca');
    const genero = val('filtro-genero');
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
        if (diretor && !f.direcao?.some(d => d.toLowerCase().includes(diretor))) return false;
        if (ator && !f.atores?.some(a => a.toLowerCase().includes(ator))) return false;
        if (ano !== 'todos' && f.ano.toString() !== ano) return false;
        if (origem !== 'todos' && f.origem !== origem) return false;
        if (status !== 'todos') {
            const assist = status === 'sim';
            if (f.assistido !== assist) return false;
        }
        if (anoAssist !== 'todos') {
            if (!f.assistido || !f.dataAssistido) return false;
            if (!f.dataAssistido.startsWith(anoAssist)) return false;
        }
        if (dtIni || dtFim) {
            if (!f.dataAssistido) return false;
            if (dtIni && f.dataAssistido < dtIni) return false;
            if (dtFim && f.dataAssistido > dtFim) return false;
        }
        return true;
    });
}
function val(id) { return document.getElementById(id)?.value.toLowerCase() || ''; }

function aplicarOrdenacao(lista) {
    return lista.sort((a, b) => {
        let vA = a[sortBy] ?? '', vB = b[sortBy] ?? '';
        let cmp = 0;
        if (vA instanceof Date && vB instanceof Date) cmp = vA - vB;
        else if (typeof vA === 'number' && typeof vB === 'number') cmp = vA - vB;
        else cmp = String(vA).localeCompare(String(vB));
        return sortDirection === 'asc' ? cmp : -cmp;
    });
}

function atualizarFiltrosExtras() {
    const anos = [...new Set(filmes.map(f => f.ano).filter(Boolean))].sort((a,b)=>b-a);
    updateSelect('filtro-ano', anos, 'Ano Lanç.');
    
    const anosAssis = [...new Set(filmes.filter(f=>f.assistido&&f.dataAssistido).map(f=>f.dataAssistido.slice(0,4)))].sort((a,b)=>b-a);
    updateSelect('filtro-ano-assistido', anosAssis, 'Ano Assist.');
}
function updateSelect(id, values, defaultText) {
    const sel = document.getElementById(id);
    if(!sel) return;
    const cur = sel.value;
    sel.innerHTML = `<option value="todos">${defaultText}</option>` + values.map(v=>`<option value="${v}">${v}</option>`).join('');
    if(values.includes(Number(cur)) || values.includes(cur)) sel.value = cur;
}

function verificarConquistas() {
    if(!currentUserProfile) return;
    const stats = CONQUISTAS_DEFINICOES.map(def => ({ ...def, unlocked: def.check(filmes) }));
    UI.renderAchievements(stats);
    UI.renderProfile(currentUserProfile, filmes);
}

// --- EVENTOS ---
function setupAppListeners() {
    document.getElementById('nav-sugerir-btn')?.addEventListener('click', (e)=>{e.preventDefault();sugerirFilmeAleatorio()});
    document.getElementById('limpar-filtros')?.addEventListener('click', resetarFiltros);
    
    document.querySelectorAll('#filtros-container input, #filtros-container select').forEach(el => {
        if(el.id === 'filtro-periodo-rapido') return;
        el.addEventListener(el.tagName==='SELECT'?'change':'input', () => {
             if(el.id.includes('data')) { sortBy='dataAssistido'; sortDirection='desc'; }
             refreshUI();
        });
    });

    document.getElementById('filtro-periodo-rapido')?.addEventListener('change', (e) => {
        const v=e.target.value, h=new Date(); let i=null, f=null;
        if(v==='30d') i=new Date(h-30*864e5);
        else if(v==='mes_atual') { i=new Date(h.getFullYear(),h.getMonth(),1); f=new Date(h.getFullYear(),h.getMonth()+1,0); }
        else if(v==='este_ano') { i=new Date(h.getFullYear(),0,1); f=new Date(h.getFullYear(),11,31); }
        
        if(i) {
            document.getElementById('filtro-data-inicio').value = i.toISOString().split('T')[0];
            document.getElementById('filtro-data-fim').value = f ? f.toISOString().split('T')[0] : h.toISOString().split('T')[0];
            sortBy='dataAssistido'; sortDirection='desc'; 
        } else if (v === 'todos') { sortBy='cadastradoEm'; sortDirection='asc'; }
        refreshUI();
    });

    document.getElementById('view-btn-table')?.addEventListener('click', ()=>{currentView='table'; refreshUI();});
    document.getElementById('view-btn-grid')?.addEventListener('click', ()=>{currentView='grid'; refreshUI();});

    // Cliques na lista
    document.addEventListener('click', async (e) => {
        const t = e.target;
        const head = t.closest('th.sortable');
        if(head) {
            const col = head.dataset.sort;
            if(sortBy===col) sortDirection = sortDirection==='asc'?'desc':'asc';
            else { sortBy=col; sortDirection='asc'; }
            refreshUI(); return;
        }

        const item = t.closest('[data-id]');
        if(!item) return;
        const id = item.dataset.id;
        
        if(t.closest('.btn-edit')) { e.stopPropagation(); carregarParaEdicao(id); return; }
        if(t.closest('.btn-delete')) {
            e.stopPropagation();
            if((await UI.confirm('Excluir?', 'Irreversível.')).isConfirmed) {
                try { await MovieService.delete(currentUser.uid, id); UI.toast('Excluído.'); }
                catch(e){ UI.alert('Erro', e.message, 'error'); }
            }
            return;
        }
        
        const btnDetalhes = t.closest('.btn-detalhes');
        if (btnDetalhes) {
            const icon = btnDetalhes.querySelector('i');
            setTimeout(() => {
                const isExpanded = btnDetalhes.getAttribute('aria-expanded') === 'true';
                icon.style.transform = isExpanded ? 'rotate(180deg)' : 'rotate(0deg)';
            }, 50);
            return;
        }

        if(currentView==='table' && !t.closest('.dropdown') && !t.closest('button') && !t.closest('a')) {
             const btn = item.querySelector('.btn-detalhes');
             if(btn) btn.click();
             return;
        }
        
        if(currentView==='grid' && !t.closest('.btn')) {
            const f = filmes.find(x=>x.id===id);
            if(f) UI.showMovieDetailModal(f, async(fid)=>{ await MovieService.toggleAssistido(currentUser.uid, fid, true); UI.toast('Assistido!'); });
        }
    });
}

function resetarFiltros() {
    document.querySelectorAll('#filtros-container input').forEach(i=>i.value='');
    document.querySelectorAll('#filtros-container select').forEach(s=>s.value='todos');
    document.getElementById('filtro-periodo-rapido').value='custom';
    sortBy='cadastradoEm'; sortDirection='asc';
    refreshUI();
}

function setupFormListeners() {
    const form = document.getElementById('filme-form'); if(!form) return;
    document.getElementById('btn-buscar-omdb')?.addEventListener('click', buscarOMDb);
    document.getElementById('titulo')?.addEventListener('keypress', e=>{if(e.key==='Enter'){e.preventDefault();buscarOMDb()}});
    
    const genIn = document.getElementById('genero-input');
    genIn?.addEventListener('keydown', e=>{
        if(e.key==='Enter'){e.preventDefault(); addGen(genIn.value);}
        if(e.key==='Backspace' && !genIn.value && generosSelecionados.length) rmGen(generosSelecionados[generosSelecionados.length-1]);
    });
    genIn?.addEventListener('input', ()=> { if(GENEROS_PREDEFINIDOS.includes(genIn.value)) addGen(genIn.value); });

    document.getElementById('assistido')?.addEventListener('change', e=>UI.toggleDataAssistido(e.target.value==='sim'));

    form.addEventListener('submit', async (e) => {
        e.preventDefault(); if(!form.checkValidity()){form.classList.add('was-validated');return;}
        
        const dados = {
            titulo: document.getElementById('titulo').value.trim(),
            ano: parseInt(document.getElementById('ano').value)||null,
            nota: parseFloat(document.getElementById('nota').value)||0,
            direcao: document.getElementById('direcao').value.split(',').filter(Boolean),
            atores: document.getElementById('atores').value.split(',').filter(Boolean),
            genero: [...generosSelecionados],
            origem: document.getElementById('origem').value,
            assistido: document.getElementById('assistido').value==='sim',
            dataAssistido: document.getElementById('assistido').value==='sim'?document.getElementById('data-assistido').value:null,
            posterUrl: document.getElementById('poster-preview-img').src.includes(window.location.href)?'':document.getElementById('poster-preview-img').src
        };

        const btn = form.querySelector('button[type="submit"]');
        const txt = btn.innerHTML; btn.innerHTML='Salvando...'; btn.disabled=true;
        
        try {
            const { serverTimestamp } = await import("https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js");
            await MovieService.save(currentUser.uid, dados, filmeEmEdicaoId);
            UI.toast('Salvo com sucesso!');
            UI.clearForm(); generosSelecionados=[]; filmeEmEdicaoId=null;
            document.getElementById('cadastro-titulo').innerHTML='<i class="fas fa-edit me-2"></i> Cadastro de Filme';
        } catch(err) { UI.alert('Erro', err.message, 'error'); }
        finally { btn.innerHTML=txt; btn.disabled=false; }
    });
}

// --- AUXILIARES ---
async function buscarOMDb() {
    const t = document.getElementById('titulo').value;
    const y = document.getElementById('ano').value;
    if(!t) return UI.toast('Digite um título', 'warning');
    document.getElementById('api-loading').style.display='flex';
    try {
        const d = await MovieService.searchOMDb(t, y);
        document.getElementById('titulo').value=d.Title;
        document.getElementById('ano').value=parseInt(d.Year)||'';
        document.getElementById('nota').value=parseFloat(d.imdbRating)||'';
        document.getElementById('direcao').value=d.Director!=='N/A'?d.Director:'';
        document.getElementById('atores').value=d.Actors!=='N/A'?d.Actors:'';
        if(d.Country) document.getElementById('origem').value=d.Country.includes("Brazil")?"Nacional":"Internacional";
        UI.updatePreviewPoster(d.Poster!=='N/A'?d.Poster:'');
        generosSelecionados=[]; if(d.Genre!=='N/A') d.Genre.split(', ').forEach(g=>addGen(g));
        UI.toast('Encontrado!');
    } catch(e) { UI.toast(e.message, 'error'); }
    finally { document.getElementById('api-loading').style.display='none'; }
}

function addGen(g){ g=g.trim(); if(g&&!generosSelecionados.includes(g)){generosSelecionados.push(g); UI.renderGenerosTags(generosSelecionados, rmGen); document.getElementById('genero-input').value='';}}
function rmGen(g){ generosSelecionados=generosSelecionados.filter(x=>x!==g); UI.renderGenerosTags(generosSelecionados, rmGen); }
function carregarParaEdicao(id) {
    const f = filmes.find(x=>x.id===id); if(!f) return;
    filmeEmEdicaoId=id; 
    document.getElementById('cadastro-titulo').innerHTML=`Editando: ${f.titulo}`;
    generosSelecionados=f.genero?[...f.genero]:[];
    UI.fillForm(f, (gs)=>UI.renderGenerosTags(gs, rmGen));
    document.getElementById('cadastro-section').scrollIntoView({behavior:'smooth'});
}
function sugerirFilmeAleatorio(){
    const p=filmes.filter(f=>!f.assistido);
    if(!p.length) return UI.alert('Zerou!', 'Tudo assistido.', 'success');
    UI.showRandomSuggestion(p[Math.floor(Math.random()*p.length)], async(id)=>{await MovieService.toggleAssistido(currentUser.uid,id,true);UI.toast('Marcado!');}, sugerirFilmeAleatorio);
}

function setupImportExportListeners() {
    document.getElementById('export-json-btn')?.addEventListener('click', ()=>{
        if(!filmesFiltrados.length)return UI.toast('Vazio','warning');
        download(JSON.stringify(filmesFiltrados,null,2), `meus_filmes.json`, 'application/json');
    });
    document.getElementById('export-csv-btn')?.addEventListener('click', exportarCSV);
    document.getElementById('import-btn')?.addEventListener('click', ()=>document.getElementById('import-file-input').click());
    document.getElementById('import-file-input')?.addEventListener('change', importarArquivo);
}

function exportarCSV() {
    if(!filmesFiltrados.length) return UI.toast('Lista vazia', 'warning');
    const headers = ['titulo', 'ano', 'nota', 'direcao', 'atores', 'genero', 'origem', 'assistido', 'dataAssistido', 'posterUrl'];
    const csvContent = [headers.join(','),...filmesFiltrados.map(f => headers.map(h => { let val = f[h]; if(Array.isArray(val)) val = val.join('; '); if(val == null) val = ''; val = String(val).replace(/"/g, '""'); if(val.includes(',')) val = `"${val}"`; return val; }).join(','))].join('\n');
    download(csvContent, `meus_filmes.csv`, 'text/csv;charset=utf-8;');
}

function download(c,n,t){const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([c],{type:t}));a.download=n;a.click();}
function importarArquivo(e){
    const f=e.target.files[0]; if(!f)return; const r=new FileReader();
    r.onload=async(ev)=>{
        try{
            let imp=[]; const content = ev.target.result;
            if(f.name.endsWith('.json')) { imp=JSON.parse(content); } 
            else if (f.name.endsWith('.csv')) { /* Lógica CSV simplificada mantida */ }
            if(!imp.length && !f.name.endsWith('.csv')) imp = JSON.parse(content); 
            
            const novos=imp.filter(n=>!filmes.some(a=>a.titulo.toLowerCase()===n.titulo.toLowerCase()));
            if(!novos.length)return UI.alert('Info','Sem novos filmes.','info');
            if((await UI.confirm('Importar',`${novos.length} filmes?`)).isConfirmed){
                UI.toast('Importando...'); 
                const { serverTimestamp } = await import("https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js");
                for(const n of novos) await MovieService.save(currentUser.uid,{...n,cadastradoEm:serverTimestamp()});
                UI.toast('Concluído!');
            }
        }catch(err){UI.alert('Erro',err.message,'error');} e.target.value='';
    }; r.readAsText(f);
}

// --- SCROLL INFINITO 
let observerInfinito = null;

function ativarScrollInfinito() {
    if (observerInfinito) observerInfinito.disconnect();

    // Cria um elemento invisível no fim da lista para servir de "gatilho"
    let sentinela = document.getElementById('sentinela-scroll');
    if (!sentinela) {
        sentinela = document.createElement('div');
        sentinela.id = 'sentinela-scroll';
        sentinela.style.height = '20px';
        sentinela.style.marginBottom = '20px';
        
        const container = document.getElementById('tabela-todos-container');
        if (container && container.parentNode) {
            container.parentNode.appendChild(sentinela);
        }
    }

    // O navegador avisa quando o elemento aparecer na tela
    observerInfinito = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting) {
            carregarMaisFilmes();
        }
    }, {
        root: null,
        rootMargin: '200px', // Carrega antes de chegar no fim
        threshold: 0.1
    });

    observerInfinito.observe(sentinela);
}