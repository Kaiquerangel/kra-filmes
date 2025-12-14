/* ==========================================================================
   MAIN.JS - O CONTROLADOR PRINCIPAL 
   --------------------------------------------------------------------------
   Este conecta as três partes vitais:
   1. O Banco de Dados e Auth (Firebase/Services.js)
   2. A Interface Visual (UI.js)
   3. As Ações do Usuário (Cliques, Envios, Inputs)
   ========================================================================== */

// 1. IMPORTAÇÕES
// Funcionalidades do Firebase e módulos locais.
// O uso de 'type="module"' no HTML permite esses imports.
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";
import { onSnapshot, query, orderBy, serverTimestamp } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";
import { auth, db } from './config.js';
import { Auth } from './auth.js';
import { AuthService, MovieService } from './services.js'; // Regras de negócio
import { UI } from './ui.js'; // Manipulação do DOM (HTML)

// ==========================================================================
// 1. ESTADO GLOBAL 
// ==========================================================================
// Dados centralizados aqui. Se qualquer função quiser saber "quem está logado"
// ou "quais filmes estão na tela", ela consulta estas variáveis.
let currentUser = null;          // Usuário do Firebase Auth
let currentUserProfile = null;   // Dados extras (nickname) do Firestore
let unsubscribeFilmes = null;    // Função para desligar a conexão com o banco (evita vazamento de memória)
let filmes = [];                 // Lista bruta (todos os filmes do banco)
let filmesFiltrados = [];        // Lista processada (após busca/filtros) que o usuário vê
let filmeEmEdicaoId = null;      // Se null = criando novo; Se tem ID = editando existente

// Estados da Interface (UI State)
let currentView = 'table';       // Alterna entre 'table' (lista) e 'grid' (cards)
let sortBy = 'cadastradoEm';     // Qual campo dita a ordem?
let sortDirection = 'asc';       // 'asc' (A-Z) ou 'desc' (Z-A)
let generosSelecionados = [];    // Array temporário para as tags do formulário

// Controle de "Debounce" (Performance)
// Usado para não chamar o banco de dados a cada letra digitada no nickname.
let nicknameCheckTimer = null;
let lastCheckedNickname = '';

// Definições (Regras das Conquistas)
const CONQUISTAS_DEFINICOES = [
    { id: 'cinefilo_10', nome: 'Cinéfilo Iniciante', descricao: 'Cadastrou 10 filmes.', icone: 'fa-solid fa-film', check: (lista) => lista.length >= 10 },
    { id: 'critico_10', nome: 'Crítico de Cinema', descricao: 'Deu nota 10 para um filme.', icone: 'fa-solid fa-star', check: (lista) => lista.some(f => f.nota === 10) },
    { id: 'nacional_5', nome: 'Viva o Cinema Nacional', descricao: '5 filmes nacionais.', icone: 'fa-solid fa-flag', check: (lista) => lista.filter(f => f.origem === 'Nacional').length >= 5 },
    // Lógica: Conta frequência de diretores
    { id: 'fa_carteirinha_3', nome: 'Fã de Carteirinha', descricao: '3 filmes do mesmo diretor.', icone: 'fa-solid fa-user-check', check: (lista) => { 
        const d = {}; 
        lista.flatMap(f => f.direcao || []).forEach(x => { if(x) d[x] = (d[x]||0)+1; }); 
        return Object.values(d).some(c => c >= 3); 
    }},
    // Lógica: Agrupa assistidos por mês (YYYY-MM)
    { id: 'maratonista_5', nome: 'O Maratonista', descricao: '5 filmes assistidos no mês.', icone: 'fa-solid fa-person-running', check: (lista) => { 
        const m = {}; 
        lista.filter(f => f.assistido && f.dataAssistido).forEach(f => { try { const k = f.dataAssistido.slice(0,7); m[k] = (m[k]||0)+1; } catch(e){} }); 
        return Object.values(m).some(c => c >= 5); 
    }}
];

