/* ==========================================================================
   MAIN.JS - O CÉREBRO DA APLICAÇÃO
   ==========================================================================
   Este arquivo conecta:
   1. O Auth.js (Login/Sessão)
   2. O Services.js (Banco de Dados e API)
   3. O UI.js (Interface Visual)
   ========================================================================== */

// 1. IMPORTAÇÕES
// --------------------------------------------------------------------------
import { onSnapshot, query, orderBy, serverTimestamp } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";
import { auth } from './config.js';
import { AuthService, MovieService } from './services.js';
import { UI } from './ui.js';
import { Auth } from './auth.js';

// ==========================================================================
// 2. ESTADO GLOBAL (VARIÁVEIS DE CONTROLE)
// ==========================================================================
// Estas variáveis guardam o estado atual do aplicativo na memória.

// Controle de Usuário
let currentUser = null;          // Objeto do usuário logado (Firebase Auth)
let currentUserProfile = null;   // Dados extras (Nickname, foto) do Firestore

// Controle de Dados
let unsubscribeFilmes = null;    // Função para parar de ouvir o banco (limpeza)
let filmes = [];                 // A lista COMPLETA de filmes vinda do banco
let filmesFiltrados = [];        // A lista que o usuário vê (após busca/filtros)
let filmeEmEdicaoId = null;      // ID do filme sendo editado (null = criando novo)

// Controle Visual (UI)
let currentView = 'table';       // Alterna entre 'table' (lista) e 'grid' (cards)
let sortBy = 'cadastradoEm';     // Qual campo está sendo usado para ordenar?
let sortDirection = 'asc';       // 'asc' (Crescente) ou 'desc' (Decrescente)
let generosSelecionados = [];    // Array para guardar as tags do formulário

// ==========================================================================
// 3. DADOS ESTÁTICOS E CONSTANTES
// ==========================================================================

// Lista para o autocomplete de Gêneros
const GENEROS_PREDEFINIDOS = [
    "Ação", "Aventura", "Animação", "Biografia", "Comédia", "Crime", 
    "Documentário", "Drama", "Esporte", "Fantasia", "Família", "Faroeste", 
    "Ficção Científica", "Guerra", "História", "Mistério", "Musical", 
    "Romance", "Suspense", "Terror"
].sort();

// Regras para as Conquistas (Gamification)
// Cada objeto define como ganhar uma medalha.
const CONQUISTAS_DEFINICOES = [
    { 
        id: 'cinefilo_10', 
        nome: 'Cinéfilo Iniciante', 
        descricao: 'Cadastrou seus primeiros 10 filmes.', 
        icone: 'fa-solid fa-film', 
        check: (lista) => lista.length >= 10 
    },
    { 
        id: 'critico_10', 
        nome: 'Crítico Exigente', 
        descricao: 'Deu nota 10 para um filme.', 
        icone: 'fa-solid fa-star', 
        check: (lista) => lista.some(f => f.nota === 10) 
    },
    { 
        id: 'nacional_5', 
        nome: 'Patriota do Cinema', 
        descricao: 'Cadastrou 5 filmes nacionais.', 
        icone: 'fa-solid fa-flag', 
        check: (lista) => lista.filter(f => f.origem === 'Nacional').length >= 5 
    },
    { 
        id: 'fa_carteirinha_3', 
        nome: 'Fã de Carteirinha', 
        descricao: '3 filmes do mesmo diretor.', 
        icone: 'fa-solid fa-user-check', 
        check: (lista) => { 
            const contagem = {}; 
            // Pega todos os diretores de todos os filmes e conta
            lista.flatMap(f => f.direcao || []).forEach(d => { 
                if(d) contagem[d] = (contagem[d] || 0) + 1; 
            }); 
            // Retorna verdadeiro se algum diretor tem 3 ou mais
            return Object.values(contagem).some(qtd => qtd >= 3); 
        }
    },
    { 
        id: 'maratonista_5', 
        nome: 'Maratonista', 
        descricao: 'Assistiu 5 filmes no mesmo mês.', 
        icone: 'fa-solid fa-person-running', 
        check: (lista) => { 
            const contagemMes = {}; 
            lista.filter(f => f.assistido && f.dataAssistido).forEach(f => { 
                try { 
                    const mes = f.dataAssistido.slice(0,7); // Pega YYYY-MM
                    contagemMes[mes] = (contagemMes[mes] || 0) + 1; 
                } catch(e){} 
            }); 
            return Object.values(contagemMes).some(qtd => qtd >= 5); 
        }
    }
];

