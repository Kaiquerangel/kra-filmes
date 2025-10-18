// Aguarda o DOM carregar e importa dinamicamente as funções de auth
document.addEventListener('DOMContentLoaded', async () => {
    
    // --- CONFIGURAÇÃO FIREBASE ---
    const { createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut } = await import("https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js");
    const { auth } = window.firebaseApp;
    const { db, collection, addDoc, getDocs, doc, updateDoc, deleteDoc, serverTimestamp, query, orderBy, where } = window.db;

    // --- ESTADO DA APLICAÇÃO ---
    let currentUserId = null; // Armazena o ID do usuário logado
    let filmes = [];
    let filmeEmEdicao = null;
    let charts = {};
    let sortBy = 'cadastradoEm';
    let sortDirection = 'asc';
    let generosSelecionadosAtualmente = [];

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

    const handleLogin = (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        
        signInWithEmailAndPassword(auth, email, password)
            .then((userCredential) => {
                // Sucesso, o onAuthStateChanged vai lidar com a UI
            })
            .catch((error) => {
                console.error("Erro no login:", error.message);
                Swal.fire({ icon: 'error', title: 'Erro no Login', text: 'Email ou senha inválidos. Por favor, tente novamente.' });
            });
    };

    const handleRegister = (e) => {
        e.preventDefault();
        const email = document.getElementById('register-email').value;
        const password = document.getElementById('register-password').value;

        if (password.length < 6) {
             Swal.fire({ icon: 'warning', title: 'Senha Fraca', text: 'Sua senha deve ter pelo menos 6 caracteres.' });
             return;
        }

        createUserWithEmailAndPassword(auth, email, password)
            .then((userCredential) => {
                // Sucesso, o onAuthStateChanged vai lidar com a UI
            })
            .catch((error) => {
                console.error("Erro no cadastro:", error.message);
                if (error.code === 'auth/email-already-in-use') {
                    Swal.fire({ icon: 'error', title: 'Erro no Cadastro', text: 'Este email já está sendo usado por outra conta.' });
                } else {
                    Swal.fire({ icon: 'error', title: 'Erro no Cadastro', text: 'Não foi possível criar sua conta. Tente novamente.' });
                }
            });
    };

    const handleLogout = () => {
        signOut(auth).catch((error) => {
            console.error("Erro no logout:", error);
        });
    };

    // --- "PORTEIRO" DA APLICAÇÃO (Auth State Change) ---
    // Esta é a função central que controla o que é exibido
    onAuthStateChanged(auth, (user) => {
        if (user) {
            // --- USUÁRIO ESTÁ LOGADO ---
            currentUserId = user.uid; // Define o ID do usuário globalmente

            // Mostra o conteúdo do app e esconde o login
            appContent.style.display = 'block';
            logoutContainer.style.display = 'block';
            authContainer.style.display = 'none';
            appNavLinks.forEach(link => link.style.display = 'block'); // Mostra links do app na navbar

            // Carrega os filmes DESTE usuário
            carregarFilmes();

        } else {
            // --- USUÁRIO ESTÁ DESLOGADO ---
            currentUserId = null;
            filmes = []; // Limpa os dados do usuário anterior

            // Mostra o login e esconde o conteúdo do app
            appContent.style.display = 'none';
            logoutContainer.style.display = 'none';
            authContainer.style.display = 'block';
            appNavLinks.forEach(link => link.style.display = 'none'); // Esconde links do app na navbar

            // Garante que o formulário de login seja o padrão
            loginCard.style.display = 'block';
            registerCard.style.display = 'none';
            
            // Limpa a UI (tabelas, gráficos, etc.)
            atualizarUI(); 
        }
    });

    // --- FUNÇÕES AUXILIARES (showToast, parseCSV, etc.) ---
    // (Seu código original, sem mudanças)
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
    
    // --- FUNÇÕES DE TAGS (Seu código original, sem mudanças) ---
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
    // (Seu código original, sem mudanças)
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

    // --- FUNÇÕES CRUD (ATUALIZADAS PARA USAR currentUserId) ---
    
    // Constrói a referência da coleção do usuário
    const getUserFilmesCollection = () => {
        if (!currentUserId) return null;
        return collection(db, "users", currentUserId, "filmes");
    };
    
    // Constrói a referência de um documento de filme do usuário
    const getUserFilmeDoc = (id) => {
         if (!currentUserId) return null;
         return doc(db, "users", currentUserId, "filmes", id);
    }

    const carregarFilmes = async () => {
        const colRef = getUserFilmesCollection();
        if (!colRef) return; // Sai se o usuário não estiver logado

        try {
            const q = query(colRef, orderBy("cadastradoEm", "asc"));
            const querySnapshot = await getDocs(q);
            filmes = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), cadastradoEm: doc.data().cadastradoEm?.toDate() || new Date(0) }));
            popularFiltros(filmes);
            atualizarUI();
        } catch (error) {
            console.error("Erro ao carregar filmes:", error);
            Swal.fire({ icon: 'error', title: 'Oops...', text: 'Não foi possível carregar os filmes.' });
        }
    };

    const salvarFilme = async (event) => {
        event.preventDefault();
        const colRef = getUserFilmesCollection();
        if (!colRef) return; // Sai se o usuário não estiver logado

        const tituloValue = formElements.titulo.value.trim();
        if (!tituloValue) {
            Swal.fire({ icon: 'warning', title: 'Atenção', text: 'O campo "Título" é obrigatório.' });
            return formElements.titulo.focus();
        }
        
        // Verifica duplicidade apenas para filmes novos
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
            titulo: tituloValue,
            ano: parseInt(formElements.ano.value, 10) || null,
            nota: parseFloat(formElements.nota.value) || 0,
            direcao: parseCSV(formElements.direcao.value),
            atores: parseCSV(formElements.atores.value),
            genero: [...generosSelecionadosAtualmente],
            origem: formElements.origem.value,
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
            dataAssistidoGroup.style.display = 'none';
            carregarFilmes(); 
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

        formElements.origem.value = filme.origem;
        formElements.assistido.value = filme.assistido ? 'sim' : 'nao';
        formElements.assistido.dispatchEvent(new Event('change'));
        if (filme.assistido) {
            formElements.dataAssistido.value = filme.dataAssistido;
        }
        window.scrollTo({ top: 0, behavior: 'smooth' });
        formElements.titulo.focus();
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
                carregarFilmes();
            } catch (error) {
                console.error("Erro ao excluir filme:", error);
                Swal.fire({ icon: 'error', title: 'Oops...', text: 'Erro ao excluir o filme.' });
            }
        }
    };

    const sugerirFilmeAleatorio = () => {
        // (Seu código original, sem mudanças)
        const filmesNaoAssistidos = filmes.filter(filme => !filme.assistido);
        if (filmesNaoAssistidos.length === 0) {
            Swal.fire({ icon: 'info', title: 'Tudo em dia!', text: 'Você já assistiu a todos os filmes da sua lista. Adicione novos filmes para receber sugestões.' });
            return;
        }
        const indiceAleatorio = Math.floor(Math.random() * filmesNaoAssistidos.length);
        const filmeSugerido = filmesNaoAssistidos[indiceAleatorio];
        Swal.fire({
            title: 'Que tal assistir...',
            iconHtml: '<i class="fas fa-film"></i>',
            html: `... (seu HTML do modal de sugestão) ...`,
            // ... (resto da sua configuração do Swal) ...
        }).then(async (result) => {
            if (result.isDenied) {
                try {
                    const filmeRef = getUserFilmeDoc(filmeSugerido.id); // ATUALIZADO
                    await updateDoc(filmeRef, {
                        assistido: true,
                        dataAssistido: new Date().toISOString().slice(0, 10)
                    });
                    showToast('Filme marcado como assistido!');
                    carregarFilmes();
                } catch (error) {
                    console.error("Erro ao marcar como assistido:", error);
                    Swal.fire('Erro!', 'Não foi possível atualizar o filme.', 'error');
                }
            }
            // ... (resto da lógica do .then) ...
        });
    };

    // --- FUNÇÕES DE RENDERIZAÇÃO, ESTATÍSTICAS E GRÁFICOS ---

    
    // ... renderizarTabela() ...
    // ... criarRanking() ...
    // ... renderizarRanking() ...
    // ... atualizarEstatisticas() ...
    // ... renderizarGraficos() e todas as sub-funções de gráfico ...
    
    
    function renderizarTabela(listaDeFilmes, containerId) {
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
        const contagem = listaDeFilmes.flatMap(f => f[campo] || []).reduce((acc, item) => {
            if (item) acc[item] = (acc[item] || 0) + 1;
            return acc;
        }, {});
        return Object.entries(contagem).sort(([, a], [, b]) => b - a).slice(0, 10);
    };

    function renderizarRanking(elementId, ranking) {
        const ul = document.getElementById(elementId);
        ul.innerHTML = ranking.length > 0
            ? ranking.map(([nome, qtd]) => `<li class="list-group-item">${nome}<span class="ranking-count">${qtd}</span></li>`).join('')
            : '<li class="list-group-item">N/A</li>';
    };

    function atualizarEstatisticas(listaDeFilmes) {
        const statTitleH2 = document.querySelector('#estatisticas-section h2');
        const totalGlobalAssistidos = filmes.filter(f => f.assistido).length; // Nota: Isso agora é o total do usuário
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

    // --- FUNÇÕES DE IMPORTAÇÃO/EXPORTAÇÃO (Atualizadas) ---
    const obterDataFormatada = () => new Date().toISOString().slice(0, 10);
    const baixarArquivo = (conteudo, nomeArquivo, tipoConteudo) => { const a = document.createElement("a"); const arquivo = new Blob([conteudo], { type: tipoConteudo }); a.href = URL.createObjectURL(arquivo); a.download = nomeArquivo; a.click(); URL.revokeObjectURL(a.href); };
    const exportarParaJSON = () => { const filmesFiltrados = aplicarFiltrosEordenacao(filmes); if (filmesFiltrados.length === 0) return Swal.fire('Atenção', 'Não há filmes na lista para exportar.', 'warning'); baixarArquivo(JSON.stringify(filmesFiltrados, null, 2), `meus_filmes_${obterDataFormatada()}.json`, 'application/json'); showToast('Lista exportada para JSON!'); };
    const exportarParaCSV = () => { const filmesFiltrados = aplicarFiltrosEordenacao(filmes); if (filmesFiltrados.length === 0) return Swal.fire('Atenção', 'Não há filmes na lista para exportar.', 'warning'); const cabecalho = ['titulo', 'ano', 'nota', 'direcao', 'atores', 'genero', 'origem', 'assistido', 'dataAssistido']; const formatarValorCSV = v => { let s=String(v==null?'':v); if(s.includes(',')){s='"'+s.replace(/"/g,'""')+'"'} return s; }; const linhas = filmesFiltrados.map(f => cabecalho.map(c => formatarValorCSV(Array.isArray(f[c])?f[c].join('; '):f[c])).join(',')); baixarArquivo([cabecalho.join(','), ...linhas].join('\n'), `meus_filmes_${obterDataFormatada()}.csv`, 'text/csv;charset=utf-8;'); showToast('Lista exportada para CSV!'); };
    
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
                    const docRef = doc(colRef); // Cria novo doc na coleção do usuário
                    batch.set(docRef, { ...filme, cadastradoEm: serverTimestamp(), assistido: filme.assistido || false, nota: filme.nota || 0 }); 
                }); 
                
                await batch.commit(); 
                showToast(`${numNovos} filmes importados com sucesso!`); 
                carregarFilmes(); 
            } catch(error) { Swal.fire('Erro!', 'Ocorreu um erro ao salvar os filmes importados.', 'error'); } 
        } 
    };

    // --- EVENT LISTENERS ---
    function setupEventListeners() {
        // --- LISTENERS DE AUTENTICAÇÃO ---
        loginForm.addEventListener('submit', handleLogin);
        registerForm.addEventListener('submit', handleRegister);
        logoutBtn.addEventListener('click', handleLogout);

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

        // --- LISTENERS DO TEMA (Seu código original) ---
        const temaSalvo = localStorage.getItem('theme') || 'dark';
        body.classList.toggle('dark-mode', temaSalvo === 'dark');
        themeToggleBtn.innerHTML = temaSalvo === 'dark' ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
        themeToggleBtn.addEventListener('click', () => {
            const isDark = body.classList.toggle('dark-mode');
            localStorage.setItem('theme', isDark ? 'dark' : 'light');
            themeToggleBtn.innerHTML = isDark ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
            atualizarUI();
        });

        // --- LISTENERS DO APP (Seu código original) ---
        document.getElementById('export-json-btn').addEventListener('click', exportarParaJSON);
        document.getElementById('export-csv-btn').addEventListener('click', exportarParaCSV);
        document.getElementById('import-btn').addEventListener('click', () => document.getElementById('import-file-input').click());
        document.getElementById('import-file-input').addEventListener('change', importarDeArquivo);
        document.getElementById('sugerir-filme-btn').addEventListener('click', sugerirFilmeAleatorio);
        
        formElements.form.addEventListener('submit', salvarFilme);
        formElements.assistido.addEventListener('change', () => { dataAssistidoGroup.style.display = formElements.assistido.value === 'sim' ? 'block' : 'none'; });
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