// Dados estáticos para o autocomplete (<datalist>)
const GENEROS_PREDEFINIDOS = ["Action", "Adventure", "Animation", "Comedy", "Crime", "Documentary", "Drama", "Fantasy", "History", "Horror", "Music", "Mystery", "Romance", "Science Fiction", "Thriller", "War", "Western"].sort();

// ==========================================================================
// 2. INICIALIZAÇÃO (BOOTSTRAP)
// ==========================================================================
// O código só roda quando o HTML estiver 100% pronto.
document.addEventListener('DOMContentLoaded', () => {
    // Configura os "ouvintes" (Listeners) que ficarão esperando ações
    setupAuthListeners();
    setupAppListeners();
    setupFormListeners();
    
    // Injeta as opções de gênero no HTML
    const datalist = document.getElementById('generos-sugeridos');
    if(datalist) datalist.innerHTML = GENEROS_PREDEFINIDOS.map(g => `<option value="${g}"></option>`).join('');
});

// ==========================================================================
// 3. LISTENERS DE AUTENTICAÇÃO
// ==========================================================================
function setupAuthListeners() {
    // OBSERVER PATTERN: O Firebase avisa sempre que o status muda.
    // Funciona mesmo se o usuário der F5 ou fechar e abrir a aba.
    onAuthStateChanged(auth, async (user) => {
        currentUser = user;
        if (user) {
            // --- USUÁRIO LOGADO ---
            try {
                // Busca o perfil estendido (com nickname) no Firestore
                const profile = await AuthService.getProfile(user.uid);
                if (profile) {
                    currentUserProfile = profile;
                    UI.toggleAuthView(true, profile); // UI: Mostra o App
                    initRealtimeData(user.uid);       // Conecta ao Banco
                } else {
                    // Logou (ex: Google) mas não tem perfil no banco -> Cria agora
                    await handleCompleteProfile(user);
                }
            } catch (error) {
                console.error(error);
                UI.toast('Erro ao carregar perfil.', 'error');
                AuthService.logout(); // Segurança: desloga se der erro crítico
            }
        } else {
            // --- USUÁRIO DESLOGADO ---
            currentUserProfile = null;
            filmes = [];
            // Importante: Para de ouvir o banco para não gastar dados
            if (unsubscribeFilmes) unsubscribeFilmes(); 
            UI.toggleAuthView(false); // UI: Mostra o Login
        }
    });

    // Login (Formulário)
    document.getElementById('login-form')?.addEventListener('submit', async (e) => {
        e.preventDefault(); // Impede recarregar a página
        try {
            await AuthService.login(document.getElementById('login-identifier').value, document.getElementById('login-password').value);
            // Não precisa redirecionar, o onAuthStateChanged fará isso.
        } catch (error) {
            UI.alert('Erro', error.code === 'auth/user-not-found' ? 'Usuário não encontrado.' : 'Senha incorreta.', 'error');
        }
    });

    // Registro (Criar Conta)
    document.getElementById('register-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const nick = document.getElementById('register-nickname').value;
        
        // Validação de segurança final antes de enviar
        const isNickAvailable = await AuthService.checkNickname(nick);
        if (!isNickAvailable && nick !== lastCheckedNickname) return UI.alert('Erro', 'Nickname indisponível.', 'warning');
        
        try {
            await AuthService.register(
                document.getElementById('register-name').value, 
                nick, 
                document.getElementById('register-email').value, 
                document.getElementById('register-password').value
            );
            UI.toast('Conta criada com sucesso!');
        } catch (error) {
            UI.alert('Erro no Cadastro', error.message, 'error');
        }
    });

    // Navegação Simples (Esconder/Mostrar Divs de Login/Registro)
    document.getElementById('show-register-link')?.addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('login-card').style.display = 'none';
        document.getElementById('register-card').style.display = 'block';
    });

    document.getElementById('show-login-link')?.addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('login-card').style.display = 'block';
        document.getElementById('register-card').style.display = 'none';
    });

    // Botão Sair
    document.getElementById('logout-btn')?.addEventListener('click', () => AuthService.logout());

    // Recuperação de Senha
    document.getElementById('perfil-trocar-senha-btn')?.addEventListener('click', async () => {
        if(!currentUser?.email) return;
        try {
            await AuthService.recoverPassword(currentUser.email);
            UI.alert('E-mail Enviado', `Link enviado para ${currentUser.email}`, 'success');
        } catch(e) { UI.alert('Erro', e.message, 'error'); }
    });

    // --- VALIDAÇÃO DE NICKNAME (UX/UI) ---
    const nickInput = document.getElementById('register-nickname');
    if (nickInput) {
        nickInput.addEventListener('input', () => {
            // TÉCNICA DE DEBOUNCE:
            // Se o usuário digitar rápido, cancela o timer anterior.
            // Só valida se ele parar de digitar por 800ms.
            clearTimeout(nicknameCheckTimer);
            const val = nickInput.value.trim().toLowerCase();
            
            // Limpa visual
            document.getElementById('nickname-loading').style.display = 'none';
            document.getElementById('nickname-success').style.display = 'none';
            document.getElementById('nickname-error').style.display = 'none';
            nickInput.classList.remove('is-valid', 'is-invalid');

            if (val.length < 4) {
                nickInput.classList.add('is-invalid');
                return;
            }
            
            // Inicia o timer
            document.getElementById('nickname-loading').style.display = 'block';
            nicknameCheckTimer = setTimeout(async () => {
                lastCheckedNickname = val;
                const available = await AuthService.checkNickname(val);
                document.getElementById('nickname-loading').style.display = 'none';
                
                // Feedback visual (Verde ou Vermelho)
                if (available) {
                    document.getElementById('nickname-success').style.display = 'block';
                    nickInput.classList.add('is-valid');
                } else {
                    document.getElementById('nickname-error').style.display = 'block';
                    nickInput.classList.add('is-invalid');
                }
            }, 800);
        });
    }
}