// ==========================================================================
// 4. INICIALIZAÇÃO DO APP (ENTRY POINT)
// ==========================================================================
document.addEventListener('DOMContentLoaded', () => {
    
    // --- 4.1. RECUPERAÇÃO DO TEMA (DARK MODE) ---
    // Fazemos isso AGORA para evitar que o site pisque em branco
    const savedTheme = localStorage.getItem('theme') || 'dark';
    UI.setTheme(savedTheme);

    // Configura o botão de troca de tema (Lua/Sol)
    document.getElementById('theme-toggle')?.addEventListener('click', () => {
        const novoTema = UI.toggleTheme();
        localStorage.setItem('theme', novoTema);
        // Se houver gráficos na tela, precisamos redesenhá-los com as novas cores
        if(filmesFiltrados.length > 0) {
            UI.renderCharts(filmesFiltrados.filter(f => f.assistido));
        }
    });

    // --- 4.2. INICIALIZAÇÃO DA AUTENTICAÇÃO ---
    // O Auth.init decide se mostra o Login ou carrega o App
    Auth.init(
        // Callback de SUCESSO (Usuário acabou de logar ou já estava logado)
        (user) => {
            console.log("Main: Usuário autenticado:", user.email);
            currentUser = user;
            iniciarAplicacao(user);
        },
        // Callback de LOGOUT (Usuário saiu)
        () => {
            console.log("Main: Usuário deslogado");
            encerrarAplicacao();
        }
    );

    // --- 4.3. LISTENERS GENÉRICOS ---
    // Funcionalidades que podem ser preparadas mesmo sem login
    setupImportExportListeners();
});

// ==========================================================================
// 5. FUNÇÕES DE CARREGAMENTO DE DADOS
// ==========================================================================

// Chamada quando o login é confirmado
async function iniciarAplicacao(user) {
    try {
        // 1. Busca o perfil completo (Nickname, Data de entrada)
        const profile = await AuthService.getProfile(user.uid);
        
        if (profile) {
            currentUserProfile = profile;
            
            // 2. Agora que o HTML do App existe, configuramos os botões
            setupAppListeners(); 
            setupFormListeners();
            
            // 3. Preenche o <datalist> de gêneros no HTML
            const datalist = document.getElementById('generos-sugeridos');
            if(datalist) {
                datalist.innerHTML = GENEROS_PREDEFINIDOS
                    .map(g => `<option value="${g}"></option>`)
                    .join('');
            }
            
            // 4. Conecta ao Banco de Dados (Realtime)
            conectarBancoDeDados(user.uid);
            
        } else {
            console.warn("Perfil incompleto. O Auth.js deve tratar isso.");
        }
    } catch (e) {
        console.error("Erro fatal ao iniciar app:", e);
        UI.toast("Erro ao carregar seu perfil.", "error");
    }
}

// Chamada quando o usuário sai
function encerrarAplicacao() {
    currentUser = null;
    currentUserProfile = null;
    filmes = [];
    filmesFiltrados = [];
    
    // Para de consumir dados do Firebase (Economia)
    if (unsubscribeFilmes) unsubscribeFilmes();
    
    // Limpa a tela visualmente
    UI.clearMoviesList();
}

// Conexão em Tempo Real com o Firestore
function conectarBancoDeDados(uid) {
    if (unsubscribeFilmes) unsubscribeFilmes(); // Segurança contra dupla conexão

    // Query: Pegar coleção 'filmes' do usuário, ordenada por data
    const q = query(MovieService.getCollection(uid), orderBy("cadastradoEm", "asc"));

    // Listener: Roda AUTOMATICAMENTE sempre que algo muda no banco
    unsubscribeFilmes = onSnapshot(q, (snapshot) => {
        // Converte os dados brutos do Firebase para JSON normal
        filmes = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            // Converte Timestamp do Firebase para Date do JS
            cadastradoEm: doc.data().cadastradoEm?.toDate() || new Date(0)
        }));

        // Atualiza as opções do filtro de Ano (baseado nos filmes que existem)
        atualizarFiltroAnos();
        
        // Verifica se o usuário ganhou novas conquistas
        verificarConquistas();

        // Atualiza a tela
        refreshUI();
    }, (error) => {
        console.error("Erro na conexão Realtime:", error);
        UI.toast("Conexão com o banco perdida.", "error");
    });
}

