// Aguarda o DOM carregar e importa dinamicamente as funções de auth
document.addEventListener('DOMContentLoaded', async () => {
    
    // --- CONFIGURAÇÃO FIREBASE ---
    const { createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut, sendPasswordResetEmail } = await import("https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js");
    const { auth } = window.firebaseApp;
    
    const { db, collection, addDoc, getDocs, doc, updateDoc, deleteDoc, serverTimestamp, query, orderBy, where, setDoc, limit, getDoc } = window.db;
    
    const { onSnapshot } = await import("https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js");

    // --- ESTADO DA APLICAÇÃO ---
    let currentUserId = null; 
    let unsubscribeFilmes = null;
    let filmes = [];
    let filmeEmEdicao = null;
    let charts = {};
    let sortBy = 'cadastradoEm';
    let sortDirection = 'asc';
    let generosSelecionadosAtualmente = [];

    // NOVO: Armazena os dados do perfil do usuário logado
    let currentUserProfile = null;

    let nicknameCheckTimer = null; 
    let isNicknameValid = false;   
    let lastCheckedNickname = '';   

    // NOVO: Definição das Conquistas
    const CONQUISTAS_DEFINICOES = [
        {
            id: 'cinefilo_10',
            nome: 'Cinéfilo Iniciante',
            descricao: 'Cadastrou 10 filmes na sua lista.',
            icone: 'fa-solid fa-film',
            check: (filmes) => filmes.length >= 10
        },
        {
            id: 'critico_10',
            nome: 'Crítico de Cinema',
            descricao: 'Deu nota 10 para pelo menos um filme.',
            icone: 'fa-solid fa-star',
            check: (filmes) => filmes.some(f => f.nota === 10)
        },
        {
            id: 'nacional_5',
            nome: 'Viva o Cinema Nacional',
            descricao: 'Cadastrou 5 filmes de origem "Nacional".',
            icone: 'fa-solid fa-flag',
            check: (filmes) => filmes.filter(f => f.origem === 'Nacional').length >= 5
        },
        {
            id: 'fa_carteirinha_3',
            nome: 'Fã de Carteirinha',
            descricao: 'Cadastrou 3 ou mais filmes do mesmo diretor.',
            icone: 'fa-solid fa-user-check',
            check: (filmes) => {
                const diretores = {};
                filmes.flatMap(f => f.direcao || []).forEach(d => {
                    if(d) diretores[d] = (diretores[d] || 0) + 1;
                });
                return Object.values(diretores).some(count => count >= 3);
            }
        },
        {
            id: 'maratonista_5',
            nome: 'O Maratonista',
            descricao: 'Assistiu 5 ou mais filmes no mesmo mês.',
            icone: 'fa-solid fa-person-running',
            check: (filmes) => {
                const meses = {};
                filmes.filter(f => f.assistido && f.dataAssistido).forEach(f => {
                    try {
                        const [ano, mes] = f.dataAssistido.split('-');
                        const key = `${ano}-${mes}`;
                        meses[key] = (meses[key] || 0) + 1;
                    } catch(e) {}
                });
                return Object.values(meses).some(count => count >= 5);
            }
        }
    ];

    const GENEROS_PREDEFINIDOS = [
        "Action", "Adventure", "Animation", "Comedy", "Crime",
        "Documentary", "Drama", "Fantasy", "History", "Horror",
        "Music", "Mystery", "Romance", "Science Fiction", "Thriller",
        "War", "Western"
    ].sort();

    // --- CACHE DE ELEMENTOS DO DOM (App e Auth) ---
    const body = document.body;
    const themeToggleBtn = document.getElementById('theme-toggle');
    const dataAssistidoGroup = document.getElementById('data-assistido-group');
    const welcomeMessage = document.getElementById('welcome-message'); // NOVO
    
    // Elementos do App
    const appContent = document.getElementById('app-content');
    const appNavLinks = document.querySelectorAll('.app-nav');
    
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

    // Elementos do Formulário de Filme
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
    };

    // Elementos dos Filtros
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
    
    const generoTagContainer = document.getElementById('genero-tag-container');
    const generoInput = document.getElementById('genero-input');

    // --- FUNÇÕES DE AUTENTICAÇÃO ---
    // (handleLogin e handleRegister estão INTACTAS)
    const handleLogin = async (e) => {
        e.preventDefault();
        const identifier = document.getElementById('login-identifier').value; 
        const password = document.getElementById('login-password').value;
        let userEmail = '';
        try {
            if (identifier.includes('@')) {
                userEmail = identifier;
            } else {
                const q = query(collection(db, "users"), where("nickname", "==", identifier), limit(1));
                const querySnapshot = await getDocs(q);
                if (querySnapshot.empty) {
                    throw new Error("auth/user-not-found");
                }
                const userData = querySnapshot.docs[0].data();
                userEmail = userData.email;
            }
            await signInWithEmailAndPassword(auth, userEmail, password);
        } catch (error) {
            console.error("Erro no login:", error);
            let errorTitle = 'Erro no Login';
            let errorText = 'Email, nickname ou senha inválidos. Por favor, tente novamente.';
            if (error.message === "auth/user-not-found") {
                 errorText = 'Usuário não encontrado com este email ou nickname.';
            } else if (error.code === 'auth/wrong-password') {
                 errorText = 'Senha incorreta. Por favor, tente novamente.';
            }
            Swal.fire({ icon: 'error', title: errorTitle, text: errorText });
        }
    };

    const handleRegister = async (e) => {
        e.preventDefault();
        const nome = document.getElementById('register-name').value;
        const nickname = document.getElementById('register-nickname').value;
        const email = document.getElementById('register-email').value;
        const password = document.getElementById('register-password').value;
    
        if (!nome || !nickname || !email || !password) {
            Swal.fire({ icon: 'warning', title: 'Campos Incompletos', text: 'Por favor, preencha todos os campos do cadastro.' });
            return;
        }
        if (!isNicknameValid || nickname !== lastCheckedNickname) {
            Swal.fire({ icon: 'error', title: 'Nickname Inválido', text: 'Por favor, escolha um nickname válido e disponível.' });
            return;
        }
        try {
            const q = query(collection(db, "users"), where("nickname", "==", nickname));
            const nicknameSnapshot = await getDocs(q);
            if (!nicknameSnapshot.empty) {
                Swal.fire({ icon: 'error', title: 'Nickname Já Existe', text: 'Este nickname foi registrado por outro usuário no último segundo. Por favor, escolha outro.' });
                return;
            }
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;
            const userDocRef = doc(db, "users", user.uid);
            await setDoc(userDocRef, {
                uid: user.uid,
                nome: nome,
                nickname: nickname,
                email: email,
                membroDesde: serverTimestamp() 
            });
        } catch (error) {
            console.error("Erro no cadastro:", error.message);
            if (error.code === 'auth/email-already-in-use') {
                Swal.fire({ icon: 'error', title: 'Erro no Cadastro', text: 'Este email já está sendo usado por outra conta.' });
            } else {
                Swal.fire({ icon: 'error', title: 'Erro no Cadastro', text: 'Não foi possível criar sua conta. Tente novamente.' });
            }
        }
    };

    // --- NOVA FUNÇÃO DE MIGRAÇÃO (INSERIDA AQUI) ---
    const exibirModalCompletarPerfil = async (user) => {
        Swal.fire({
            title: 'Complete seu Perfil',
            html: `
                <p>Olá! Notamos que este é seu primeiro login com o novo sistema. Por favor, complete seu perfil para continuar.</p>
                <input type="text" id="swal-nome" class="swal2-input" placeholder="Seu Nome Completo" required>
                <input type="text" id="swal-nickname" class="swal2-input" placeholder="Seu Nickname (mín. 4 caracteres, sem espaços)" required>
            `,
            focusConfirm: false,
            allowOutsideClick: false, // Força o usuário a preencher
            allowEscapeKey: false, // Força o usuário a preencher
            showCancelButton: false, // Não pode cancelar
            confirmButtonText: 'Salvar e Entrar',
            preConfirm: async () => {
                const nome = document.getElementById('swal-nome').value;
                const nickname = document.getElementById('swal-nickname').value.trim().toLowerCase();
                const email = user.email; // Pega o email do usuário logado

                // 1. Validação de Nome
                if (!nome) {
                    Swal.showValidationMessage('Por favor, insira seu nome.');
                    return false;
                }

                // 2. Validação de Nickname (reimplementando a lógica)
                if (nickname.length < 4) {
                    Swal.showValidationMessage('Nickname deve ter pelo menos 4 caracteres.');
                    return false;
                }
                if (/\s/.test(nickname)) {
                    Swal.showValidationMessage('Nickname não pode conter espaços.');
                    return false;
                }

                try {
                    // 3. Validação de Nickname (Disponibilidade)
                    const q = query(collection(db, "users"), where("nickname", "==", nickname));
                    const nicknameSnapshot = await getDocs(q);
                    
                    if (!nicknameSnapshot.empty) {
                        Swal.showValidationMessage('Este nickname já está em uso. Escolha outro.');
                        return false;
                    }

                    // Se tudo estiver OK, retorna os dados
                    return { nome, nickname, email };

                } catch (error) {
                    console.error("Erro ao checar nickname no Swal:", error);
                    // Isso pode falhar se suas Regras de Segurança estiverem erradas
                    Swal.showValidationMessage('Erro ao verificar o nickname. Tente novamente.');
                    return false;
                }
            }
        }).then(async (result) => {
            if (result.isConfirmed && result.value) {
                const { nome, nickname, email } = result.value;
                try {
                    // 4. Salva o documento do perfil que faltava
                    const userDocRef = doc(db, "users", user.uid);
                    await setDoc(userDocRef, {
                        uid: user.uid,
                        nome: nome,
                        nickname: nickname,
                        email: email,
                        membroDesde: serverTimestamp() 
                    });

                    await Swal.fire('Sucesso!', 'Seu perfil foi atualizado.', 'success');
                    
                    // 5. Recarrega a página para que o onAuthStateChanged
                    // rode novamente, mas desta vez com o perfil existente.
                    window.location.reload();

                } catch (error) {
                    console.error("Erro ao salvar perfil migrado:", error);
                    Swal.fire('Erro!', 'Não foi possível salvar seu perfil. Tente logar novamente.', 'error');
                    handleLogout();
                }
            }
        });
    };

    const handleLogout = () => {
        if (unsubscribeFilmes) {
            unsubscribeFilmes(); 
            unsubscribeFilmes = null;
        }
        signOut(auth).catch((error) => {
            console.error("Erro no logout:", error);
        });
    };

    // --- "PORTEIRO" DA APLICAÇÃO (ATUALIZADO) ---
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            // --- USUÁRIO ESTÁ LOGADO ---
            currentUserId = user.uid; 
            
            // NOVO: Verifica se o perfil existe
            const profileExists = await carregarPerfilUsuario(user.uid);

            if (profileExists) {
                // --- PERFIL OK, MOSTRA A APP ---
                appContent.style.display = 'block';
                logoutContainer.style.display = 'block';
                authContainer.style.display = 'none';
                appNavLinks.forEach(link => link.style.display = 'block'); 
                carregarFilmes();
            } else {
                // --- PERFIL NÃO EXISTE, FORÇA MIGRAÇÃO ---
                appContent.style.display = 'none';
                logoutContainer.style.display = 'block'; // Deixa deslogar
                authContainer.style.display = 'none'; // Esconde login/register
                appNavLinks.forEach(link => link.style.display = 'none'); 
                
                // Chama o novo modal de migração
                exibirModalCompletarPerfil(user);
            }

        } else {
            // --- USUÁRIO ESTÁ DESLOGADO --- (Lógica original, está OK)
            currentUserId = null;
            currentUserProfile = null; // NOVO: Limpa o perfil
            filmes = []; 

            appContent.style.display = 'none';
            logoutContainer.style.display = 'none';
            authContainer.style.display = 'block';
            appNavLinks.forEach(link => link.style.display = 'none'); 
            
            // NOVO: Esconde a mensagem de boas-vindas
            welcomeMessage.style.display = 'none';
            welcomeMessage.textContent = '';

            loginCard.style.display = 'block';
            registerCard.style.display = 'none';
            
            atualizarUI(); 
        }
    });

    // --- NOVO: FUNÇÕES DE PERFIL E CONQUISTAS ---

    /**
     * Busca os dados do perfil do usuário no Firestore e renderiza o perfil.
     * Retorna 'true' se o perfil existir, 'false' se não existir.
     */
    async function carregarPerfilUsuario(uid) {
        if (!uid) return false; // Adicionado retorno
        try {
            const docRef = doc(db, "users", uid);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                currentUserProfile = docSnap.data();
                
                // Popula a mensagem de boas-vindas na navbar
                welcomeMessage.textContent = `Olá, ${currentUserProfile.nickname}!`;
                welcomeMessage.style.display = 'block';

                // Renderiza a seção de perfil
                renderizarPerfil();
                return true; // <-- SUCESSO, perfil existe
            } else {
                console.warn("Documento de perfil do usuário não encontrado! Iniciando migração.");
                return false; // <-- FALHA, perfil não existe (NÃO DESLOGA MAIS)
            }
        } catch (error) {
            console.error("Erro ao carregar perfil do usuário:", error);
            Swal.fire({ icon: 'error', title: 'Erro Crítico', text: 'Não foi possível ler o banco de dados de perfis.' });
            handleLogout(); // Se a LEITURA falhar (ex: regras), deslogar é a única opção.
            return false; 
        }
    }

    /**
     * Popula a seção de perfil com os dados do usuário e estatísticas.
     */
    function renderizarPerfil() {
        if (!currentUserProfile) return;

        // Popula informações básicas
        document.getElementById('perfil-nome').textContent = currentUserProfile.nome;
        document.getElementById('perfil-nickname').textContent = `@${currentUserProfile.nickname}`;
        
        if (currentUserProfile.membroDesde) {
            const dataCadastro = currentUserProfile.membroDesde.toDate();
            document.getElementById('perfil-membro-desde').textContent = `Membro desde ${dataCadastro.toLocaleDateString('pt-BR', { year: 'numeric', month: 'long' })}`;
        }

        // Popula estatísticas globais (baseado no array 'filmes' global)
        document.getElementById('perfil-total-filmes').textContent = filmes.length;
        document.getElementById('perfil-total-assistidos').textContent = filmes.filter(f => f.assistido).length;

        // Calcula e renderiza as conquistas
        const conquistas = calcularConquistas(filmes);
        renderizarConquistas(conquistas);
    }

    /**
     * Verifica todas as definições de conquistas contra a lista de filmes.
     */
    function calcularConquistas(filmes) {
        return CONQUISTAS_DEFINICOES.map(conquista => {
            const desbloqueada = conquista.check(filmes);
            return {
                ...conquista,
                unlocked: desbloqueada
            };
        });
    }

    /**
     * Renderiza os selos de conquista (desbloqueados e bloqueados) no HTML.
     */
    function renderizarConquistas(conquistas) {
        const container = document.getElementById('conquistas-container');
        if (!container) return;
        
        container.innerHTML = ''; // Limpa os selos antigos
        
        if (conquistas.length === 0) {
            container.innerHTML = '<p class="text-muted">Comece a cadastrar filmes para desbloquear conquistas!</p>';
            return;
        }
        
        conquistas.forEach(conq => {
            const seloHTML = `
                <div class="conquista-selo ${conq.unlocked ? 'unlocked' : ''}" title="${conq.unlocked ? conq.descricao : `BLOQUEADA: ${conq.descricao}`}">
                    <i class="${conq.icone}"></i>
                    <span>${conq.nome}</span>
                </div>
            `;
            container.innerHTML += seloHTML;
        });
    }


    // --- FUNÇÕES AUXILIARES (INTACTO) ---
    const showToast = (title) => {
        const Toast = Swal.mixin({
            toast: true, position: 'top-end', showConfirmButton: false, timer: 3000, timerProgressBar: true,
            didOpen: (toast) => {
                toast.addEventListener('mouseenter', Swal.stopTimer);
                toast.addEventListener('mouseleave', Swal.resumeTimer);
            }
        });
        Toast.fire({ icon: 'success', title: title });
    };
    const parseCSV = (string) => string.split(',').map(s => s.trim()).filter(Boolean);
    const popularSelect = (selectElement, items, label) => {
        selectElement.innerHTML = `<option value="todos">${label}</option>`;
        [...new Set(items)].sort((a, b) => b - a).forEach(item => {
            if (item) selectElement.add(new Option(item, item));
        });
    };
    const ativarArrastarParaRolar = (selector) => {
        const slider = document.querySelector(selector);
        if (!slider) return;
        let isDown = false, startX, scrollLeft;
        slider.addEventListener('mousedown', (e) => { isDown = true; slider.classList.add('active'); startX = e.pageX - slider.offsetLeft; scrollLeft = slider.scrollLeft; });
        slider.addEventListener('mouseleave', () => { isDown = false; slider.classList.remove('active'); });
        slider.addEventListener('mouseup', () => { isDown = false; slider.classList.remove('active'); });
        slider.addEventListener('mousemove', (e) => { if (!isDown) return; e.preventDefault(); const x = e.pageX - slider.offsetLeft; const walk = (x - startX) * 2; slider.scrollLeft = scrollLeft - walk; });
    };
    
    // --- FUNÇÕES DE TAGS (INTACTO) ---
    function renderizarTags() {
        generoTagContainer.querySelectorAll('.tag-pill').forEach(tagEl => tagEl.remove());
        generosSelecionadosAtualmente.slice().reverse().forEach(label => {
            const tagEl = criarTag(label);
            generoTagContainer.prepend(tagEl);
        });
    }
    function criarTag(label) {
        const tagEl = document.createElement('span');
        tagEl.className = 'tag-pill';
        const labelEl = document.createElement('span');
        labelEl.textContent = label;
        const removeBtn = document.createElement('button');
        removeBtn.className = 'tag-remove-btn';
        removeBtn.innerHTML = '&times;';
        removeBtn.addEventListener('click', () => { removerTag(label); });
        tagEl.appendChild(labelEl);
        tagEl.appendChild(removeBtn);
        return tagEl;
    }
    function adicionarTag(label) {
        const trimmedLabel = label.trim();
        if (!trimmedLabel || !GENEROS_PREDEFINIDOS.includes(trimmedLabel) || generosSelecionadosAtualmente.includes(trimmedLabel)) return;
        generosSelecionadosAtualmente.push(trimmedLabel);
        renderizarTags();
        generoInput.value = '';
        generoInput.focus();
    }
    function removerTag(label) {
        generosSelecionadosAtualmente = generosSelecionadosAtualmente.filter(g => g !== label);
        renderizarTags();
    }
    function popularSugestoesDeGenero() {
        const datalist = document.getElementById('generos-sugeridos');
        datalist.innerHTML = GENEROS_PREDEFINIDOS.map(g => `<option value="${g}"></option>`).join('');
    }

    // --- LÓGICA PRINCIPAL (Atualizar UI, Filtros) ---
    const atualizarUI = (listaDeFilmes = filmes) => {
        const filmesFiltrados = aplicarFiltrosEordenacao(listaDeFilmes);
        renderizarTabela(filmesFiltrados, 'tabela-todos-container');
        renderizarTabela(filmesFiltrados.filter(f => f.assistido), 'tabela-assistidos-container');
        renderizarTabela(filmesFiltrados.filter(f => !f.assistido), 'tabela-nao-assistidos-container');
        const filmesParaEstasticas = filmesFiltrados.filter(f => f.assistido);
        atualizarEstatisticas(filmesParaEstasticas);
        renderizarGraficos(filmesParaEstasticas);
    };
    const popularFiltros = (listaDeFilmes) => {
        const todosAnos = listaDeFilmes.map(filme => filme.ano).filter(Boolean);
        popularSelect(filterElements.ano, todosAnos, "Todos os Anos");
    };
    const aplicarFiltrosEordenacao = (listaDeFilmes) => {
        let filmesProcessados = [...listaDeFilmes];
        const filtros = {
            busca: filterElements.busca.value.toLowerCase(),
            genero: filterElements.genero.value.toLowerCase(),
            diretor: filterElements.diretor.value.toLowerCase(),
            ator: filterElements.ator.value.toLowerCase(),
            ano: filterElements.ano.value,
            origem: filterElements.origem.value,
            assistido: filterElements.assistido.value,
        };
        if (filtros.busca) filmesProcessados = filmesProcessados.filter(f => f.titulo.toLowerCase().includes(filtros.busca));
        if (filtros.genero) filmesProcessados = filmesProcessados.filter(f => f.genero?.some(g => g.toLowerCase().includes(filtros.genero)));
        if (filtros.diretor) filmesProcessados = filmesProcessados.filter(f => f.direcao?.some(d => d.toLowerCase().includes(filtros.diretor)));
        if (filtros.ator) filmesProcessados = filmesProcessados.filter(f => f.atores?.some(a => a.toLowerCase().includes(filtros.ator)));
        if (filtros.ano !== 'todos') filmesProcessados = filmesProcessados.filter(f => f.ano.toString() === filtros.ano);
        if (filtros.origem !== 'todos') filmesProcessados = filmesProcessados.filter(f => f.origem === filtros.origem);
        if (filtros.assistido !== 'todos') filmesProcessados = filmesProcessados.filter(f => f.assistido === (filtros.assistido === 'sim'));
        
        return filmesProcessados.sort((a, b) => {
            if (!a.hasOwnProperty(sortBy) || a[sortBy] === null) return 1;
            if (!b.hasOwnProperty(sortBy) || b[sortBy] === null) return -1;
            const valA = a[sortBy], valB = b[sortBy];
            let comparison = typeof valA === 'string' ? valA.localeCompare(valB) : valA - valB;
            return sortDirection === 'asc' ? comparison : -comparison;
        });
    };

    // --- FUNÇÕES CRUD (INTACTO) ---
    const getUserFilmesCollection = () => {
        if (!currentUserId) return null;
        return collection(db, "users", currentUserId, "filmes");
    };
    const getUserFilmeDoc = (id) => {
         if (!currentUserId) return null;
         return doc(db, "users", currentUserId, "filmes", id);
    }

     const carregarFilmes = () => {
         const colRef = getUserFilmesCollection();
         if (!colRef) return;
         if (unsubscribeFilmes) {
             unsubscribeFilmes();
         }
         const q = query(colRef, orderBy("cadastradoEm", "asc"));

         unsubscribeFilmes = onSnapshot(q, (querySnapshot) => {
             filmes = querySnapshot.docs.map(doc => ({
                 id: doc.id,
                 ...doc.data(),
                 cadastradoEm: doc.data().cadastradoEm?.toDate() || new Date(0)
             }));
             
             // NOVO: Atualiza a seção de perfil com os novos totais e conquistas
             if (currentUserProfile) {
                 renderizarPerfil();
             }
             
             popularFiltros(filmes); 
             atualizarUI();

         }, (error) => {
             console.error("Erro ao escutar filmes:", error);
             Swal.fire({ icon: 'error', title: 'Oops...', text: 'Não foi possível carregar os filmes em tempo real.' });
         });
    }; 

    const salvarFilme = async (event, tituloValue) => {
        event.preventDefault();
        const colRef = getUserFilmesCollection();
        if (!colRef) return; 
        
        if (!filmeEmEdicao) {
            try {
                const q = query(colRef, where("titulo", "==", tituloValue));
                const snapshot = await getDocs(q);
                if (!snapshot.empty) {
                    Swal.fire({ icon: 'error', title: 'Filme Duplicado', text: 'Um filme com este título já existe na sua lista.' });
                    return formElements.titulo.focus();
                }
            } catch (error) {
                console.error("Erro ao verificar duplicidade:", error);
                Swal.fire({ icon: 'error', title: 'Oops...', text: 'Erro ao verificar duplicidade.' });
                return;
            }
        }
        
        const isAssistido = formElements.assistido.value === 'sim';
        const filmeData = {
            titulo: tituloValue.trim(),     
            ano: parseInt(formElements.ano.value, 10) || null,
            nota: parseFloat(formElements.nota.value) || 0,
            direcao: parseCSV(formElements.direcao.value),
            atores: parseCSV(formElements.atores.value),
            genero: [...generosSelecionadosAtualmente],
            origem: formElements.origem.value || "", // Salva "" se for "Selecione"
            assistido: isAssistido,
            dataAssistido: isAssistido ? formElements.dataAssistido.value : null,
        };

        try {
            if (filmeEmEdicao) {
                const docRef = getUserFilmeDoc(filmeEmEdicao);
                await updateDoc(docRef, filmeData);
                showToast('Filme atualizado!');
            } else {
                filmeData.cadastradoEm = serverTimestamp();
                await addDoc(colRef, filmeData);
                showToast('Filme salvo!');
            }
            formElements.form.reset();
            generosSelecionadosAtualmente = [];
            renderizarTags();
            filmeEmEdicao = null;
            
            formElements.assistido.value = ""; 
            formElements.origem.value = "";
            formElements.dataAssistido.removeAttribute('required');
            dataAssistidoGroup.style.display = 'none';
            
        } catch (error) {
            console.error("Erro ao salvar filme:", error);
            Swal.fire({ icon: 'error', title: 'Oops...', text: 'Erro ao salvar o filme.' });
        }
    };

    const prepararEdicao = (id) => {
        const filme = filmes.find(f => f.id === id);
        if (!filme) return;

        filmeEmEdicao = id;
        formElements.titulo.value = filme.titulo;
        formElements.ano.value = filme.ano;
        formElements.nota.value = filme.nota;
        formElements.direcao.value = filme.direcao?.join(', ') || '';
        formElements.atores.value = filme.atores?.join(', ') || '';
        
        generosSelecionadosAtualmente = filme.genero ? [...filme.genero] : [];
        renderizarTags();

        formElements.origem.value = filme.origem || ""; 
        formElements.assistido.value = filme.assistido ? 'sim' : 'nao';
        formElements.assistido.dispatchEvent(new Event('change')); 
        if (filme.assistido) {
            formElements.dataAssistido.value = filme.dataAssistido;
        }
        window.scrollTo({ top: 0, behavior: 'smooth' });
        formElements.titulo.focus();
        formElements.form.classList.remove('was-validated');
    };

    const deletarFilme = async (id) => {
        const docRef = getUserFilmeDoc(id);
        if (!docRef) return;
        const result = await Swal.fire({
            title: 'Tem certeza?', text: "Esta ação não pode ser revertida!", icon: 'warning',
            showCancelButton: true, confirmButtonColor: '#3085d6', cancelButtonColor: '#d33',
            confirmButtonText: 'Sim, excluir!', cancelButtonText: 'Cancelar'
        });
        if (result.isConfirmed) {
            try {
                await deleteDoc(docRef);
                showToast('Filme excluído!');
            } catch (error) {
                console.error("Erro ao excluir filme:", error);
                Swal.fire({ icon: 'error', title: 'Oops...', text: 'Erro ao excluir o filme.' });
            }
        }
    };

    // === FUNÇÃO RESTAURADA ===
    const sugerirFilmeAleatorio = () => {
        const filmesNaoAssistidos = filmes.filter(filme => !filme.assistido);
    
        if (filmesNaoAssistidos.length === 0) {
            Swal.fire({
                icon: 'info',
                title: 'Tudo em dia!',
                text: 'Você já assistiu a todos os filmes da sua lista. Adicione novos filmes para receber sugestões.'
            });
            return;
        }
    
        const indiceAleatorio = Math.floor(Math.random() * filmesNaoAssistidos.length);
        const filmeSugerido = filmesNaoAssistidos[indiceAleatorio];
    
        Swal.fire({
            title: 'Que tal assistir...',
            iconHtml: '<i class="fas fa-film"></i>', 
            html: `
                <div class="suggestion-layout">
                    <div class="suggestion-main-info">
                        <h2 class="suggestion-title">${filmeSugerido.titulo}</h2>
                        <p><strong>Ano:</strong> ${filmeSugerido.ano || 'N/A'}</p>
                        <p><strong>Direção:</strong> ${filmeSugerido.direcao?.join(', ') || 'N/A'}</p>
                    </div>
                    <div class="suggestion-side-info">
                        <div class="suggestion-note">
                            <i class="fas fa-star" aria-hidden="true"></i>
                            <span>${filmeSugerido.nota ? filmeSugerido.nota.toFixed(1) : 'N/A'}</span>
                        </div>
                        <div class="suggestion-genres">
                            ${filmeSugerido.genero?.map(g => `<span class="tag-pill">${g}</span>`).join('') || '<span class="text-muted">Nenhum gênero</span>'}
                        </div>
                    </div>
                </div>
            `,
            showCancelButton: true,
            confirmButtonText: 'Ótima ideia!',
            cancelButtonText: 'Sugerir outro',
            showDenyButton: true, 
            denyButtonText: '<i class="fas fa-check-circle me-1"></i> Marcar como assistido',
            customClass: {
                container: 'suggestion-swal-container',
                popup: 'suggestion-swal-popup',
                confirmButton: 'suggestion-confirm-btn',
                cancelButton: 'suggestion-cancel-btn',
                denyButton: 'suggestion-deny-btn'
            }
        }).then(async (result) => {
            if (result.isConfirmed) {
                // O usuário gostou da ideia, não fazemos nada.
            } else if (result.isDismissed && result.dismiss === Swal.DismissReason.cancel) {
                sugerirFilmeAleatorio();
            } else if (result.isDenied) {
                try {
                    const filmeRef = getUserFilmeDoc(filmeSugerido.id); 
                    if (!filmeRef) return; 
                    
                    await updateDoc(filmeRef, {
                        assistido: true,
                        dataAssistido: new Date().toISOString().slice(0, 10)
                    });
                    showToast('Filme marcado como assistido!');
                    
                } catch (error) {
                    console.error("Erro ao marcar como assistido:", error);
                    Swal.fire('Erro!', 'Não foi possível atualizar o filme.', 'error');
                }
            }
        });
    };

    // --- FUNÇÕES DE RENDERIZAÇÃO, ESTATÍSTICAS E GRÁFICOS ---
    
    function renderizarTabela(listaDeFilmes, containerId) {
        // ... (Corpo da função intacto)
        const container = document.getElementById(containerId);
        if (!container) return;
        if (listaDeFilmes.length === 0) {
            container.innerHTML = '<p class="text-center text-muted pt-3">Nenhum filme encontrado.</p>';
            return;
        }
        const getSortIndicator = col => sortBy === col ? (sortDirection === 'asc' ? ' <i class="fas fa-sort-up"></i>' : ' <i class="fas fa-sort-down"></i>') : '';
        const rows = listaDeFilmes.map((filme, index) => `
            <tr data-id="${filme.id}">
                <td class="col-num">${index + 1}</td>
                <td class="col-titulo">${filme.titulo || 'N/A'}</td>
                <td class="col-nota">⭐ ${(filme.nota || 0).toFixed(1)}</td>
                <td class="col-ano">${filme.ano || '-'}</td>
                <td class="col-direcao">${filme.direcao?.join(', ') || ''}</td>
                <td class="col-atores">${filme.atores?.join(', ') || ''}</td>
                <td class="col-genero">${filme.genero?.join(', ') || ''}</td>
                <td class="col-assistido">${filme.assistido ? 'Sim' : 'Não'}</td>
                <td class="col-data">${filme.assistido && filme.dataAssistido ? new Date(filme.dataAssistido.replace(/-/g, '/')).toLocaleDateString('pt-BR') : '-'}</td>
                <td class="col-origem">${filme.origem || '-'}</td>
                <td class="col-acoes"><div class="action-buttons"><button class="btn btn-sm btn-info btn-edit">Editar</button><button class="btn btn-sm btn-danger btn-delete">Excluir</button></div></td>
            </tr>`).join('');
        container.innerHTML = `
            <table class="table table-dark table-striped table-hover table-sm tabela-filmes">
                <thead><tr><th class="col-num">#</th><th class="col-titulo sortable" data-sort="titulo">Título${getSortIndicator('titulo')}</th><th class="col-nota sortable" data-sort="nota">Nota${getSortIndicator('nota')}</th><th class="col-ano sortable" data-sort="ano">Ano${getSortIndicator('ano')}</th><th>Direção</th><th>Atores</th><th>Gênero</th><th>Assistido?</th><th>Data</th><th>Origem</th><th>Ações</th></tr></thead>
                <tbody>${rows}</tbody>
            </table>`;
        ativarArrastarParaRolar(`#${containerId}`);
    }
    
    function criarRanking(listaDeFilmes, campo) {
        // ... (Corpo da função intacto)
        const contagem = listaDeFilmes.flatMap(f => f[campo] || []).reduce((acc, item) => {
            if (item) acc[item] = (acc[item] || 0) + 1;
            return acc;
        }, {});
        return Object.entries(contagem).sort(([, a], [, b]) => b - a).slice(0, 10);
    };

    function renderizarRanking(elementId, ranking) {
        // ... (Corpo da função intacto)
        const ul = document.getElementById(elementId);
        ul.innerHTML = ranking.length > 0
            ? ranking.map(([nome, qtd]) => `<li class="list-group-item">${nome}<span class="ranking-count">${qtd}</span></li>`).join('')
            : '<li class="list-group-item">N/A</li>';
    };

    function atualizarEstatisticas(listaDeFilmes) {
        // ... (Corpo da função intacto)
        const statTitleH2 = document.querySelector('#estatisticas-section h2');
        const totalGlobalAssistidos = filmes.filter(f => f.assistido).length;
        const totalFiltrado = listaDeFilmes.length;
        const isFiltered = totalGlobalAssistidos !== totalFiltrado || (filterElements.busca.value || filterElements.genero.value || filterElements.diretor.value || filterElements.ator.value || filterElements.ano.value !== 'todos' || filterElements.origem.value !== 'todos' || filterElements.assistido.value !== 'todos');
        if (statTitleH2) {
             statTitleH2.innerHTML = isFiltered ? `<i class="fas fa-filter me-2"></i> Estatísticas do Filtro (${totalFiltrado} de ${totalGlobalAssistidos} assistidos)` : `<i class="fas fa-chart-bar me-2"></i> Estatísticas dos Filmes Assistidos`;
        }
        const totalFilmes = listaDeFilmes.length;
        if (totalFilmes === 0) {
            ['stat-total-filmes', 'stat-media-notas', 'stat-melhor-filme', 'stat-pior-filme', 'stat-decada-popular', 'stat-ator-frequente', 'stat-pct-nacionais', 'stat-pct-internacionais'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.innerText = id.includes('pct') ? '0%' : (id.includes('media') ? '0.0' : (id.includes('total') ? '0' : '-'));
            });
            ['ranking-generos', 'ranking-atores', 'ranking-diretores', 'ranking-anos'].forEach(id => {
                const el = document.getElementById(id);
                if (el) renderizarRanking(id, []);
            });
            return;
        }
        const mediaNotas = (listaDeFilmes.reduce((acc, f) => acc + (f.nota || 0), 0) / totalFilmes).toFixed(1);
        document.getElementById('stat-total-filmes').innerText = totalFilmes;
        document.getElementById('stat-media-notas').innerText = mediaNotas;
        if (document.getElementById('stat-media-notas-grafico')) document.getElementById('stat-media-notas-grafico').innerText = mediaNotas;
        const melhorFilme = listaDeFilmes.reduce((p, c) => (p.nota || 0) > (c.nota || 0) ? p : c);
        document.getElementById('stat-melhor-filme').innerText = melhorFilme.titulo;
        const piorFilme = listaDeFilmes.reduce((p, c) => (p.nota || 10) < (c.nota || 10) ? p : c);
        document.getElementById('stat-pior-filme').innerText = piorFilme.titulo;
        const nacionais = listaDeFilmes.filter(f => f.origem === 'Nacional').length;
        document.getElementById('stat-pct-nacionais').innerText = `${Math.round((nacionais / totalFilmes) * 100)}%`;
        document.getElementById('stat-pct-internacionais').innerText = `${Math.round(((totalFilmes - nacionais) / totalFilmes) * 100)}%`;
        const decadas = listaDeFilmes.reduce((acc, f) => { if(f.ano) { const decada = Math.floor(f.ano / 10) * 10; acc[decada] = (acc[decada] || 0) + 1; } return acc; }, {});
        const decadaPopular = Object.keys(decadas).length ? Object.entries(decadas).sort(([,a],[,b]) => b-a)[0][0] : '-';
        document.getElementById('stat-decada-popular').innerText = decadaPopular !== '-' ? `Anos ${decadaPopular}` : '-';
        const rankingAtores = criarRanking(listaDeFilmes, 'atores');
        document.getElementById('stat-ator-frequente').innerText = rankingAtores.length ? rankingAtores[0][0] : '-';
        renderizarRanking('ranking-generos', criarRanking(listaDeFilmes, 'genero'));
        renderizarRanking('ranking-atores', rankingAtores);
        renderizarRanking('ranking-diretores', criarRanking(listaDeFilmes, 'direcao'));
        const anos = listaDeFilmes.reduce((acc, f) => { if(f.ano) acc[f.ano] = (acc[f.ano] || 0) + 1; return acc; }, {});
        renderizarRanking('ranking-anos', Object.entries(anos).sort(([,a],[,b]) => b-a).slice(0,10));
    }
    
    // === FUNÇÕES DE GRÁFICOS RESTAURADAS ===
    function renderizarGraficos(listaDeFilmes) {
        Object.values(charts).forEach(chart => chart?.destroy());
        const isDarkMode = body.classList.contains('dark-mode');
        Chart.defaults.color = isDarkMode ? 'rgba(226, 232, 240, 0.8)' : 'rgba(0, 0, 0, 0.7)';
        Chart.defaults.borderColor = isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';
        if (listaDeFilmes.length === 0) return;
        renderizarGraficoGeneros(listaDeFilmes);
        renderizarGraficoAnos(listaDeFilmes);
        renderizarGraficoNotas(listaDeFilmes);
        renderizarGraficoOrigem(listaDeFilmes);
        renderizarGraficoMediaNotasPorAno(listaDeFilmes);
        renderizarGraficoAssistidosPorMes(listaDeFilmes);
        renderizarGraficoDiretores(listaDeFilmes);
    }
    
    function renderizarGraficoGeneros(listaDeFilmes) {
        const ctx = document.getElementById('generosChart')?.getContext('2d');
        if (!ctx) return;
        const topGeneros = criarRanking(listaDeFilmes, 'genero').slice(0, 5);
        if (topGeneros.length > 0) {
            charts.generos = new Chart(ctx, { type: 'doughnut', data: { labels: topGeneros.map(item => item[0]), datasets: [{ label: 'Filmes', data: topGeneros.map(item => item[1]), backgroundColor: ['#a855f7', '#3b82f6', '#ec4899', '#f97316', '#14b8a6'], borderWidth: 0 }] }, options: { responsive: true, maintainAspectRatio: false } });
        }
    }
    
    function renderizarGraficoAnos(listaDeFilmes) {
        const ctx = document.getElementById('anosChart')?.getContext('2d');
        if (!ctx) return;
        const contagemAnos = listaDeFilmes.reduce((acc, f) => { if(f.ano) acc[f.ano] = (acc[f.ano] || 0) + 1; return acc; }, {});
        const top10Anos = Object.entries(contagemAnos).sort(([a], [b]) => b - a).slice(0, 10).reverse();
        if (top10Anos.length > 0) {
            charts.anos = new Chart(ctx, { type: 'bar', data: { labels: top10Anos.map(item => item[0]), datasets: [{ label: 'Qtd. de Filmes', data: top10Anos.map(item => item[1]), backgroundColor: 'rgba(59, 130, 246, 0.7)' }] }, options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false } });
        }
    }
    
    function renderizarGraficoNotas(listaDeFilmes) {
        const ctx = document.getElementById('notasChart')?.getContext('2d');
        if (!ctx) return;
        const contagemNotas = listaDeFilmes.reduce((acc, f) => { if (f.nota != null) { const nota = Math.round(f.nota); acc[nota] = (acc[nota] || 0) + 1; } return acc; }, {});
        const notasLabels = Object.keys(contagemNotas).sort((a,b) => a-b);
        const notasData = notasLabels.map(label => contagemNotas[label]);
        if (notasLabels.length > 0) {
            charts.notas = new Chart(ctx, { type: 'line', data: { labels: notasLabels, datasets: [{ label: 'Distribuição de Notas', data: notasData, borderColor: '#ec4899', tension: 0.3, fill: true, backgroundColor: 'rgba(236, 72, 153, 0.2)' }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { title: { display: true, text: 'Quantidade de Filmes' } }, x: { title: { display: true, text: 'Nota' } } } } });
        }
    }
    
    function renderizarGraficoOrigem(listaDeFilmes) {
        const ctx = document.getElementById('origemChart')?.getContext('2d');
        if (!ctx) return;
        const contagemOrigem = listaDeFilmes.reduce((acc, filme) => { if (filme.origem) acc[filme.origem] = (acc[filme.origem] || 0) + 1; return acc; }, {});
        if (Object.keys(contagemOrigem).length > 0) {
            charts.origem = new Chart(ctx, { type: 'pie', data: { labels: Object.keys(contagemOrigem), datasets: [{ label: 'Origem', data: Object.values(contagemOrigem), backgroundColor: ['#3b82f6', '#14b8a6'], borderWidth: 0 }] }, options: { responsive: true, maintainAspectRatio: false } });
        }
    }
    
    function renderizarGraficoMediaNotasPorAno(listaDeFilmes) {
        const ctx = document.getElementById('mediaNotasAnoChart')?.getContext('2d');
        if (!ctx) return;
        const notasPorAno = listaDeFilmes.reduce((acc, filme) => { if (filme.ano && filme.nota != null) { if (!acc[filme.ano]) acc[filme.ano] = { total: 0, count: 0 }; acc[filme.ano].total += filme.nota; acc[filme.ano].count++; } return acc; }, {});
        const labels = Object.keys(notasPorAno).sort((a, b) => a - b);
        if (labels.length > 0) {
            const data = labels.map(ano => (notasPorAno[ano].total / notasPorAno[ano].count).toFixed(1));
            charts.mediaNotasAno = new Chart(ctx, { type: 'line', data: { labels: labels, datasets: [{ label: 'Média de Notas', data: data, borderColor: '#f97316', backgroundColor: 'rgba(249, 115, 22, 0.2)', fill: true, tension: 0.3 }] }, options: { responsive: true, maintainAspectRatio: false } });
        }
    }
    
    function renderizarGraficoAssistidosPorMes(listaDeFilmes) {
        const ctx = document.getElementById('assistidosMesChart')?.getContext('2d');
        if (!ctx) return;
        const contagemMes = {};
        const meses = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
        const hoje = new Date();
        for (let i = 11; i >= 0; i--) { let d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1); let chave = `${meses[d.getMonth()]}/${String(d.getFullYear()).slice(-2)}`; contagemMes[chave] = 0; }
        listaDeFilmes.forEach(filme => { if (filme.assistido && filme.dataAssistido) { const dataAssistido = new Date(filme.dataAssistido); const chave = `${meses[dataAssistido.getMonth()]}/${String(dataAssistido.getFullYear()).slice(-2)}`; if (contagemMes.hasOwnProperty(chave)) contagemMes[chave]++; } });
        charts.assistidosMes = new Chart(ctx, { type: 'bar', data: { labels: Object.keys(contagemMes), datasets: [{ label: 'Qtd. de Filmes Assistidos', data: Object.values(contagemMes), backgroundColor: 'rgba(168, 85, 247, 0.7)' }] }, options: { responsive: true, maintainAspectRatio: false } });
    }
    
    function renderizarGraficoDiretores(listaDeFilmes) {
        const ctx = document.getElementById('diretoresChart')?.getContext('2d');
        if (!ctx) return;
        const top5Diretores = criarRanking(listaDeFilmes, 'direcao').slice(0, 5);
        if (top5Diretores.length > 0) {
            charts.diretores = new Chart(ctx, { type: 'bar', data: { labels: top5Diretores.map(item => item[0]), datasets: [{ label: 'Qtd. de Filmes', data: top5Diretores.map(item => item[1]), backgroundColor: 'rgba(236, 72, 153, 0.7)' }] }, options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false } });
        }
    }

    // --- FUNÇÕES DE IMPORTAÇÃO/EXPORTAÇÃO (RESTAURADAS) ---
    const obterDataFormatada = () => new Date().toISOString().slice(0, 10);
    
    const baixarArquivo = (conteudo, nomeArquivo, tipoConteudo) => { 
        const a = document.createElement("a"); 
        const arquivo = new Blob([conteudo], { type: tipoConteudo }); 
        a.href = URL.createObjectURL(arquivo); 
        a.download = nomeArquivo; a.click(); 
        URL.revokeObjectURL(a.href); 
    };
    
    const exportarParaJSON = () => { 
        const filmesFiltrados = aplicarFiltrosEordenacao(filmes); 
        if (filmesFiltrados.length === 0) return Swal.fire('Atenção', 'Não há filmes na lista para exportar.', 'warning'); 
        baixarArquivo(JSON.stringify(filmesFiltrados, null, 2), `meus_filmes_${obterDataFormatada()}.json`, 'application/json'); 
        showToast('Lista exportada para JSON!'); 
    };
    
    const exportarParaCSV = () => { 
        const filmesFiltrados = aplicarFiltrosEordenacao(filmes); 
        if (filmesFiltrados.length === 0) return Swal.fire('Atenção', 'Não há filmes na lista para exportar.', 'warning'); 
        const cabecalho = ['titulo', 'ano', 'nota', 'direcao', 'atores', 'genero', 'origem', 'assistido', 'dataAssistido']; 
        const formatarValorCSV = v => { let s=String(v==null?'':v); if(s.includes(',')){s='"'+s.replace(/"/g,'""')+'"'} return s; }; 
        const linhas = filmesFiltrados.map(f => cabecalho.map(c => formatarValorCSV(Array.isArray(f[c])?f[c].join('; '):f[c])).join(',')); 
        baixarArquivo([cabecalho.join(','), ...linhas].join('\n'), `meus_filmes_${obterDataFormatada()}.csv`, 'text/csv;charset=utf-8;'); 
        showToast('Lista exportada para CSV!'); 
    };
    
    const importarDeArquivo = (event) => {
        if (!currentUserId) {
            Swal.fire('Erro!', 'Você precisa estar logado para importar filmes.', 'error');
            return;
        }
        const arquivo = event.target.files[0]; 
        if (!arquivo) return; 
        const reader = new FileReader(); 
        reader.onload = async (e) => { 
            let filmesImportados = []; 
            try { 
                if (arquivo.name.endsWith('.json')) filmesImportados = JSON.parse(e.target.result); 
                else if (arquivo.name.endsWith('.csv')) { const linhas = e.target.result.split(/\r?\n/).filter(l => l.trim()); const cabecalho = linhas.shift().split(','); filmesImportados = linhas.map(linha => { const valores = linha.split(','); return cabecalho.reduce((obj, chave, i) => { const valor = valores[i]; if (['atores', 'direcao', 'genero'].includes(chave) && valor) obj[chave] = valor.split(';').map(s => s.trim()); else if (chave === 'assistido') obj[chave] = ['true', 'sim'].includes(valor.toLowerCase()); else if (['ano', 'nota'].includes(chave) && valor) obj[chave] = Number(valor); else obj[chave] = valor; return obj; }, {}); }); } 
                else throw new Error("Formato de arquivo não suportado."); 
                
                await processarFilmesImportados(filmesImportados); 
            
            } catch (error) { Swal.fire('Erro!', `Não foi possível processar o arquivo: ${error.message}`, 'error'); } 
            event.target.value = ''; 
        }; 
        reader.readAsText(arquivo); 
    };
    
    const processarFilmesImportados = async (filmesImportados) => { 
        if (!Array.isArray(filmesImportados) || filmesImportados.length === 0) return Swal.fire('Atenção', 'Nenhum filme válido encontrado.', 'warning'); 
        
        const colRef = getUserFilmesCollection();
        if (!colRef) return;
        
        const titulosExistentes = new Set(filmes.map(f => f.titulo.toLowerCase())); 
        const filmesParaAdicionar = filmesImportados.filter(f => f.titulo && !titulosExistentes.has(f.titulo.toLowerCase())); 
        const numNovos = filmesParaAdicionar.length, numDuplicados = filmesImportados.length - numNovos; 
        
        if (numNovos === 0) return Swal.fire('Importação Concluída', `Nenhum filme novo para adicionar. ${numDuplicados} filmes duplicados foram ignorados.`, 'info'); 
        
        const { isConfirmed } = await Swal.fire({ title: 'Confirmar Importação', icon: 'question', showCancelButton: true, html: `Encontrados <b>${numNovos}</b> novos filmes para adicionar.<br>${numDuplicados} duplicados foram ignorados.<br>Deseja continuar?`, confirmButtonText: 'Sim, importar!', cancelButtonText: 'Cancelar' }); 
        
        if (isConfirmed) { 
            try { 
                const { writeBatch } = await import("https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js"); 
                const batch = writeBatch(db); 
                
                filmesParaAdicionar.forEach(filme => { 
                    const docRef = doc(colRef); 
                    batch.set(docRef, { ...filme, cadastradoEm: serverTimestamp(), assistido: filme.assistido || false, nota: filme.nota || 0 }); 
                }); 
                
                await batch.commit(); 
                showToast(`${numNovos} filmes importados com sucesso!`); 
                 
            } catch(error) { Swal.fire('Erro!', 'Ocorreu um erro ao salvar os filmes importados.', 'error'); } 
        } 
    };
    
    // --- FUNÇÕES DE VALIDAÇÃO DE NICKNAME (INTACTO) ---
    function setNicknameValidationUI(state, message = '') {
        const loading = document.getElementById('nickname-loading');
        const success = document.getElementById('nickname-success');
        const error = document.getElementById('nickname-error');
        const input = document.getElementById('register-nickname');
        const feedback = document.getElementById('nickname-invalid-feedback');
        loading.style.display = 'none';
        success.style.display = 'none';
        error.style.display = 'none';
        input.classList.remove('is-valid', 'is-invalid');
        if (state === 'loading') {
            loading.style.display = 'block';
        } else if (state === 'success') {
            success.style.display = 'block';
            input.classList.add('is-valid');
        } else if (state === 'error') {
            error.style.display = 'block';
            input.classList.add('is-invalid');
            feedback.textContent = message; 
        }
    }
    async function checkNicknameAvailability() {
        const input = document.getElementById('register-nickname');
        const nickname = input.value.trim().toLowerCase();
        lastCheckedNickname = nickname; 
        if (nickname.length < 4) {
            setNicknameValidationUI('error', 'Nickname deve ter pelo menos 4 caracteres.');
            isNicknameValid = false;
            return;
        }
        if (/\s/.test(nickname)) {
            setNicknameValidationUI('error', 'Nickname não pode conter espaços.');
            isNicknameValid = false;
            return;
        }
        setNicknameValidationUI('loading'); 
        try {
            const q = query(collection(db, "users"), where("nickname", "==", nickname));
            const querySnapshot = await getDocs(q);
            if (querySnapshot.empty) {
                setNicknameValidationUI('success');
                isNicknameValid = true;
            } else {
                setNicknameValidationUI('error', 'Este nickname já está em uso.');
                isNicknameValid = false;
            }
        } catch (error) {
            console.error("Erro ao checar nickname:", error);
            setNicknameValidationUI('error', 'Erro ao verificar. Tente novamente.');
            isNicknameValid = false;
        }
    }


    // --- EVENT LISTENERS ---
    function setupEventListeners() {
        // --- LISTENERS DE AUTENTICAÇÃO ---
        loginForm.addEventListener('submit', handleLogin);
        registerForm.addEventListener('submit', handleRegister);
        logoutBtn.addEventListener('click', handleLogout);

        document.getElementById('register-nickname').addEventListener('input', () => {
            clearTimeout(nicknameCheckTimer);
            const nickname = document.getElementById('register-nickname').value;
            if (nickname.length < 4) {
                 setNicknameValidationUI('idle'); 
                 isNicknameValid = false;
            }
            nicknameCheckTimer = setTimeout(() => {
                if (nickname.length >= 4 && nickname !== lastCheckedNickname) {
                    checkNicknameAvailability();
                }
            }, 500); 
        });


        showRegisterLink.addEventListener('click', (e) => {
            e.preventDefault();
            loginCard.style.display = 'none';
            registerCard.style.display = 'block';
        });
        showLoginLink.addEventListener('click', (e) => {
            e.preventDefault();
            loginCard.style.display = 'block';
            registerCard.style.display = 'none';
        });

        // --- LISTENERS DO TEMA (INTACTO) ---
        const temaSalvo = localStorage.getItem('theme') || 'dark';
        body.classList.toggle('dark-mode', temaSalvo === 'dark');
        themeToggleBtn.innerHTML = temaSalvo === 'dark' ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
        themeToggleBtn.addEventListener('click', () => {
            const isDark = body.classList.toggle('dark-mode');
            localStorage.setItem('theme', isDark ? 'dark' : 'light');
            themeToggleBtn.innerHTML = isDark ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
            atualizarUI();
        });

        // --- NOVO: LISTENER DO BOTÃO DE REDEFINIR SENHA ---
        document.getElementById('perfil-trocar-senha-btn').addEventListener('click', async () => {
            if (!currentUserProfile || !currentUserProfile.email) {
                Swal.fire({ icon: 'error', title: 'Erro', text: 'Não foi possível encontrar seu e-mail de cadastro.' });
                return;
            }
            
            try {
                await sendPasswordResetEmail(auth, currentUserProfile.email);
                Swal.fire({
                    icon: 'success',
                    title: 'E-mail Enviado!',
                    text: `Enviamos um link de redefinição de senha para ${currentUserProfile.email}.`
                });
            } catch (error) {
                console.error("Erro ao enviar e-mail de redefinição de senha:", error);
                Swal.fire({ icon: 'error', title: 'Oops...', text: 'Não foi possível enviar o e-mail. Tente novamente mais tarde.' });
            }
        });


        // --- LISTENERS DO APP (INTACTO) ---
        document.getElementById('export-json-btn').addEventListener('click', exportarParaJSON);
        document.getElementById('export-csv-btn').addEventListener('click', exportarParaCSV);
        document.getElementById('import-btn').addEventListener('click', () => document.getElementById('import-file-input').click());
        document.getElementById('import-file-input').addEventListener('change', importarDeArquivo);
        document.getElementById('sugerir-filme-btn').addEventListener('click', sugerirFilmeAleatorio);

        formElements.form.addEventListener('submit', (event) => {
            event.preventDefault();
            event.stopPropagation();
            const tituloValue = formElements.titulo.value.trim();
            if (!formElements.form.checkValidity()) {
                // (não faz nada, mostra erros)
            } else {
                salvarFilme(event, tituloValue);
                formElements.form.classList.remove('was-validated');
                return;
            }
            formElements.form.classList.add('was-validated');
        });

        formElements.assistido.addEventListener('change', () => {
            const isSim = formElements.assistido.value === 'sim';
            dataAssistidoGroup.style.display = isSim ? 'block' : 'none';
            if (isSim) {
                formElements.dataAssistido.setAttribute('required', 'required');
            } else {
                formElements.dataAssistido.removeAttribute('required');
                formElements.dataAssistido.value = ''; 
            }
        });

        filterElements.container.addEventListener('input', () => atualizarUI());
        filterElements.limparBtn.addEventListener('click', () => {
            filterElements.container.querySelectorAll('input, select').forEach(el => el.value = el.tagName === 'SELECT' ? 'todos' : '');
            atualizarUI();
        });
        document.getElementById('filmesTabContent').addEventListener('click', (event) => {
            const target = event.target;
            const header = target.closest('th.sortable');
            const editBtn = target.closest('.btn-edit');
            const deleteBtn = target.closest('.btn-delete');
            if (header) {
                const column = header.dataset.sort;
                sortDirection = sortBy === column && sortDirection === 'asc' ? 'desc' : 'asc';
                sortBy = column;
                atualizarUI();
            } else if (editBtn) prepararEdicao(editBtn.closest('tr').dataset.id);
            else if (deleteBtn) deletarFilme(deleteBtn.closest('tr').dataset.id);
        });

        generoTagContainer.addEventListener('click', () => {
            generoInput.focus();
        });
        generoInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                adicionarTag(generoInput.value);
            } else if (e.key === 'Backspace' && generoInput.value === '') {
                if (generosSelecionadosAtualmente.length > 0) {
                    removerTag(generosSelecionadosAtualmente[generosSelecionadosAtualmente.length - 1]);
                }
            }
        });
        generoInput.addEventListener('input', () => {
            if (GENEROS_PREDEFINIDOS.includes(generoInput.value)) {
                adicionarTag(generoInput.value);
            }
        });
    };

    // --- INICIALIZAÇÃO ---
    popularSugestoesDeGenero();
    setupEventListeners();
    // A função onAuthStateChanged vai cuidar de chamar carregarFilmes() no momento certo.
});