// Auxiliar caso o cadastro precise ser completado manualmente
async function handleCompleteProfile(user) {
    const { value: formValues } = await Swal.fire({
        title: 'Complete seu Perfil',
        html: `<input id="swal-nome" class="swal2-input" placeholder="Seu Nome"><input id="swal-nick" class="swal2-input" placeholder="Nickname">`,
        focusConfirm: false, allowOutsideClick: false,
        preConfirm: () => [document.getElementById('swal-nome').value, document.getElementById('swal-nick').value]
    });

    if (formValues) {
        const [nome, nick] = formValues;
        try {
            const { setDoc, doc } = await import("https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js");
            await setDoc(doc(db, "users", user.uid), {
                uid: user.uid, nome, nickname: nick, email: user.email, membroDesde: serverTimestamp()
            });
            window.location.reload();
        } catch(e) { UI.alert('Erro', 'Falha ao salvar perfil.', 'error'); }
    }
}

// ==========================================================================
// 4. CONEXÃO REALTIME (FIRESTORE)
// ==========================================================================
function initRealtimeData(uid) {
    if (unsubscribeFilmes) unsubscribeFilmes(); // Limpa listener antigo

    // Cria a query (pergunta) para o banco
    const q = query(MovieService.getCollection(uid), orderBy("cadastradoEm", "asc"));

    // onSnapshot: Esta função roda AUTOMATICAMENTE sempre que o banco muda.
    // Se você adicionar um filme pelo celular, o PC atualiza na hora.
    unsubscribeFilmes = onSnapshot(q, (snapshot) => {
        // Converte o formato estranho do Firebase para Array JS
        filmes = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            cadastradoEm: doc.data().cadastradoEm?.toDate() || new Date(0)
        }));

        // Atualiza o select de "Ano" para mostrar apenas anos que existem na lista
        updateFilterOptions();
        
        // Verifica se ganhou medalhas novas
        if(currentUserProfile) {
            const conquistasCalculadas = CONQUISTAS_DEFINICOES.map(c => ({
                ...c, unlocked: c.check(filmes)
            }));
            UI.renderAchievements(conquistasCalculadas);
            UI.renderProfile(currentUserProfile, filmes);
        }

        // Manda desenhar a tela
        refreshUI();
    });
}