function atualizarFiltroAnos() {
    // Cria uma lista única de anos presentes nos filmes
    const anosUnicos = [...new Set(filmes.map(f => f.ano).filter(Boolean))].sort((a,b)=>b-a);
    
    const selectAno = document.getElementById('filtro-ano');
    if(selectAno) {
        const valorAtual = selectAno.value;
        selectAno.innerHTML = '<option value="todos">Ano</option>';
        anosUnicos.forEach(ano => {
            selectAno.add(new Option(ano, ano));
        });
        selectAno.value = valorAtual; // Mantém a seleção do usuário se possível
    }
}

function verificarConquistas() {
    if(!currentUserProfile) return;
    
    // Mapeia todas as conquistas e verifica qual é true/false
    const conquistasStatus = CONQUISTAS_DEFINICOES.map(def => ({
        ...def, 
        unlocked: def.check(filmes)
    }));
    
    // Manda a UI desenhar as medalhas e atualizar o perfil lateral
    UI.renderAchievements(conquistasStatus);
    UI.renderProfile(currentUserProfile, filmes);
}

// ==========================================================================
// 6. LÓGICA DE UI (FILTRAGEM, BUSCA E ORDENAÇÃO)
// ==========================================================================

// Função Mestre: Chama filtros, ordena e desenha
function refreshUI() {
    filmesFiltrados = aplicarFiltros(filmes);
    filmesFiltrados = aplicarOrdenacao(filmesFiltrados);
    
    // Desenha na tela (Tabela ou Grid)
    UI.renderContent(filmesFiltrados, currentView);
}

function aplicarFiltros(lista) {
    // Coleta valores dos inputs
    const termo = document.getElementById('filtro-busca')?.value.toLowerCase() || '';
    const genero = document.getElementById('filtro-genero')?.value.toLowerCase() || '';
    const diretor = document.getElementById('filtro-diretor')?.value.toLowerCase() || '';
    const ator = document.getElementById('filtro-ator')?.value.toLowerCase() || '';
    const ano = document.getElementById('filtro-ano')?.value || 'todos';
    const origem = document.getElementById('filtro-origem')?.value || 'todos';
    const status = document.getElementById('filtro-assistido')?.value || 'todos';

    // Filtra
    return lista.filter(f => {
        if (termo && !f.titulo.toLowerCase().includes(termo)) return false;
        
        // Arrays (Gênero, Diretor, Ator) precisam de lógica especial (some)
        if (genero && !f.genero?.some(g => g.toLowerCase().includes(genero))) return false;
        if (diretor && !f.direcao?.some(d => d.toLowerCase().includes(diretor))) return false;
        if (ator && !f.atores?.some(a => a.toLowerCase().includes(ator))) return false;
        
        if (ano !== 'todos' && f.ano.toString() !== ano) return false;
        if (origem !== 'todos' && f.origem !== origem) return false;
        
        if (status !== 'todos') {
            const deveEstarAssistido = status === 'sim';
            if (f.assistido !== deveEstarAssistido) return false;
        }
        
        return true;
    });
}

function aplicarOrdenacao(lista) {
    return lista.sort((a, b) => {
        let valA = a[sortBy];
        let valB = b[sortBy];

        // Tratamento para valores nulos/undefined
        if (valA == null) valA = '';
        if (valB == null) valB = '';

        let comparacao = 0;

        // Detecta o tipo de dado para ordenar corretamente
        if (valA instanceof Date && valB instanceof Date) {
            comparacao = valA - valB;
        } else if (typeof valA === 'number' && typeof valB === 'number') {
            comparacao = valA - valB;
        } else {
            // Ordenação de texto (ignora maiúsculas/minúsculas)
            comparacao = String(valA).toLowerCase().localeCompare(String(valB).toLowerCase());
        }

        // Se a direção for descendente (Z-A), inverte o resultado
        if (comparacao !== 0) {
            return sortDirection === 'asc' ? comparacao : -comparacao;
        }
        
        // Desempate padrão: Título do filme
        return (a.titulo || '').localeCompare(b.titulo || '');
    });
}

// ==========================================================================
// 7. GERENCIAMENTO DE EVENTOS (LISTENERS)
// ==========================================================================

