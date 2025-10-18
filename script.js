/**
 * Script Principal para a Aplicação Meus Filmes
 * Gerencia autenticação, CRUD de filmes, UI, estatísticas e gráficos.
 */
document.addEventListener('DOMContentLoaded', async () => {

    // ==========================================================================
    // [ 1 ] CONFIGURAÇÃO E DEPENDÊNCIAS DO FIREBASE
    // ==========================================================================
    const {
        // Firestore
        db, collection, addDoc, getDocs, doc, updateDoc, deleteDoc, serverTimestamp, query, orderBy, where, writeBatch,
        // Authentication
        auth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut, sendPasswordResetEmail, updatePassword, EmailAuthProvider, reauthenticateWithCredential
    } = window.firebaseDeps; // Pega dependências expostas no HTML

    // ==========================================================================
    // [ 2 ] ESTADO GLOBAL DA APLICAÇÃO
    // ==========================================================================
    let currentUserId = null; // ID do usuário logado (null se deslogado)
    let filmes = [];          // Array contendo os filmes do usuário logado
    let filmeEmEdicao = null; // ID do filme sendo editado (null se nenhum)
    let charts = {};          // Objeto para armazenar instâncias dos gráficos Chart.js
    let sortBy = 'cadastradoEm'; // Critério de ordenação padrão da tabela
    let sortDirection = 'asc';   // Direção de ordenação padrão
    let generosSelecionadosAtualmente = []; // Gêneros no formulário de cadastro/edição

    const GENEROS_PREDEFINIDOS = [
        "Action", "Adventure", "Animation", "Comedy", "Crime", "Documentary", "Drama",
        "Fantasy", "History", "Horror", "Music", "Mystery", "Romance", "Science Fiction",
        "Thriller", "War", "Western"
    ].sort();

    // ==========================================================================
    // [ 3 ] CACHE DE ELEMENTOS DO DOM
    // ==========================================================================
    // Elementos Globais
    const body = document.body;
    const themeToggleBtn = document.getElementById('theme-toggle');

    // Elementos da Aplicação Principal (Conteúdo visível quando logado)
    const appContent = document.getElementById('app-content');
    const appNavLinks = document.querySelectorAll('.app-nav'); // Links da navbar que só aparecem logado

    // Elementos de Autenticação
    const authContainer = document.getElementById('auth-container');
    const loginCard = document.getElementById('login-card');
    const registerCard = document.getElementById('register-card');
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const showRegisterLink = document.getElementById('show-register-link');
    const showLoginLink = document.getElementById('show-login-link');
    const logoutContainer = document.getElementById('logout-container');
    const logoutBtn = document.getElementById('logout-btn');
    const forgotPasswordLink = document.getElementById('forgot-password-link');
    const changePasswordContainer = document.getElementById('change-password-container');
    const changePasswordBtn = document.getElementById('change-password-btn');

    // Elementos do Formulário de Cadastro/Edição de Filme
    const formElements = {
        form: document.getElementById('filme-form'),
        titulo: document.getElementById('titulo'),
        ano: document.getElementById('ano'),
        nota: document.getElementById('nota'),
        direcao: document.getElementById('direcao'),
        atores: document.getElementById('atores'),
        origem: document.getElementById('origem'),
        assistido: document.getElementById('assistido'),
        dataAssistido: document.getElementById('data-assistido'),
        dataAssistidoGroup: document.getElementById('data-assistido-group'), // Incluído aqui
        generoTagContainer: document.getElementById('genero-tag-container'),
        generoInput: document.getElementById('genero-input'),
        generosDatalist: document.getElementById('generos-sugeridos')
    };

    // Elementos dos Filtros da Lista
    const filterElements = {
        container: document.getElementById('filtros-container'),
        busca: document.getElementById('filtro-busca'),
        genero: document.getElementById('filtro-genero'),
        diretor: document.getElementById('filtro-diretor'),
        ator: document.getElementById('filtro-ator'),
        ano: document.getElementById('filtro-ano'),
        origem: document.getElementById('filtro-origem'),
        assistido: document.getElementById('filtro-assistido'),
        limparBtn: document.getElementById('limpar-filtros'),
    };

    // Elementos das Tabelas
    const tabelas = {
        todos: document.getElementById('tabela-todos-container'),
        assistidos: document.getElementById('tabela-assistidos-container'),
        naoAssistidos: document.getElementById('tabela-nao-assistidos-container')
    };

    // Elementos das Estatísticas
    const statsElements = {
        titulo: document.querySelector('#estatisticas-section h2'),
        totalFilmes: document.getElementById('stat-total-filmes'),
        mediaNotas: document.getElementById('stat-media-notas'),
        melhorFilme: document.getElementById('stat-melhor-filme'),
        piorFilme: document.getElementById('stat-pior-filme'),
        decadaPopular: document.getElementById('stat-decada-popular'),
        atorFrequente: document.getElementById('stat-ator-frequente'),
        pctNacionais: document.getElementById('stat-pct-nacionais'),
        pctInternacionais: document.getElementById('stat-pct-internacionais'),
        mediaNotasGrafico: document.getElementById('stat-media-notas-grafico')
    };

    // Elementos dos Rankings
    const rankingsElements = {
        generos: document.getElementById('ranking-generos'),
        atores: document.getElementById('ranking-atores'),
        diretores: document.getElementById('ranking-diretores'),
        anos: document.getElementById('ranking-anos')
    };

    // IDs dos Canvas para Gráficos
    const chartCanvasIds = [
        'generosChart', 'anosChart', 'notasChart', 'origemChart',
        'mediaNotasAnoChart', 'assistidosMesChart', 'diretoresChart'
    ];

    // ==========================================================================
    // [ 4 ] FUNÇÕES DE AUTENTICAÇÃO
    // ==========================================================================

    /** Lida com o submit do formulário de login. */
    const handleLogin = (e) => {
        // ... (código anterior revisado e com loader) ...
        e.preventDefault();
        const email = document.getElementById('login-email').value.trim();
        const password = document.getElementById('login-password').value;
        if (!email || !password) { Swal.fire({ icon: 'warning', title: 'Campos Vazios', text: 'Por favor, preencha o email e a senha.' }); return; }
        Swal.showLoading();
        signInWithEmailAndPassword(auth, email, password)
            .then(() => Swal.close())
            .catch((error) => {
                Swal.close();
                console.error("Erro no login:", error.message, error.code);
                let errorMsg = 'Email ou senha inválidos. Por favor, tente novamente.';
                if (['auth/invalid-credential', 'auth/wrong-password', 'auth/user-not-found', 'auth/invalid-email'].includes(error.code)) { errorMsg = 'Email ou senha inválidos.'; }
                else if (error.code === 'auth/too-many-requests') { errorMsg = 'Muitas tentativas de login falharam. Tente novamente mais tarde.'; }
                Swal.fire({ icon: 'error', title: 'Erro no Login', text: errorMsg });
            });
    };

    /** Lida com o submit do formulário de cadastro. */
    const handleRegister = (e) => {
        // ... (código anterior revisado e com loader) ...
        e.preventDefault();
        const email = document.getElementById('register-email').value.trim();
        const password = document.getElementById('register-password').value;
        if (!email || !password) { Swal.fire({ icon: 'warning', title: 'Campos Vazios', text: 'Por favor, preencha o email e a senha.' }); return; }
        if (password.length < 6) { Swal.fire({ icon: 'warning', title: 'Senha Fraca', text: 'Sua senha deve ter pelo menos 6 caracteres.' }); return; }
        Swal.showLoading();
        createUserWithEmailAndPassword(auth, email, password)
             .then(() => Swal.close())
            .catch((error) => {
                Swal.close();
                console.error("Erro no cadastro:", error.message, error.code);
                let errorMsg = 'Não foi possível criar sua conta. Tente novamente.';
                if (error.code === 'auth/email-already-in-use') { errorMsg = 'Este email já está sendo usado por outra conta.'; }
                else if (error.code === 'auth/invalid-email') { errorMsg = 'O formato do email é inválido.'; }
                Swal.fire({ icon: 'error', title: 'Erro no Cadastro', text: errorMsg });
            });
    };

    /** Lida com o clique no botão de logout. */
    const handleLogout = () => {
        signOut(auth).catch((error) => {
            console.error("Erro no logout:", error);
            Swal.fire({ icon: 'error', title: 'Erro', text: 'Não foi possível fazer logout.' });
        });
    };

    /** Lida com o clique no link "Esqueceu sua senha?". */
    const handleForgotPassword = (e) => {
        // ... (código anterior revisado) ...
        e.preventDefault();
        Swal.fire({
            title: 'Redefinir Senha', text: 'Digite seu email e enviaremos um link para você criar uma nova senha.', input: 'email',
            inputPlaceholder: 'seu.email@exemplo.com', inputAttributes: { autocapitalize: 'off', autocorrect: 'off' },
            showCancelButton: true, confirmButtonText: 'Enviar link', cancelButtonText: 'Cancelar', showLoaderOnConfirm: true,
            preConfirm: (email) => {
                 if (!email) { Swal.showValidationMessage('Por favor, digite seu email.'); return false; }
                return sendPasswordResetEmail(auth, email)
                    .then(() => { return email; })
                    .catch((error) => { console.error("Erro ao enviar email de redefinição:", error); Swal.showValidationMessage(`Falha ao enviar: Verifique se o email está correto e cadastrado.`); });
            },
            allowOutsideClick: () => !Swal.isLoading()
        }).then((result) => { if (result.isConfirmed) { Swal.fire({ icon: 'success', title: 'Link Enviado!', text: `Um email foi enviado para ${result.value}. Verifique sua caixa de entrada (e a pasta de spam).` }); } });
    };

    /** Lida com o clique no botão "Alterar Senha". */
    const handleChangePassword = () => {
        // ... (código anterior revisado) ...
        const currentUser = auth.currentUser; if (!currentUser) return;
        Swal.fire({
            title: 'Alterar Senha',
            html: '<input type="password" id="swal-current-password" class="swal2-input" placeholder="Senha Atual" autocomplete="current-password"><input type="password" id="swal-new-password" class="swal2-input" placeholder="Nova Senha (mín. 6 caracteres)" autocomplete="new-password"><input type="password" id="swal-confirm-password" class="swal2-input" placeholder="Confirme a Nova Senha" autocomplete="new-password">',
            confirmButtonText: 'Salvar Alterações', cancelButtonText: 'Cancelar', showCancelButton: true, focusConfirm: false, showLoaderOnConfirm: true,
            preConfirm: () => {
                const currentPassword = document.getElementById('swal-current-password').value; const newPassword = document.getElementById('swal-new-password').value; const confirmPassword = document.getElementById('swal-confirm-password').value;
                if (!currentPassword || !newPassword || !confirmPassword) { Swal.showValidationMessage('Todos os campos são obrigatórios.'); return false; }
                if (newPassword.length < 6) { Swal.showValidationMessage('A nova senha deve ter pelo menos 6 caracteres.'); return false; }
                if (newPassword !== confirmPassword) { Swal.showValidationMessage('As novas senhas não coincidem.'); return false; }
                const credential = EmailAuthProvider.credential(currentUser.email, currentPassword);
                return reauthenticateWithCredential(currentUser, credential)
                    .then(() => updatePassword(currentUser, newPassword))
                    .then(() => ({ success: true }))
                    .catch((error) => { console.error("Erro ao alterar senha:", error); let errorMsg = 'Ocorreu um erro inesperado.'; if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') { errorMsg = 'A senha atual está incorreta.'; } else if (error.code === 'auth/too-many-requests') { errorMsg = 'Muitas tentativas. Tente novamente mais tarde.'; } Swal.showValidationMessage(errorMsg); return { success: false }; });
            },
            allowOutsideClick: () => !Swal.isLoading()
        }).then((result) => { if (result.isConfirmed && result.value?.success) { Swal.fire({ icon: 'success', title: 'Sucesso!', text: 'Sua senha foi alterada.' }); } });
    };

    // ==========================================================================
    // [ 5 ] OBSERVADOR DE ESTADO DE AUTENTICAÇÃO (Auth Guard)
    // ==========================================================================

    /** Observa mudanças no estado de login do usuário e atualiza a UI. */
    onAuthStateChanged(auth, (user) => {
        if (user) {
            // ----- USUÁRIO LOGADO -----
            currentUserId = user.uid;
            console.log("Usuário logado:", currentUserId);
            appContent.style.display = 'block';
            logoutContainer.style.display = 'block';
            changePasswordContainer.style.display = 'block';
            authContainer.style.display = 'none';
            appNavLinks.forEach(link => link.style.display = 'block');
            carregarFilmes(); // Carrega os filmes específicos do usuário
        } else {
            // ----- USUÁRIO DESLOGADO -----
            currentUserId = null;
            filmes = []; // Limpa os dados
            console.log("Usuário deslogado.");
            appContent.style.display = 'none';
            logoutContainer.style.display = 'none';
            changePasswordContainer.style.display = 'none';
            authContainer.style.display = 'block';
            appNavLinks.forEach(link => link.style.display = 'none');
            loginCard.style.display = 'block'; // Mostra login por padrão
            registerCard.style.display = 'none';
            atualizarUI(); // Limpa a interface do app (tabelas, gráficos)
        }
    });

    // ==========================================================================
    // [ 6 ] FUNÇÕES AUXILIARES GERAIS
    // ==========================================================================

    /** Exibe um toast de sucesso. */
    const showToast = (title) => { const Toast = Swal.mixin({ toast: true, position: 'top-end', showConfirmButton: false, timer: 3000, timerProgressBar: true, didOpen: (toast) => { toast.addEventListener('mouseenter', Swal.stopTimer); toast.addEventListener('mouseleave', Swal.resumeTimer); } }); Toast.fire({ icon: 'success', title: title }); };

    /** Converte string separada por vírgula em array de strings limpas. */
    const parseCSV = (string) => string ? string.split(',').map(s => s.trim()).filter(Boolean) : [];

    /** Popula um elemento <select> com opções. */
    const popularSelect = (selectElement, items, label) => { if (!selectElement) return; selectElement.innerHTML = `<option value="todos">${label}</option>`; [...new Set(items)].sort((a, b) => b - a).forEach(item => { if (item != null) selectElement.add(new Option(item, item)); }); };

    /** Ativa a funcionalidade de arrastar para rolar em tabelas responsivas. */
    const ativarArrastarParaRolar = (selector) => { /* ... (código inalterado) ... */ const slider = document.querySelector(selector); if (!slider) return; let isDown = false, startX, scrollLeft; slider.addEventListener('mousedown', (e) => { isDown = true; slider.classList.add('active'); startX = e.pageX - slider.offsetLeft; scrollLeft = slider.scrollLeft; }); slider.addEventListener('mouseleave', () => { isDown = false; slider.classList.remove('active'); }); slider.addEventListener('mouseup', () => { isDown = false; slider.classList.remove('active'); }); slider.addEventListener('mousemove', (e) => { if (!isDown) return; e.preventDefault(); const x = e.pageX - slider.offsetLeft; const walk = (x - startX) * 2; slider.scrollLeft = scrollLeft - walk; }); };

    // ==========================================================================
    // [ 7 ] FUNÇÕES DE MANIPULAÇÃO DE TAGS (Gênero)
    // ==========================================================================
    // (Código inalterado, apenas formatado)
    function renderizarTags() { formElements.generoTagContainer.querySelectorAll('.tag-pill').forEach(tagEl => tagEl.remove()); generosSelecionadosAtualmente.slice().reverse().forEach(label => { const tagEl = criarTag(label); formElements.generoTagContainer.prepend(tagEl); }); }
    function criarTag(label) { const tagEl = document.createElement('span'); tagEl.className = 'tag-pill'; const labelEl = document.createElement('span'); labelEl.textContent = label; const removeBtn = document.createElement('button'); removeBtn.className = 'tag-remove-btn'; removeBtn.type = "button"; removeBtn.innerHTML = '&times;'; removeBtn.addEventListener('click', () => { removerTag(label); }); tagEl.appendChild(labelEl); tagEl.appendChild(removeBtn); return tagEl; }
    function adicionarTag(label) { const trimmedLabel = label.trim(); if (!trimmedLabel || !GENEROS_PREDEFINIDOS.includes(trimmedLabel) || generosSelecionadosAtualmente.includes(trimmedLabel)) return; generosSelecionadosAtualmente.push(trimmedLabel); renderizarTags(); formElements.generoInput.value = ''; formElements.generoInput.focus(); }
    function removerTag(label) { generosSelecionadosAtualmente = generosSelecionadosAtualmente.filter(g => g !== label); renderizarTags(); }
    function popularSugestoesDeGenero() { if (formElements.generosDatalist) { formElements.generosDatalist.innerHTML = GENEROS_PREDEFINIDOS.map(g => `<option value="${g}"></option>`).join(''); } }

    // ==========================================================================
    // [ 8 ] FUNÇÕES CRUD (Create, Read, Update, Delete) PARA FILMES
    // ==========================================================================

    /** Retorna a referência da coleção de filmes do usuário logado. */
    const getUserFilmesCollection = () => currentUserId ? collection(db, "users", currentUserId, "filmes") : null;

    /** Retorna a referência de um documento de filme específico do usuário logado. */
    const getUserFilmeDoc = (id) => currentUserId && id ? doc(db, "users", currentUserId, "filmes", id) : null;

    /** Carrega os filmes do usuário logado do Firestore. */
    const carregarFilmes = async () => {
        // ... (código anterior revisado) ...
        const colRef = getUserFilmesCollection(); if (!colRef) { console.log("Carregar filmes: Usuário não logado."); filmes = []; atualizarUI(); return; }
        console.log("Carregando filmes...");
        try {
            const q = query(colRef, orderBy("cadastradoEm", "asc")); const snapshot = await getDocs(q);
            filmes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), cadastradoEm: doc.data().cadastradoEm?.toDate() || new Date(0) }));
            console.log(`Carregados ${filmes.length} filmes.`);
            popularFiltros(filmes); // Popula o select de ano nos filtros
            atualizarUI(); // Renderiza a UI com os filmes carregados
        } catch (error) { console.error("Erro ao carregar filmes:", error); Swal.fire({ icon: 'error', title: 'Oops...', text: 'Não foi possível carregar seus filmes.' }); filmes = []; atualizarUI(); }
    };

    /** Salva um novo filme ou atualiza um existente. */
    const salvarFilme = async (event) => {
        // ... (código anterior revisado) ...
        event.preventDefault(); const colRef = getUserFilmesCollection(); if (!colRef) return; const tituloValue = formElements.titulo.value.trim(); if (!tituloValue) { Swal.fire({ icon: 'warning', title: 'Atenção', text: 'O campo "Título" é obrigatório.' }); return formElements.titulo.focus(); }
        // Verifica duplicidade apenas para novos filmes
        if (!filmeEmEdicao) { try { const q = query(colRef, where("titulo", "==", tituloValue)); const snapshot = await getDocs(q); if (!snapshot.empty) { Swal.fire({ icon: 'error', title: 'Filme Duplicado', text: 'Um filme com este título já existe na sua lista.' }); return formElements.titulo.focus(); } } catch (error) { console.error("Erro ao verificar duplicidade:", error); Swal.fire({ icon: 'error', title: 'Oops...', text: 'Erro ao verificar duplicidade.' }); return; } }
        const isAssistido = formElements.assistido.value === 'sim';
        const filmeData = { titulo: tituloValue, ano: parseInt(formElements.ano.value, 10) || null, nota: parseFloat(formElements.nota.value) || 0, direcao: parseCSV(formElements.direcao.value), atores: parseCSV(formElements.atores.value), genero: [...generosSelecionadosAtualmente], origem: formElements.origem.value || null, assistido: isAssistido, dataAssistido: isAssistido ? formElements.dataAssistido.value : null };
        Swal.showLoading();
        try { if (filmeEmEdicao) { const docRef = getUserFilmeDoc(filmeEmEdicao); await updateDoc(docRef, filmeData); showToast('Filme atualizado!'); } else { filmeData.cadastradoEm = serverTimestamp(); await addDoc(colRef, filmeData); showToast('Filme salvo!'); } formElements.form.reset(); generosSelecionadosAtualmente = []; renderizarTags(); filmeEmEdicao = null; formElements.dataAssistidoGroup.style.display = 'none'; Swal.close(); carregarFilmes(); } catch (error) { Swal.close(); console.error("Erro ao salvar filme:", error); Swal.fire({ icon: 'error', title: 'Oops...', text: 'Erro ao salvar o filme.' }); }
    };

    /** Prepara o formulário para edição de um filme existente. */
    const prepararEdicao = (id) => {
        // ... (código anterior revisado) ...
        const filme = filmes.find(f => f.id === id); if (!filme) { console.warn("Filme não encontrado para edição:", id); return; }
        filmeEmEdicao = id;
        formElements.titulo.value = filme.titulo || ''; formElements.ano.value = filme.ano || ''; formElements.nota.value = filme.nota || ''; formElements.direcao.value = filme.direcao?.join(', ') || ''; formElements.atores.value = filme.atores?.join(', ') || '';
        generosSelecionadosAtualmente = filme.genero ? [...filme.genero] : []; renderizarTags();
        formElements.origem.value = filme.origem || ''; formElements.assistido.value = filme.assistido ? 'sim' : 'nao';
        formElements.dataAssistidoGroup.style.display = filme.assistido ? 'block' : 'none';
        if (filme.assistido && filme.dataAssistido) { formElements.dataAssistido.value = filme.dataAssistido; } else { formElements.dataAssistido.value = '';}
        // Rola para o topo e foca no título
        const cadastroSection = document.getElementById('cadastro-section');
        if (cadastroSection) cadastroSection.scrollIntoView({ behavior: 'smooth' });
        formElements.titulo.focus();
    };

    /** Deleta um filme após confirmação. */
    const deletarFilme = async (id) => {
        // ... (código anterior revisado) ...
        const docRef = getUserFilmeDoc(id); if (!docRef) return;
        const result = await Swal.fire({ title: 'Tem certeza?', text: "Esta ação não pode ser revertida!", icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33', cancelButtonColor: '#6c757d', confirmButtonText: 'Sim, excluir!', cancelButtonText: 'Cancelar' });
        if (result.isConfirmed) { Swal.showLoading(); try { await deleteDoc(docRef); showToast('Filme excluído!'); carregarFilmes(); } catch (error) { Swal.close(); console.error("Erro ao excluir filme:", error); Swal.fire({ icon: 'error', title: 'Oops...', text: 'Erro ao excluir o filme.' }); } }
    };

    // ==========================================================================
    // [ 9 ] FUNÇÕES DE LÓGICA DA APLICAÇÃO (Filtros, Sugestão, etc.)
    // ==========================================================================

    /** Aplica os filtros e a ordenação atual à lista de filmes. */
    const aplicarFiltrosEordenacao = (listaDeFilmes) => {
        // ... (código anterior revisado) ...
        let filmesProcessados = [...listaDeFilmes];
        const filtros = { busca: filterElements.busca.value.toLowerCase(), genero: filterElements.genero.value.toLowerCase(), diretor: filterElements.diretor.value.toLowerCase(), ator: filterElements.ator.value.toLowerCase(), ano: filterElements.ano.value, origem: filterElements.origem.value, assistido: filterElements.assistido.value, };
        if (filtros.busca) filmesProcessados = filmesProcessados.filter(f => f.titulo.toLowerCase().includes(filtros.busca));
        if (filtros.genero) filmesProcessados = filmesProcessados.filter(f => f.genero?.some(g => g.toLowerCase().includes(filtros.genero)));
        if (filtros.diretor) filmesProcessados = filmesProcessados.filter(f => f.direcao?.some(d => d.toLowerCase().includes(filtros.diretor)));
        if (filtros.ator) filmesProcessados = filmesProcessados.filter(f => f.atores?.some(a => a.toLowerCase().includes(filtros.ator)));
        if (filtros.ano !== 'todos') filmesProcessados = filmesProcessados.filter(f => f.ano?.toString() === filtros.ano);
        if (filtros.origem !== 'todos') filmesProcessados = filmesProcessados.filter(f => f.origem === filtros.origem);
        if (filtros.assistido !== 'todos') filmesProcessados = filmesProcessados.filter(f => f.assistido === (filtros.assistido === 'sim'));
        // Ordenação
        return filmesProcessados.sort((a, b) => { if (!a.hasOwnProperty(sortBy) || a[sortBy] == null) return 1; if (!b.hasOwnProperty(sortBy) || b[sortBy] == null) return -1; const valA = a[sortBy]; const valB = b[sortBy]; let comparison = typeof valA === 'string' ? valA.localeCompare(valB, 'pt-BR', { sensitivity: 'base'}) : valA - valB; return sortDirection === 'asc' ? comparison : -comparison; });
    };

    /** Popula os selects de filtro (atualmente só o de ano). */
    const popularFiltros = (listaDeFilmes) => {
        const todosAnos = listaDeFilmes.map(filme => filme.ano).filter(Boolean); // Pega apenas anos válidos
        popularSelect(filterElements.ano, todosAnos, "Todos os Anos");
    };

    /** Limpa todos os campos de filtro. */
    const limparFiltros = () => {
        filterElements.container.querySelectorAll('input, select').forEach(el => {
            if (el.tagName === 'SELECT') {
                el.value = 'todos'; // Valor padrão para selects
            } else {
                el.value = '';      // Limpa inputs de texto
            }
        });
        atualizarUI(); // Re-renderiza a UI com filtros limpos
    };

    /** Sugere um filme aleatório não assistido. */
    const sugerirFilmeAleatorio = () => {
        // ... (código anterior revisado) ...
        const filmesNaoAssistidos = filmes.filter(filme => !filme.assistido); if (filmesNaoAssistidos.length === 0) { Swal.fire({ icon: 'info', title: 'Tudo em dia!', text: 'Você já assistiu a todos os filmes da sua lista. Adicione novos filmes para receber sugestões.' }); return; }
        const indiceAleatorio = Math.floor(Math.random() * filmesNaoAssistidos.length); const filmeSugerido = filmesNaoAssistidos[indiceAleatorio];
        Swal.fire({ title: 'Que tal assistir...', iconHtml: '<i class="fas fa-film"></i>', html: `<div class="suggestion-layout"><div class="suggestion-main-info"><h2 class="suggestion-title">${filmeSugerido.titulo}</h2><p><strong>Ano:</strong> ${filmeSugerido.ano || 'N/A'}</p><p><strong>Direção:</strong> ${filmeSugerido.direcao?.join(', ') || 'N/A'}</p></div><div class="suggestion-side-info"><div class="suggestion-note"><i class="fas fa-star" aria-hidden="true"></i><span>${filmeSugerido.nota != null ? filmeSugerido.nota.toFixed(1) : 'N/A'}</span></div><div class="suggestion-genres">${filmeSugerido.genero?.map(g => `<span class="tag-pill">${g}</span>`).join('') || '<span class="text-muted">Nenhum gênero</span>'}</div></div></div>`, showCancelButton: true, confirmButtonText: 'Ótima ideia!', cancelButtonText: 'Sugerir outro', showDenyButton: true, denyButtonText: '<i class="fas fa-check-circle me-1"></i> Marcar como assistido', customClass: { container: 'suggestion-swal-container', popup: 'suggestion-swal-popup', confirmButton: 'suggestion-confirm-btn', cancelButton: 'suggestion-cancel-btn', denyButton: 'suggestion-deny-btn' } }).then(async (result) => { if (result.isConfirmed) {} else if (result.isDismissed && result.dismiss === Swal.DismissReason.cancel) { sugerirFilmeAleatorio(); } else if (result.isDenied) { try { const filmeRef = getUserFilmeDoc(filmeSugerido.id); if (!filmeRef) return; await updateDoc(filmeRef, { assistido: true, dataAssistido: new Date().toISOString().slice(0, 10) }); showToast('Filme marcado como assistido!'); carregarFilmes(); } catch (error) { console.error("Erro ao marcar como assistido:", error); Swal.fire('Erro!', 'Não foi possível atualizar o filme.', 'error'); } } });
    };

    // ==========================================================================
    // [ 10 ] FUNÇÕES DE RENDERIZAÇÃO DA UI (Tabelas, Estatísticas, Gráficos)
    // ==========================================================================

    /** Renderiza a tabela de filmes em um container específico. */
    function renderizarTabela(listaDeFilmes, containerId) {
        // ... (código anterior revisado e formatado) ...
        const container = document.getElementById(containerId); if (!container) return; if (listaDeFilmes.length === 0) { container.innerHTML = '<p class="text-center text-muted pt-3">Nenhum filme encontrado para estes filtros.</p>'; return; } const getSortIndicator = col => sortBy === col ? (sortDirection === 'asc' ? ' <i class="fas fa-sort-up"></i>' : ' <i class="fas fa-sort-down"></i>') : ''; const rows = listaDeFilmes.map((filme, index) => `<tr data-id="${filme.id}"><td class="col-num">${index + 1}</td><td class="col-titulo">${filme.titulo || 'N/A'}</td><td class="col-nota">⭐ ${(filme.nota ?? 0).toFixed(1)}</td><td class="col-ano">${filme.ano || '-'}</td><td class="col-direcao">${filme.direcao?.join(', ') || ''}</td><td class="col-atores">${filme.atores?.join(', ') || ''}</td><td class="col-genero">${filme.genero?.join(', ') || ''}</td><td class="col-assistido">${filme.assistido ? 'Sim' : 'Não'}</td><td class="col-data">${filme.assistido && filme.dataAssistido ? new Date(filme.dataAssistido.replace(/-/g, '/')).toLocaleDateString('pt-BR', {timeZone: 'UTC'}) : '-'}</td><td class="col-origem">${filme.origem || '-'}</td><td class="col-acoes"><div class="action-buttons"><button class="btn btn-sm btn-info btn-edit" title="Editar Filme"><i class="fas fa-pen"></i></button><button class="btn btn-sm btn-danger btn-delete" title="Excluir Filme"><i class="fas fa-trash"></i></button></div></td></tr>`).join(''); container.innerHTML = `<table class="table table-dark table-striped table-hover table-sm tabela-filmes"><thead><tr><th class="col-num">#</th><th class="col-titulo sortable" data-sort="titulo">Título${getSortIndicator('titulo')}</th><th class="col-nota sortable" data-sort="nota">Nota${getSortIndicator('nota')}</th><th class="col-ano sortable" data-sort="ano">Ano${getSortIndicator('ano')}</th><th>Direção</th><th>Atores</th><th>Gênero</th><th>Assistido?</th><th>Data</th><th>Origem</th><th>Ações</th></tr></thead><tbody>${rows}</tbody></table>`; ativarArrastarParaRolar(`#${containerId}`);
    }

    /** Cria um ranking (top 10) de um campo específico que contém arrays (gênero, atores, direcao). */
    function criarRankingArray(listaDeFilmes, campo) { const contagem = listaDeFilmes.flatMap(f => f[campo] || []).reduce((acc, item) => { if (item) acc[item] = (acc[item] || 0) + 1; return acc; }, {}); return Object.entries(contagem).sort(([, a], [, b]) => b - a).slice(0, 10); };

    /** Cria um ranking (top 10) de um campo específico que contém valores únicos (ano). */
    function criarRankingValorUnico(listaDeFilmes, campo) { const contagem = listaDeFilmes.reduce((acc, f) => { if(f[campo]) acc[f[campo]] = (acc[f[campo]] || 0) + 1; return acc; }, {}); return Object.entries(contagem).sort(([,a],[,b]) => b-a).slice(0,10); };

    /** Renderiza uma lista de ranking em um elemento UL. */
    function renderizarRanking(elementId, ranking, labelFormatter = (nome) => nome) { const ul = document.getElementById(elementId); if (!ul) return; ul.innerHTML = ranking.length > 0 ? ranking.map(([nome, qtd]) => `<li class="list-group-item">${labelFormatter(nome)}<span class="ranking-count">${qtd}</span></li>`).join('') : '<li class="list-group-item text-muted">Nenhum dado disponível</li>'; };

    /** Atualiza os cards de estatísticas e os rankings. */
    function atualizarEstatisticas(listaDeFilmesAssistidos) {
        // ... (código anterior revisado e formatado) ...
        const totalGlobalAssistidos = filmes.filter(f => f.assistido).length; const totalFiltrado = listaDeFilmesAssistidos.length; const isFiltered = filmes.length !== filmes.filter(f => f.assistido).length || (filterElements.busca.value || filterElements.genero.value || filterElements.diretor.value || filterElements.ator.value || filterElements.ano.value !== 'todos' || filterElements.origem.value !== 'todos' || filterElements.assistido.value !== 'todos');
        if (statsElements.titulo) { statsElements.titulo.innerHTML = isFiltered ? `<i class="fas fa-filter me-2"></i> Estatísticas do Filtro (${totalFiltrado} de ${totalGlobalAssistidos} assistidos)` : `<i class="fas fa-chart-bar me-2"></i> Estatísticas dos Filmes Assistidos (${totalGlobalAssistidos} no total)`; }
        // Zera estatísticas se não houver filmes assistidos (filtrados ou totais)
        if (totalFiltrado === 0) { Object.values(statsElements).forEach(el => { if (el && el.id !== 'estatisticas-titulo') el.innerText = el.id.includes('pct') ? '0%' : (el.id.includes('media') ? '0.0' : (el.id.includes('total') ? '0' : '-')); }); Object.keys(rankingsElements).forEach(key => renderizarRanking(`ranking-${key}`, [])); return; }
        // Calcula e exibe estatísticas
        const mediaNotas = (listaDeFilmesAssistidos.reduce((acc, f) => acc + (f.nota || 0), 0) / totalFiltrado).toFixed(1); statsElements.totalFilmes.innerText = totalFiltrado; statsElements.mediaNotas.innerText = mediaNotas; if (statsElements.mediaNotasGrafico) statsElements.mediaNotasGrafico.innerText = mediaNotas;
        const melhorFilme = listaDeFilmesAssistidos.reduce((p, c) => (p.nota || 0) > (c.nota || 0) ? p : c); statsElements.melhorFilme.innerText = melhorFilme.titulo; const piorFilme = listaDeFilmesAssistidos.reduce((p, c) => (p.nota ?? 11) < (c.nota ?? 11) ? p : c); statsElements.piorFilme.innerText = piorFilme.titulo;
        const nacionais = listaDeFilmesAssistidos.filter(f => f.origem === 'Nacional').length; statsElements.pctNacionais.innerText = `${Math.round((nacionais / totalFiltrado) * 100)}%`; statsElements.pctInternacionais.innerText = `${Math.round(((totalFiltrado - nacionais) / totalFiltrado) * 100)}%`;
        const decadas = listaDeFilmesAssistidos.reduce((acc, f) => { if(f.ano) { const decada = Math.floor(f.ano / 10) * 10; acc[decada] = (acc[decada] || 0) + 1; } return acc; }, {}); const rankingDecadas = Object.entries(decadas).sort(([,a],[,b]) => b-a); statsElements.decadaPopular.innerText = rankingDecadas.length ? `Anos ${rankingDecadas[0][0]}` : '-';
        const rankingAtores = criarRankingArray(listaDeFilmesAssistidos, 'atores'); statsElements.atorFrequente.innerText = rankingAtores.length ? rankingAtores[0][0] : '-';
        // Renderiza Rankings
        renderizarRanking('ranking-generos', criarRankingArray(listaDeFilmesAssistidos, 'genero')); renderizarRanking('ranking-atores', rankingAtores); renderizarRanking('ranking-diretores', criarRankingArray(listaDeFilmesAssistidos, 'direcao')); renderizarRanking('ranking-anos', criarRankingValorUnico(listaDeFilmesAssistidos, 'ano'));
    }

    /** Renderiza todos os gráficos. */
    function renderizarGraficos(listaDeFilmesAssistidos) {
        // ... (código anterior revisado e formatado) ...
        Object.values(charts).forEach(chart => chart?.destroy()); // Destroi gráficos antigos
        const isDarkMode = body.classList.contains('dark-mode'); Chart.defaults.color = isDarkMode ? 'rgba(226, 232, 240, 0.8)' : 'rgba(0, 0, 0, 0.7)'; Chart.defaults.borderColor = isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';
        if (listaDeFilmesAssistidos.length === 0) { console.log("Sem dados para renderizar gráficos."); return; } // Não renderiza se não houver dados
        // Chama funções específicas para cada gráfico
        renderizarGraficoGeneros(listaDeFilmesAssistidos); renderizarGraficoAnos(listaDeFilmesAssistidos); renderizarGraficoNotas(listaDeFilmesAssistidos); renderizarGraficoOrigem(listaDeFilmesAssistidos); renderizarGraficoMediaNotasPorAno(listaDeFilmesAssistidos); renderizarGraficoAssistidosPorMes(listaDeFilmesAssistidos); renderizarGraficoDiretores(listaDeFilmesAssistidos);
    }

    // Funções auxiliares para renderizar cada gráfico específico
    // (Código inalterado, apenas formatado e com checagem de canvas)
    function renderizarGraficoGeneros(d) { const id = 'generosChart'; const ctx = document.getElementById(id)?.getContext('2d'); if (!ctx) return; const top = criarRankingArray(d, 'genero').slice(0, 5); if (top.length > 0) charts[id] = new Chart(ctx, { type: 'doughnut', data: { labels: top.map(i => i[0]), datasets: [{ label:'Filmes', data: top.map(i => i[1]), backgroundColor: ['#a855f7', '#3b82f6', '#ec4899', '#f97316', '#14b8a6'], borderWidth: 0 }] }, options: { responsive: true, maintainAspectRatio: false } }); }
    function renderizarGraficoAnos(d) { const id = 'anosChart'; const ctx = document.getElementById(id)?.getContext('2d'); if (!ctx) return; const contagem = d.reduce((a, f) => { if(f.ano) a[f.ano] = (a[f.ano] || 0) + 1; return a; }, {}); const top = Object.entries(contagem).sort(([a],[b]) => b - a).slice(0, 10).reverse(); if (top.length > 0) charts[id] = new Chart(ctx, { type: 'bar', data: { labels: top.map(i => i[0]), datasets: [{ label:'Qtd. Filmes', data: top.map(i => i[1]), backgroundColor: 'rgba(59, 130, 246, 0.7)' }] }, options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } } }); }
    function renderizarGraficoNotas(d) { const id = 'notasChart'; const ctx = document.getElementById(id)?.getContext('2d'); if (!ctx) return; const contagem = d.reduce((a, f) => { if (f.nota != null) { const n = Math.round(f.nota); a[n] = (a[n] || 0) + 1; } return a; }, {}); const labels = Object.keys(contagem).sort((a,b) => a-b); const data = labels.map(l => contagem[l]); if (labels.length > 0) charts[id] = new Chart(ctx, { type: 'line', data: { labels, datasets: [{ label:'Distribuição de Notas', data, borderColor: '#ec4899', tension: 0.3, fill: true, backgroundColor: 'rgba(236, 72, 153, 0.2)' }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { title: { display: true, text: 'Quantidade de Filmes' } }, x: { title: { display: true, text: 'Nota Arredondada' } } } } }); }
    function renderizarGraficoOrigem(d) { const id = 'origemChart'; const ctx = document.getElementById(id)?.getContext('2d'); if (!ctx) return; const contagem = d.reduce((a, f) => { if (f.origem) a[f.origem] = (a[f.origem] || 0) + 1; return a; }, {}); if (Object.keys(contagem).length > 0) charts[id] = new Chart(ctx, { type: 'pie', data: { labels: Object.keys(contagem), datasets: [{ label:'Origem', data: Object.values(contagem), backgroundColor: ['#3b82f6', '#14b8a6'], borderWidth: 0 }] }, options: { responsive: true, maintainAspectRatio: false } }); }
    function renderizarGraficoMediaNotasPorAno(d) { const id = 'mediaNotasAnoChart'; const ctx = document.getElementById(id)?.getContext('2d'); if (!ctx) return; const notas = d.reduce((a, f) => { if (f.ano && f.nota != null) { if (!a[f.ano]) a[f.ano] = { total: 0, count: 0 }; a[f.ano].total += f.nota; a[f.ano].count++; } return a; }, {}); const labels = Object.keys(notas).sort((a, b) => a - b); if (labels.length > 0) { const data = labels.map(ano => (notas[ano].total / notas[ano].count).toFixed(1)); charts[id] = new Chart(ctx, { type: 'line', data: { labels, datasets: [{ label:'Média de Notas', data, borderColor: '#f97316', backgroundColor: 'rgba(249, 115, 22, 0.2)', fill: true, tension: 0.3 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: false, title: { display: true, text: 'Média de Nota' }}, x: { title: { display: true, text: 'Ano de Lançamento' }} } } }); } }
    function renderizarGraficoAssistidosPorMes(d) { const id = 'assistidosMesChart'; const ctx = document.getElementById(id)?.getContext('2d'); if (!ctx) return; const contagem = {}; const meses = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"]; const hoje = new Date(); for (let i = 11; i >= 0; i--) { let dt = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1); let chave = `${meses[dt.getMonth()]}/${String(dt.getFullYear()).slice(-2)}`; contagem[chave] = 0; } d.forEach(f => { if (f.assistido && f.dataAssistido) { try { const dA = new Date(f.dataAssistido.replace(/-/g, '/')); const chave = `${meses[dA.getMonth()]}/${String(dA.getFullYear()).slice(-2)}`; if (contagem.hasOwnProperty(chave)) contagem[chave]++; } catch(e){ console.warn("Data inválida para gráfico:", f.dataAssistido)}} }); charts[id] = new Chart(ctx, { type: 'bar', data: { labels: Object.keys(contagem), datasets: [{ label:'Filmes Assistidos', data: Object.values(contagem), backgroundColor: 'rgba(168, 85, 247, 0.7)' }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, title: {display: true, text: 'Quantidade'}}, x: {title: {display: true, text: 'Mês/Ano'}} } } }); }
    function renderizarGraficoDiretores(d) { const id = 'diretoresChart'; const ctx = document.getElementById(id)?.getContext('2d'); if (!ctx) return; const top = criarRankingArray(d, 'direcao').slice(0, 5); if (top.length > 0) charts[id] = new Chart(ctx, { type: 'bar', data: { labels: top.map(i => i[0]), datasets: [{ label:'Qtd. Filmes', data: top.map(i => i[1]), backgroundColor: 'rgba(236, 72, 153, 0.7)' }] }, options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { beginAtZero: true }} } }); }

    // ==========================================================================
    // [ 11 ] FUNÇÕES DE IMPORTAÇÃO/EXPORTAÇÃO
    // ==========================================================================
    // (Código inalterado, apenas formatado e com melhorias no parser CSV)
    const obterDataFormatada = () => new Date().toISOString().slice(0, 10);
    const baixarArquivo = (conteudo, nomeArquivo, tipoConteudo) => { const a = document.createElement("a"); const arquivo = new Blob([conteudo], { type: tipoConteudo }); a.href = URL.createObjectURL(arquivo); a.download = nomeArquivo; a.click(); URL.revokeObjectURL(a.href); };
    const exportarParaJSON = () => { const f = aplicarFiltrosEordenacao(filmes); if (f.length === 0) return Swal.fire('Atenção', 'Não há filmes (com os filtros atuais) para exportar.', 'warning'); baixarArquivo(JSON.stringify(f, null, 2), `meus_filmes_${obterDataFormatada()}.json`, 'application/json'); showToast('Lista exportada para JSON!'); };
    const exportarParaCSV = () => { const f = aplicarFiltrosEordenacao(filmes); if (f.length === 0) return Swal.fire('Atenção', 'Não há filmes (com os filtros atuais) para exportar.', 'warning'); const cabecalho = ['titulo', 'ano', 'nota', 'direcao', 'atores', 'genero', 'origem', 'assistido', 'dataAssistido']; const formatar = v => { let s=String(v==null?'':v); if(s.includes(',') || s.includes('"') || s.includes('\n')){s='"'+s.replace(/"/g,'""')+'"'} return s; }; const linhas = f.map(filme => cabecalho.map(c => formatar(Array.isArray(filme[c])?filme[c].join('; '):filme[c])).join(',')); baixarArquivo([cabecalho.join(','), ...linhas].join('\n'), `meus_filmes_${obterDataFormatada()}.csv`, 'text/csv;charset=utf-8;'); showToast('Lista exportada para CSV!'); };
    const importarDeArquivo = (event) => { if (!currentUserId) { Swal.fire('Erro!', 'Você precisa estar logado para importar filmes.', 'error'); return; } const arquivo = event.target.files[0]; if (!arquivo) return; const reader = new FileReader(); reader.onload = async (e) => { let filmesImportados = []; try { if (arquivo.name.endsWith('.json')) { filmesImportados = JSON.parse(e.target.result); } else if (arquivo.name.endsWith('.csv')) { const linhas = e.target.result.split(/\r?\n/).filter(l => l.trim()); if (linhas.length < 2) throw new Error("CSV inválido ou vazio."); const cabecalho = linhas.shift().split(',').map(h => h.trim()); filmesImportados = linhas.map(linha => { const valores = linha.match(/(".*?"|[^",]+)(?=\s*,|\s*$)/g) || []; return cabecalho.reduce((obj, chave, i) => { let valor = valores[i] ? valores[i].trim().replace(/^"|"$/g, '').replace(/""/g, '"') : ''; if (['atores', 'direcao', 'genero'].includes(chave) && valor) { obj[chave] = valor.split(';').map(s => s.trim()).filter(Boolean); } else if (chave === 'assistido') { obj[chave] = ['true', 'sim', '1'].includes(valor.toLowerCase()); } else if (['ano', 'nota'].includes(chave) && valor !== '') { obj[chave] = Number(valor); if (isNaN(obj[chave])) obj[chave] = null; } else { obj[chave] = valor || null; } return obj; }, {}); }); } else { throw new Error("Formato de arquivo não suportado (.json ou .csv)."); } await processarFilmesImportados(filmesImportados); } catch (error) { Swal.fire('Erro!', `Não foi possível processar o arquivo: ${error.message}`, 'error'); } event.target.value = ''; }; reader.readAsText(arquivo, 'UTF-8'); };
    const processarFilmesImportados = async (filmesImportados) => { if (!Array.isArray(filmesImportados) || filmesImportados.length === 0) return Swal.fire('Atenção', 'Nenhum filme válido encontrado no arquivo.', 'warning'); const colRef = getUserFilmesCollection(); if (!colRef) return; const titulosExistentes = new Set(filmes.map(f => f.titulo.toLowerCase())); const filmesParaAdicionar = filmesImportados.filter(f => f.titulo && typeof f.titulo === 'string' && !titulosExistentes.has(f.titulo.toLowerCase())); const numNovos = filmesParaAdicionar.length, numDuplicados = filmesImportados.length - numNovos; if (numNovos === 0) return Swal.fire('Importação Concluída', `Nenhum filme novo para adicionar. ${numDuplicados > 0 ? numDuplicados + ' filme(s) duplicado(s) foram ignorados.' : ''}`, 'info'); const { isConfirmed } = await Swal.fire({ title: 'Confirmar Importação', icon: 'question', showCancelButton: true, html: `Encontrados <b>${numNovos}</b> novo(s) filme(s) para adicionar.<br>${numDuplicados > 0 ? numDuplicados + ' duplicado(s) foram ignorados.<br>': ''}Deseja continuar?`, confirmButtonText: 'Sim, importar!', cancelButtonText: 'Cancelar' }); if (isConfirmed) { Swal.showLoading(); try { const batch = writeBatch(db); filmesParaAdicionar.forEach(filme => { const docRef = doc(colRef); batch.set(docRef, { titulo: filme.titulo || 'Sem Título', ano: parseInt(filme.ano) || null, nota: parseFloat(filme.nota) || 0, direcao: Array.isArray(filme.direcao) ? filme.direcao : [], atores: Array.isArray(filme.atores) ? filme.atores : [], genero: Array.isArray(filme.genero) ? filme.genero : [], origem: filme.origem || null, assistido: filme.assistido === true, dataAssistido: filme.assistido === true ? (filme.dataAssistido || null) : null, cadastradoEm: serverTimestamp() }); }); await batch.commit(); showToast(`${numNovos} filme(s) importado(s) com sucesso!`); carregarFilmes(); } catch(error) { Swal.close(); console.error("Erro ao salvar filmes importados:", error); Swal.fire('Erro!', 'Ocorreu um erro ao salvar os filmes importados.', 'error'); } } };

    // ==========================================================================
    // [ 12 ] EVENT LISTENERS (Configuração dos gatilhos da UI)
    // ==========================================================================
    function setupEventListeners() {
        console.log("Configurando event listeners...");

        // Autenticação
        loginForm?.addEventListener('submit', handleLogin);
        registerForm?.addEventListener('submit', handleRegister);
        logoutBtn?.addEventListener('click', handleLogout);
        forgotPasswordLink?.addEventListener('click', handleForgotPassword);
        changePasswordBtn?.addEventListener('click', handleChangePassword);
        showRegisterLink?.addEventListener('click', (e) => { e.preventDefault(); loginCard.style.display = 'none'; registerCard.style.display = 'block'; });
        showLoginLink?.addEventListener('click', (e) => { e.preventDefault(); loginCard.style.display = 'block'; registerCard.style.display = 'none'; });

        // Tema
        const temaSalvo = localStorage.getItem('theme') || 'dark'; // Padrão 'dark'
        body.classList.toggle('dark-mode', temaSalvo === 'dark');
        if (themeToggleBtn) {
            themeToggleBtn.innerHTML = temaSalvo === 'dark' ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
            themeToggleBtn.addEventListener('click', () => {
                const isDark = body.classList.toggle('dark-mode');
                localStorage.setItem('theme', isDark ? 'dark' : 'light');
                themeToggleBtn.innerHTML = isDark ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
                if (typeof atualizarUI === 'function') { atualizarUI(); } // Atualiza UI (gráficos usam cores do tema)
            });
        }

        // Ações do App
        document.getElementById('export-json-btn')?.addEventListener('click', exportarParaJSON);
        document.getElementById('export-csv-btn')?.addEventListener('click', exportarParaCSV);
        document.getElementById('import-btn')?.addEventListener('click', () => document.getElementById('import-file-input')?.click());
        document.getElementById('import-file-input')?.addEventListener('change', importarDeArquivo);
        document.getElementById('sugerir-filme-btn')?.addEventListener('click', sugerirFilmeAleatorio);
        formElements.form?.addEventListener('submit', salvarFilme);
        formElements.assistido?.addEventListener('change', () => { formElements.dataAssistidoGroup.style.display = formElements.assistido.value === 'sim' ? 'block' : 'none'; });

        // Filtros
        filterElements.container?.addEventListener('input', () => atualizarUI()); // Atualiza em qualquer input/select
        filterElements.limparBtn?.addEventListener('click', limparFiltros);

        // Tabela (Ordenação e Ações)
        document.getElementById('filmesTabContent')?.addEventListener('click', (event) => {
            const target = event.target;
            const header = target.closest('th.sortable');
            const editBtn = target.closest('.btn-edit');
            const deleteBtn = target.closest('.btn-delete');
            if (header) { // Clique no cabeçalho para ordenar
                const column = header.dataset.sort;
                if (!column) return;
                if (sortBy === column) { sortDirection = sortDirection === 'asc' ? 'desc' : 'asc'; }
                else { sortBy = column; sortDirection = 'asc'; }
                atualizarUI();
            } else if (editBtn) { // Clique no botão Editar
                const id = editBtn.closest('tr')?.dataset.id;
                if (id) prepararEdicao(id);
            } else if (deleteBtn) { // Clique no botão Excluir
                const id = deleteBtn.closest('tr')?.dataset.id;
                if (id) deletarFilme(id);
            }
        });

        // Tags de Gênero
        formElements.generoTagContainer?.addEventListener('click', () => { formElements.generoInput.focus(); });
        formElements.generoInput?.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); adicionarTag(formElements.generoInput.value); } else if (e.key === 'Backspace' && formElements.generoInput.value === '') { if (generosSelecionadosAtualmente.length > 0) { removerTag(generosSelecionadosAtualmente[generosSelecionadosAtualmente.length - 1]); } } });
        formElements.generoInput?.addEventListener('input', () => { if (GENEROS_PREDEFINIDOS.includes(formElements.generoInput.value)) { adicionarTag(formElements.generoInput.value); } });

        console.log("Event listeners configurados.");
    }

    // ==========================================================================
    // [ 13 ] INICIALIZAÇÃO DA APLICAÇÃO
    // ==========================================================================
    console.log("Inicializando aplicação...");
    popularSugestoesDeGenero(); // Preenche o datalist de gêneros
    setupEventListeners();      // Configura todos os cliques e inputs
    // A função onAuthStateChanged cuidará de chamar carregarFilmes() assim que o estado de login for determinado.
    console.log("Aplicação pronta. Aguardando estado de autenticação...");
});