function updateFilterOptions() {
    const anos = [...new Set(filmes.map(f => f.ano).filter(Boolean))].sort((a,b)=>b-a);
    const selectAno = document.getElementById('filtro-ano');
    if(selectAno) {
        const currentVal = selectAno.value;
        selectAno.innerHTML = '<option value="todos">Ano</option>';
        anos.forEach(ano => selectAno.add(new Option(ano, ano)));
        selectAno.value = currentVal; // Mantém a seleção do usuário
    }
}

// ==========================================================================
// 5. LÓGICA DE UI (FILTRAGEM E ORDENAÇÃO)
// ==========================================================================
function refreshUI() {
    filmesFiltrados = aplicarFiltros(filmes);
    filmesFiltrados = aplicarOrdenacao(filmesFiltrados);
    UI.renderContent(filmesFiltrados, currentView);
}

function aplicarFiltros(lista) {
    // Coleta o valor atual de TODOS os inputs de filtro
    const termo = document.getElementById('filtro-busca')?.value.toLowerCase() || '';
    const genero = document.getElementById('filtro-genero')?.value.toLowerCase() || '';
    const diretor = document.getElementById('filtro-diretor')?.value.toLowerCase() || '';
    const ator = document.getElementById('filtro-ator')?.value.toLowerCase() || '';
    const ano = document.getElementById('filtro-ano')?.value || 'todos';
    const origem = document.getElementById('filtro-origem')?.value || 'todos';
    const status = document.getElementById('filtro-assistido')?.value || 'todos';

    // Retorna apenas os filmes que passam em TODOS os testes
    return lista.filter(f => {
        if (termo && !f.titulo.toLowerCase().includes(termo)) return false;
        if (genero && !f.genero?.some(g => g.toLowerCase().includes(genero))) return false;
        if (diretor && !f.direcao?.some(d => d.toLowerCase().includes(diretor))) return false;
        if (ator && !f.atores?.some(a => a.toLowerCase().includes(ator))) return false;
        if (ano !== 'todos' && f.ano.toString() !== ano) return false;
        if (origem !== 'todos' && f.origem !== origem) return false;
        if (status !== 'todos') {
            const isAssistido = status === 'sim';
            if (f.assistido !== isAssistido) return false;
        }
        return true;
    });
}

function aplicarOrdenacao(lista) {
    return lista.sort((a, b) => {
        let valA = a[sortBy];
        let valB = b[sortBy];

        // Tratamento de nulos
        if (valA === null || valA === undefined) valA = '';
        if (valB === null || valB === undefined) valB = '';

        let comparison = 0;
        // Lógica para saber se compara números, datas ou texto
        if (valA instanceof Date && valB instanceof Date) comparison = valA - valB;
        else if (typeof valA === 'number' && typeof valB === 'number') comparison = valA - valB;
        else comparison = String(valA).toLowerCase().localeCompare(String(valB).toLowerCase());

        // Inverte se a direção for descendente
        if (comparison !== 0) return sortDirection === 'asc' ? comparison : -comparison;
        
        // Critério de desempate: Título
        return (a.titulo || '').localeCompare(b.titulo || '');
    });
}