function setupAppListeners() {
    
    // --- 7.1. FILTROS ---
    const inputsFiltro = document.querySelectorAll('#filtros-container input, #filtros-container select');
    inputsFiltro.forEach(el => {
        // 'input' para digitação em tempo real, 'change' para selects
        const evento = el.tagName === 'SELECT' ? 'change' : 'input';
        el.addEventListener(evento, () => refreshUI());
    });
    
    // Botão "Limpar Filtros"
    document.getElementById('limpar-filtros')?.addEventListener('click', () => {
        inputsFiltro.forEach(el => el.value = el.tagName === 'SELECT' ? 'todos' : '');
        refreshUI();
    });

    // --- 7.2. ALTERNAR VISUALIZAÇÃO (GRID / TABLE) ---
    document.getElementById('view-btn-table')?.addEventListener('click', () => {
        currentView = 'table';
        document.getElementById('view-btn-table').classList.add('active');
        document.getElementById('view-btn-grid').classList.remove('active');
        refreshUI();
    });
    document.getElementById('view-btn-grid')?.addEventListener('click', () => {
        currentView = 'grid';
        document.getElementById('view-btn-grid').classList.add('active');
        document.getElementById('view-btn-table').classList.remove('active');
        refreshUI();
    });

    // --- 7.3. LISTENER GLOBAL (EVENT DELEGATION) ---
    // Em vez de colocar 100 listeners em 100 botões, colocamos 1 listener no documento.
    // Isso melhora muito a performance.
    document.addEventListener('click', async (e) => {
        const target = e.target;

        // A. CLIQUE NO CABEÇALHO DA TABELA (ORDENAÇÃO)
        const header = target.closest('th.sortable');
        if (header) {
            const coluna = header.dataset.sort;
            
            // Se clicar na mesma coluna, inverte a direção. Se for outra, reseta para asc.
            if (sortBy === coluna) {
                sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
            } else { 
                sortBy = coluna; 
                sortDirection = 'asc'; 
            }
            
            // Atualiza setinhas visuais
            document.querySelectorAll('th.sortable i').forEach(icon => icon.className = 'fas fa-sort');
            const activeIcon = header.querySelector('i');
            if(activeIcon) {
                activeIcon.className = sortDirection === 'asc' ? 'fas fa-sort-up' : 'fas fa-sort-down';
            }
            
            refreshUI();
            return;
        }

        // B. AÇÕES EM ITENS (TABELA OU GRID)
        // Verifica se clicou dentro de algo que tem um data-id (card ou linha)
        const itemEl = target.closest('[data-id]');
        if (!itemEl) return;
        const id = itemEl.dataset.id;

        // B1. Botão Editar
        if (target.closest('.btn-edit')) {
            e.stopPropagation(); // Não abre o modal de detalhes
            carregarParaEdicao(id);
            return;
        }

        // B2. Botão Excluir
        if (target.closest('.btn-delete')) {
            e.stopPropagation();
            const res = await UI.confirm('Excluir Filme?', 'Esta ação não pode ser desfeita.');
            if (res.isConfirmed) {
                try {
                    await MovieService.delete(currentUser.uid, id);
                    UI.toast('Filme excluído com sucesso.');
                } catch(err) {
                    UI.alert('Erro', err.message, 'error');
                }
            }
            return;
        }

        // B3. Expandir Detalhes (Versão Mobile/Tabela)
        const btnDetalhes = target.closest('.btn-detalhes');
        if (btnDetalhes) {
            const icon = btnDetalhes.querySelector('i');
            // Pequeno delay para esperar o Bootstrap atualizar o atributo aria
            setTimeout(() => {
                const isExpanded = btnDetalhes.getAttribute('aria-expanded') === 'true';
                icon.style.transform = isExpanded ? 'rotate(180deg)' : 'rotate(0deg)';
            }, 50);
            return;
        }

        // B4. Clique na Linha da Tabela (Atalho para expandir)
        if (currentView === 'table' && !target.closest('.dropdown') && !target.closest('button') && !target.closest('a')) {
             const row = target.closest('tr[data-id]');
             if(row) {
                 const btn = row.querySelector('.btn-detalhes');
                 if(btn) btn.click(); 
             }
             return;
        }

        // B5. Clique no Card (Modo Grid) -> Abre Modal Grande
        if (currentView === 'grid' && !target.closest('.dropdown') && !target.closest('button')) {
            const filme = filmes.find(f => f.id === id);
            if (filme) {
                UI.showMovieDetailModal(filme, async (idFilme) => {
                    // Callback quando clica em "Marcar como Assistido" no modal
                    await MovieService.toggleAssistido(currentUser.uid, idFilme, true);
                    UI.toast('Marcado como assistido!');
                });
            }
        }
    });

    // --- 7.4. BOTÃO SUGERIR FILME ---
    document.getElementById('sugerir-filme-btn')?.addEventListener('click', sugerirFilmeAleatorio);
}

function setupImportExportListeners() {
    document.getElementById('export-json-btn')?.addEventListener('click', exportarJSON);
    document.getElementById('export-csv-btn')?.addEventListener('click', exportarCSV);
    
    // O botão visual clica no input file escondido
    document.getElementById('import-btn')?.addEventListener('click', () => {
        document.getElementById('import-file-input').click();
    });
    
    // Quando o usuário seleciona o arquivo
    document.getElementById('import-file-input')?.addEventListener('change', importarArquivo);
}

// ==========================================================================
// 8. FORMULÁRIO (SALVAR, EDITAR E API OMDB)
// ==========================================================================

function setupFormListeners() {
    const form = document.getElementById('filme-form');
    if (!form) return;

    // A. Buscar na API OMDb
    const btnBuscar = document.getElementById('btn-buscar-omdb');
    const inputTitulo = document.getElementById('titulo');

    btnBuscar?.addEventListener('click', buscarOMDb);
    
    // Busca ao apertar Enter no título
    inputTitulo?.addEventListener('keypress', (e) => {
        if(e.key === 'Enter') { e.preventDefault(); buscarOMDb(); }
    });

    // B. Sistema de Tags (Gêneros)
    const generoInput = document.getElementById('genero-input');
    if (generoInput) {
        generoInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') { 
                e.preventDefault(); 
                adicionarGenero(generoInput.value); 
            }
            // Remove a última tag se apertar Backspace no campo vazio
            if (e.key === 'Backspace' && generoInput.value === '') {
                if(generosSelecionados.length > 0) {
                    removerGenero(generosSelecionados[generosSelecionados.length-1]);
                }
            }
        });
        
        // Adiciona automaticamente se selecionar algo da lista suspensa
        generoInput.addEventListener('input', () => {
             if (GENEROS_PREDEFINIDOS.includes(generoInput.value)) {
                 adicionarGenero(generoInput.value);
             }
        });
    }

    // C. Alternar Input de Data
    document.getElementById('assistido')?.addEventListener('change', (e) => {
        UI.toggleDataAssistido(e.target.value === 'sim');
    });

    // D. Envio do Formulário (Submit)
    form.addEventListener('submit', async (e) => {
        e.preventDefault(); 
        e.stopPropagation();

        // Validação HTML5 (Bootstrap)
        if (!form.checkValidity()) {
            form.classList.add('was-validated');
            return;
        }

        // Prepara os dados
        const titulo = document.getElementById('titulo').value.trim();
        
        // Validação da URL da imagem
        let posterUrl = document.getElementById('poster-preview-img').src;
        // Se a imagem for a padrão do sistema ou vazia, salvamos como string vazia
        if (posterUrl.includes(window.location.href) || posterUrl === '') {
            posterUrl = '';
        }

        const dadosFilme = {
            titulo: titulo,
            ano: parseInt(document.getElementById('ano').value) || null,
            nota: parseFloat(document.getElementById('nota').value) || 0,
            
            // Converte string "A, B, C" para array ["A", "B", "C"]
            direcao: document.getElementById('direcao').value.split(',').map(s=>s.trim()).filter(Boolean),
            atores: document.getElementById('atores').value.split(',').map(s=>s.trim()).filter(Boolean),
            
            genero: [...generosSelecionados], // Copia do array global
            origem: document.getElementById('origem').value,
            
            assistido: document.getElementById('assistido').value === 'sim',
            dataAssistido: document.getElementById('assistido').value === 'sim' 
                ? document.getElementById('data-assistido').value 
                : null,
            
            posterUrl: posterUrl
        };

        // Feedback de Loading no botão
        const btn = form.querySelector('button[type="submit"]');
        const textoOriginal = btn.innerHTML;
        btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Processando...';
        btn.disabled = true;

        try {
            // Chama o Service para salvar ou atualizar no Firebase
            await MovieService.save(currentUser.uid, dadosFilme, filmeEmEdicaoId);
            
            UI.toast(filmeEmEdicaoId ? 'Filme atualizado!' : 'Filme salvo com sucesso!');
            
            // Limpeza
            UI.clearForm();
            generosSelecionados = [];
            filmeEmEdicaoId = null;
            document.getElementById('cadastro-titulo').innerHTML = '<i class="fas fa-edit me-2"></i> Cadastro de Filme';
            
        } catch (error) {
            UI.alert('Erro ao Salvar', error.message, 'error');
        } finally {
            // Restaura o botão
            btn.innerHTML = textoOriginal;
            btn.disabled = false;
        }
    });
}