// ==========================================================================
// 6. EVENT DELEGATION (PERFORMANCE DE CLIQUES)
// ==========================================================================
function setupAppListeners() {
    // Listeners para os Inputs de Filtro
    const inputsFiltro = document.querySelectorAll('#filtros-container input, #filtros-container select');
    inputsFiltro.forEach(el => {
        // 'input' para digitação, 'change' para dropdowns
        el.addEventListener(el.tagName === 'SELECT' ? 'change' : 'input', () => refreshUI());
    });
    
    // Botão Limpar Filtros
    document.getElementById('limpar-filtros')?.addEventListener('click', () => {
        inputsFiltro.forEach(el => el.value = el.tagName === 'SELECT' ? 'todos' : '');
        refreshUI();
    });

    // Troca de Visualização (Tabela vs Grid)
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

    // Troca de Tema (Salva no LocalStorage do navegador)
    document.getElementById('theme-toggle')?.addEventListener('click', () => {
        const theme = UI.toggleTheme();
        localStorage.setItem('theme', theme);
        UI.renderCharts(filmesFiltrados.filter(f => f.assistido)); // Redesenha gráficos com novas cores
    });
    const savedTheme = localStorage.getItem('theme') || 'dark';
    UI.setTheme(savedTheme);

    // --- LISTENER GLOBAL DE CLIQUES ---
    // Em vez de colocar um listener em cada botão de cada linha da tabela (o que seria lento),
    // coloca um único listener no documento. Quando clica, verifica ONDE foi.
    document.addEventListener('click', async (e) => {
        const target = e.target;

        // 1. Clicou no Cabeçalho da Tabela? (Ordenação)
        const header = target.closest('th.sortable');
        if (header) {
            const col = header.dataset.sort;
            if (sortBy === col) sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
            else { sortBy = col; sortDirection = 'asc'; }
            
            // Atualiza ícones (setinhas)
            document.querySelectorAll('th.sortable i').forEach(icon => icon.className = 'fas fa-sort');
            const activeIcon = header.querySelector('i');
            if(activeIcon) activeIcon.className = sortDirection === 'asc' ? 'fas fa-sort-up' : 'fas fa-sort-down';
            
            refreshUI();
            return;
        }

        // Elementos que possuem ID (Linhas da tabela ou Cards)
        const itemEl = target.closest('[data-id]');
        if (!itemEl) return;
        const id = itemEl.dataset.id;

        // 2. Botão Editar
        if (target.closest('.btn-edit')) {
            e.stopPropagation(); // Impede que o clique "vaze" e abra o modal de detalhes
            carregarParaEdicao(id);
            return;
        }

        // 3. Botão Excluir
        if (target.closest('.btn-delete')) {
            e.stopPropagation();
            const res = await UI.confirm('Excluir?', 'Esta ação não pode ser revertida.');
            if (res.isConfirmed) {
                try {
                    await MovieService.delete(currentUser.uid, id);
                    UI.toast('Filme excluído.');
                } catch(err) { UI.alert('Erro', err.message, 'error'); }
            }
            return;
        }

        // 4. Botão "Detalhes" (Setinha da Tabela)
        const btnDetalhes = target.closest('.btn-detalhes');
        if (btnDetalhes) {
            const icon = btnDetalhes.querySelector('i');
            // Pequeno delay para esperar o Bootstrap mudar o atributo aria-expanded
            setTimeout(() => {
                const isExpanded = btnDetalhes.getAttribute('aria-expanded') === 'true';
                icon.style.transform = isExpanded ? 'rotate(180deg)' : 'rotate(0deg)';
            }, 50);
            return;
        }

        // 5. Clique Genérico na Linha (Table) -> Simula clique na setinha
        if (currentView === 'table' && !target.closest('.dropdown') && !target.closest('button') && !target.closest('a')) {
             const row = target.closest('tr[data-id]');
             if(row) {
                 const btn = row.querySelector('.btn-detalhes');
                 if(btn) btn.click(); 
             }
             return;
        }

        // 6. Clique Genérico no Card (Grid) -> Abre Modal de Detalhes
        if (currentView === 'grid' && !target.closest('.dropdown') && !target.closest('button')) {
            const filme = filmes.find(f => f.id === id);
            if (filme) {
                UI.showMovieDetailModal(filme, async (idFilme) => {
                    // Ao abrir, marca como assistido automaticamente
                    await MovieService.toggleAssistido(currentUser.uid, idFilme, true);
                    UI.toast('Marcado como assistido!');
                });
            }
        }
    });

    // Listeners Extras (Import/Export/Sugerir)
    document.getElementById('sugerir-filme-btn')?.addEventListener('click', sugerirFilme);
    document.getElementById('export-json-btn')?.addEventListener('click', exportarJSON);
    document.getElementById('export-csv-btn')?.addEventListener('click', exportarCSV);
    document.getElementById('import-btn')?.addEventListener('click', () => document.getElementById('import-file-input').click());
    document.getElementById('import-file-input')?.addEventListener('change', importarArquivo);

// ==========================================================================
    // Clique na imagem (ou no placeholder) para trocar a capa manualmente
  //  document.querySelector('.poster-preview-container')?.addEventListener('click', async () => {
    //    const { value: url } = await Swal.fire({
      //      title: 'Trocar Capa',
        //    input: 'url',
          //  inputLabel: 'Cole o link da imagem (URL)',
            //inputPlaceholder: 'https://...',
          //  showCancelButton: true
   //     });

     //   if (url) {
       //     UI.updatePreviewPoster(url);
      //  }
   // });
// ==========================================================================
}
// ==========================================================================
// 7. FORM LISTENERS (CADASTRO E EDIÇÃO)
// ==========================================================================
function setupFormListeners() {
    const form = document.getElementById('filme-form');
    if (!form) return;

    // Busca na API OMDb
    document.getElementById('btn-buscar-omdb')?.addEventListener('click', buscarOMDb);
    document.getElementById('titulo')?.addEventListener('keypress', (e) => {
        if(e.key === 'Enter') { e.preventDefault(); buscarOMDb(); }
    });

    // Sistema de Tags (Gêneros)
    const generoInput = document.getElementById('genero-input');
    if (generoInput) {
        generoInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); adicionarGenero(generoInput.value); }
            if (e.key === 'Backspace' && generoInput.value === '') {
                // Remove última tag se apagar campo vazio
                if(generosSelecionados.length) removerGenero(generosSelecionados[generosSelecionados.length-1]);
            }
        });
        generoInput.addEventListener('input', () => {
             // Adiciona automático se selecionar do autocomplete
             if (GENEROS_PREDEFINIDOS.includes(generoInput.value)) adicionarGenero(generoInput.value);
        });
    }

    // Toggle de Data (Mostra input de data se "Assistido = Sim")
    document.getElementById('assistido')?.addEventListener('change', (e) => {
        UI.toggleDataAssistido(e.target.value === 'sim');
    });

    // Envio do Formulário (Salvar)
    form.addEventListener('submit', async (e) => {
        e.preventDefault(); e.stopPropagation();

        // Validação visual do Bootstrap
        if (!form.checkValidity()) {
            form.classList.add('was-validated');
            return;
        }

        const titulo = document.getElementById('titulo').value.trim();
        // Segurança: só aceita a imagem se for uma URL válida, senão usa vazio
        let posterUrl = document.getElementById('poster-preview-img').src;
        if (posterUrl.includes(window.location.href) || posterUrl === '') posterUrl = '';

        const dados = {
            titulo: titulo,
            ano: parseInt(document.getElementById('ano').value) || null,
            nota: parseFloat(document.getElementById('nota').value) || 0,
            // Split e Map: Transforma "Ação, Comédia" em ["Ação", "Comédia"]
            direcao: document.getElementById('direcao').value.split(',').map(s=>s.trim()).filter(Boolean),
            atores: document.getElementById('atores').value.split(',').map(s=>s.trim()).filter(Boolean),
            genero: [...generosSelecionados],
            origem: document.getElementById('origem').value,
            assistido: document.getElementById('assistido').value === 'sim',
            dataAssistido: document.getElementById('assistido').value === 'sim' ? document.getElementById('data-assistido').value : null,
            posterUrl: posterUrl
        };

        // UI: Loading no botão
        const btn = form.querySelector('button[type="submit"]');
        const originalText = btn.innerHTML;
        btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Salvando...';
        btn.disabled = true;

        try {
            await MovieService.save(currentUser.uid, dados, filmeEmEdicaoId);
            UI.toast(filmeEmEdicaoId ? 'Filme atualizado!' : 'Filme salvo!');
            UI.clearForm();
            generosSelecionados = [];
            filmeEmEdicaoId = null;
            document.getElementById('cadastro-titulo').innerHTML = '<i class="fas fa-edit me-2"></i> Cadastro de Filme';
        } catch (error) {
            UI.alert('Erro', error.message, 'error');
        } finally {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    });
}