// ==========================================================================
// 9. FUNÇÕES AUXILIARES
// ==========================================================================

// --- Lógica OMDb ---
async function buscarOMDb() {
    const titulo = document.getElementById('titulo').value.trim();
    const anoInput = document.getElementById('ano').value.trim();
    
    if (!titulo) return UI.toast('Digite um título para buscar', 'warning');
    
    document.getElementById('api-loading').style.display = 'flex';
    
    try {
        const data = await MovieService.searchOMDb(titulo, anoInput);
        
        // Preenchimento automático dos campos
        document.getElementById('titulo').value = data.Title;
        document.getElementById('ano').value = parseInt(data.Year) || '';
        document.getElementById('nota').value = parseFloat(data.imdbRating) || '';
        document.getElementById('direcao').value = data.Director !== 'N/A' ? data.Director : '';
        document.getElementById('atores').value = data.Actors !== 'N/A' ? data.Actors : '';
        
        if (data.Country) {
            document.getElementById('origem').value = data.Country.includes("Brazil") ? "Nacional" : "Internacional";
        }

        let poster = '';
        if (data.Poster && data.Poster !== 'N/A') poster = data.Poster;
        UI.updatePreviewPoster(poster);

        // Processamento inteligente de Gêneros
        generosSelecionados = [];
        if (data.Genre && data.Genre !== 'N/A') {
            data.Genre.split(', ').forEach(g => adicionarGenero(g));
        }

        UI.toast('Dados encontrados na nuvem!');
    } catch (error) {
        UI.toast(error.message, 'error');
    } finally {
        document.getElementById('api-loading').style.display = 'none';
    }
}

// --- Lógica de Tags ---
function adicionarGenero(tag) {
    const t = tag.trim();
    // Evita duplicatas e vazios
    if (!t || generosSelecionados.includes(t)) return;
    
    generosSelecionados.push(t);
    UI.renderGenerosTags(generosSelecionados, removerGenero); // Atualiza visual
    
    // Limpa input e foca
    const input = document.getElementById('genero-input');
    input.value = '';
    input.focus();
}

function removerGenero(tag) {
    generosSelecionados = generosSelecionados.filter(g => g !== tag);
    UI.renderGenerosTags(generosSelecionados, removerGenero);
}

// --- Edição ---
function carregarParaEdicao(id) {
    const filme = filmes.find(f => f.id === id);
    if (!filme) return;

    filmeEmEdicaoId = id;
    
    // Muda o título do card
    document.getElementById('cadastro-titulo').innerHTML = `<i class="fas fa-pen me-2"></i> Editando: ${filme.titulo}`;
    
    // Recupera gêneros
    generosSelecionados = filme.genero ? [...filme.genero] : [];
    
    // Preenche o form visualmente
    UI.fillForm(filme, (tags) => UI.renderGenerosTags(tags, removerGenero));
    
    // Rola a página até o formulário
    document.getElementById('cadastro-section').scrollIntoView({ behavior: 'smooth' });
}

// --- Sugestão Aleatória ---
function sugerirFilmeAleatorio() {
    const pendentes = filmes.filter(f => !f.assistido);
    
    if (!pendentes.length) {
        return UI.alert('Zerou a Lista!', 'Você já assistiu todos os filmes cadastrados!', 'success');
    }
    
    const random = pendentes[Math.floor(Math.random() * pendentes.length)];
    
    UI.showRandomSuggestion(
        random, 
        async (id) => { 
            await MovieService.toggleAssistido(currentUser.uid, id, true); 
            UI.toast('Marcado como assistido!'); 
        },
        () => sugerirFilmeAleatorio() // Tentar outro
    );
}

// ==========================================================================
// 10. IMPORTAÇÃO E EXPORTAÇÃO (JSON / CSV)
// ==========================================================================

function exportarJSON() {
    if(!filmesFiltrados.length) return UI.toast('Lista vazia', 'warning');
    
    const dadosStr = JSON.stringify(filmesFiltrados, null, 2);
    const nomeArquivo = `meus_filmes_${new Date().toISOString().slice(0,10)}.json`;
    
    downloadFile(dadosStr, nomeArquivo, 'application/json');
}

function exportarCSV() {
    if(!filmesFiltrados.length) return UI.toast('Lista vazia', 'warning');
    
    const headers = ['titulo', 'ano', 'nota', 'direcao', 'atores', 'genero', 'origem', 'assistido', 'dataAssistido', 'posterUrl'];
    
    // Constrói o CSV linha a linha
    const csvContent = [
        headers.join(','),
        ...filmesFiltrados.map(f => headers.map(h => {
            let val = f[h];
            if(Array.isArray(val)) val = val.join('; '); // Arrays viram "Item1; Item2"
            if(val == null) val = '';
            
            val = String(val).replace(/"/g, '""'); // Escapa aspas
            if(val.includes(',')) val = `"${val}"`; // Protege vírgulas
            return val;
        }).join(','))
    ].join('\n');
    
    const nomeArquivo = `meus_filmes_${new Date().toISOString().slice(0,10)}.csv`;
    downloadFile(csvContent, nomeArquivo, 'text/csv;charset=utf-8;');
}

// Cria um link invisível para forçar o download
function downloadFile(content, fileName, mimeType) {
    const a = document.createElement("a");
    const file = new Blob([content], { type: mimeType });
    a.href = URL.createObjectURL(file);
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(a.href);
}

function importarArquivo(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
        let imported = [];
        try {
            const content = e.target.result;
            
            if (file.name.endsWith('.json')) {
                imported = JSON.parse(content);
            } else if (file.name.endsWith('.csv')) {
                // Parser manual de CSV
                const lines = content.split(/\r?\n/).filter(l => l.trim());
                const headers = lines.shift().split(',');
                
                imported = lines.map(line => {
                    // Expressão Regular complexa para lidar com CSVs que têm vírgulas dentro de aspas
                    // Ex: "O Bom, o Mau e o Feio", 1966
                    const regexCSV = /,(?=(?:(?:[^"]*"){2})*[^"]*$)/;
                    const vals = line.split(regexCSV); 
                    
                    return headers.reduce((obj, header, i) => {
                        let val = vals[i] ? vals[i].trim() : '';
                        
                        // Remove aspas envolventes
                        if(val.startsWith('"') && val.endsWith('"')) val = val.slice(1,-1);
                        val = val.replace(/""/g, '"'); // Restaura aspas escapadas
                        
                        // Converte tipos
                        if(['genero','direcao','atores'].includes(header)) obj[header] = val ? val.split(';').map(s=>s.trim()) : [];
                        else if(['ano','nota'].includes(header)) obj[header] = Number(val);
                        else if(header === 'assistido') obj[header] = val.toLowerCase() === 'true';
                        else obj[header] = val;
                        
                        return obj;
                    }, {});
                });
            }

            if(!imported.length) throw new Error("Arquivo vazio ou formato inválido");
            
            // Filtra duplicatas (pelo título)
            const titulosAtuais = new Set(filmes.map(f => f.titulo.toLowerCase()));
            const novos = imported.filter(f => f.titulo && !titulosAtuais.has(String(f.titulo).toLowerCase()));

            if (novos.length === 0) return UI.alert('Informação', 'Todos os filmes do arquivo já estão na sua lista.', 'info');
            
            const confirm = await UI.confirm('Importar', `Encontrados ${novos.length} novos filmes. Deseja importar?`);
            
            if (confirm.isConfirmed) {
                if(!currentUser) return UI.alert('Erro', 'Você precisa estar logado.', 'error');
                
                // Barra de progresso visual (opcional) ou Toast loop
                UI.toast(`Importando ${novos.length} filmes... aguarde.`);
                
                for (const filme of novos) {
                    await MovieService.save(currentUser.uid, { ...filme, cadastradoEm: serverTimestamp() });
                }
                
                UI.toast('Importação concluída com sucesso!');
            }
        } catch (err) {
            UI.alert('Erro na Importação', err.message, 'error');
        }
        event.target.value = ''; // Reseta o input
    };
    reader.readAsText(file);
}