// ==========================================================================
// 8. HELPERS (FUNÇÕES AUXILIARES)
// ==========================================================================

async function buscarOMDb() {
    const titulo = document.getElementById('titulo').value.trim();
    const anoInput = document.getElementById('ano').value.trim();
    
    if (!titulo) return UI.toast('Digite um título', 'warning');
    
    document.getElementById('api-loading').style.display = 'flex';
    try {
        // Chama o serviço que fala com a API
        const data = await MovieService.searchOMDb(titulo, anoInput);
        
        // Preenche campos automaticamente
        document.getElementById('titulo').value = data.Title;
        document.getElementById('ano').value = parseInt(data.Year) || '';
        document.getElementById('nota').value = parseFloat(data.imdbRating) || '';
        document.getElementById('direcao').value = data.Director !== 'N/A' ? data.Director : '';
        document.getElementById('atores').value = data.Actors !== 'N/A' ? data.Actors : '';
        
        // Tenta adivinhar origem
        if (data.Country) {
            document.getElementById('origem').value = data.Country.includes("Brazil") ? "Nacional" : "Internacional";
        }

        // Tenta pegar imagem em alta resolução
        let poster = '';
        if (data.Poster && data.Poster !== 'N/A') {
            poster = data.Poster; // <--- SEGURO (Usa a imagem original)
        }
        UI.updatePreviewPoster(poster);

        // Preenche tags
        generosSelecionados = [];
        if (data.Genre && data.Genre !== 'N/A') {
            data.Genre.split(', ').forEach(g => adicionarGenero(g));
        }

        UI.toast('Dados encontrados!');
    } catch (error) {
        UI.toast(error.message, 'error');
    } finally {
        document.getElementById('api-loading').style.display = 'none';
    }
}

function adicionarGenero(tag) {
    const t = tag.trim();
    if (!t || generosSelecionados.includes(t)) return; // Evita duplicidades
    generosSelecionados.push(t);
    UI.renderGenerosTags(generosSelecionados, removerGenero); // Atualiza visual
    document.getElementById('genero-input').value = '';
    document.getElementById('genero-input').focus();
}

function removerGenero(tag) {
    generosSelecionados = generosSelecionados.filter(g => g !== tag);
    UI.renderGenerosTags(generosSelecionados, removerGenero);
}

function carregarParaEdicao(id) {
    const filme = filmes.find(f => f.id === id);
    if (!filme) return;

    filmeEmEdicaoId = id; // Marca que esta em modo de edição
    document.getElementById('cadastro-titulo').innerHTML = `<i class="fas fa-pen me-2"></i> Editando: ${filme.titulo}`;
    
    generosSelecionados = filme.genero ? [...filme.genero] : [];
    // UI.fillForm preenche os inputs e chama o callback para as tags
    UI.fillForm(filme, (tags) => UI.renderGenerosTags(tags, removerGenero));
    document.getElementById('cadastro-section').scrollIntoView({ behavior: 'smooth' });
}

function sugerirFilme() {
    const pendentes = filmes.filter(f => !f.assistido);
    if (!pendentes.length) return UI.alert('Zerou!', 'Você assistiu tudo!', 'success');
    
    // Escolhe aleatório
    const random = pendentes[Math.floor(Math.random() * pendentes.length)];
    
    // Mostra popup
    UI.showRandomSuggestion(
        random, 
        async (id) => { await MovieService.toggleAssistido(currentUser.uid, id, true); UI.toast('Marcado como assistido!'); },
        () => sugerirFilme() // Callback para tentar outro
    );
}

// --- Importação e Exportação (Backup) ---

function exportarJSON() {
    if(!filmesFiltrados.length) return UI.toast('Lista vazia', 'warning');
    // Cria arquivo JSON para download
    downloadFile(JSON.stringify(filmesFiltrados, null, 2), `meus_filmes_${new Date().toISOString().slice(0,10)}.json`, 'application/json');
}

function exportarCSV() {
    if(!filmesFiltrados.length) return UI.toast('Lista vazia', 'warning');
    const headers = ['titulo', 'ano', 'nota', 'direcao', 'atores', 'genero', 'origem', 'assistido', 'dataAssistido', 'posterUrl'];
    
    // Cria arquivo CSV (planilha) manualmente, tratando vírgulas
    const csvContent = [
        headers.join(','),
        ...filmesFiltrados.map(f => headers.map(h => {
            let val = f[h];
            if(Array.isArray(val)) val = val.join('; ');
            if(val == null) val = '';
            val = String(val).replace(/"/g, '""'); // Escapa aspas
            if(val.includes(',')) val = `"${val}"`; // Coloca aspas se tiver vírgula
            return val;
        }).join(','))
    ].join('\n');
    downloadFile(csvContent, `meus_filmes_${new Date().toISOString().slice(0,10)}.csv`, 'text/csv;charset=utf-8;');
}

// Cria um link temporário <a> no HTML para forçar o download
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
            if (file.name.endsWith('.json')) {
                imported = JSON.parse(e.target.result);
            } else if (file.name.endsWith('.csv')) {
                const lines = e.target.result.split(/\r?\n/).filter(l => l.trim());
                const headers = lines.shift().split(',');
                imported = lines.map(line => {
                    const vals = line.split(','); 
                    return headers.reduce((obj, header, i) => {
                        let val = vals[i]; 
                        // Remove aspas do CSV
                        if(val && val.startsWith('"') && val.endsWith('"')) val = val.slice(1,-1);
                        // Converte Strings para Array ou Número
                        if(['genero','direcao','atores'].includes(header)) obj[header] = val ? val.split(';').map(s=>s.trim()) : [];
                        else if(['ano','nota'].includes(header)) obj[header] = Number(val);
                        else if(header === 'assistido') obj[header] = val === 'true';
                        else obj[header] = val;
                        return obj;
                    }, {});
                });
            }

            if(!imported.length) throw new Error("Arquivo vazio ou inválido");
            
            // Filtra duplicados (pelo Título)
            const titulosAtuais = new Set(filmes.map(f => f.titulo.toLowerCase()));
            const novos = imported.filter(f => f.titulo && !titulosAtuais.has(String(f.titulo).toLowerCase()));

            if (novos.length === 0) return UI.alert('Info', 'Todos os filmes já existem na sua lista.', 'info');
            
            const confirm = await UI.confirm('Importar', `Encontrados ${novos.length} novos filmes. Deseja importar?`);
            if (confirm.isConfirmed) {
                // Salva um por um
                for (const filme of novos) {
                    await MovieService.save(currentUser.uid, { ...filme, cadastradoEm: serverTimestamp() });
                }
                UI.toast('Importação concluída!');
            }
        } catch (err) {
            UI.alert('Erro na Importação', err.message, 'error');
        }
        event.target.value = ''; // Reseta o input file
    };
    reader.readAsText(file);
}