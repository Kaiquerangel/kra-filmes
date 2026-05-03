import { onSnapshot, getDocs, query, collection, limit } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";
import { auth, db, OMDB_API_KEY, TMDB_API_KEY } from './config.js';
window._OMDB_KEY = OMDB_API_KEY;
window._TMDB_KEY = TMDB_API_KEY;

// ── Web Worker: filtros e stats em thread separada ──
let filterWorker = null;
let workerCallbackFiltrar = null;

function initWorker() {
    try {
        filterWorker = new Worker('./workers/filters.worker.js');
        filterWorker.onmessage = (e) => {
            if (e.data.tipo === 'filtrado' && workerCallbackFiltrar) {
                workerCallbackFiltrar(e.data.filmes);
                workerCallbackFiltrar = null;
            }
        };
        filterWorker.onerror = () => { filterWorker = null; }; // fallback gracioso
    } catch(err) {
        filterWorker = null; // browsers sem suporte ou CSP restrito
    }
}

function filtrarComWorker(filmes, filtros, sortBy, sortDir) {
    return new Promise((resolve) => {
        if (!filterWorker) {
            // Fallback: roda na thread principal
            resolve(Filters.aplicar(filmes));
            return;
        }
        workerCallbackFiltrar = resolve;
        // Serializa datas para passar ao worker (não serializa automaticamente)
        const filmesSerializados = filmes.map(f => ({
            ...f,
            cadastradoEm: f.cadastradoEm instanceof Date ? f.cadastradoEm.toISOString() : f.cadastradoEm
        }));
        filterWorker.postMessage({ tipo: 'filtrar', payload: { filmes: filmesSerializados, filtros, sortBy, sortDir } });
    });
}
import { AuthService, MovieService } from './services.js';
import { UI } from './ui.js';
import { Auth } from './auth.js';

import { Filters } from './filters.js';
import { Achievements } from './achievements.js';
import { FormManager } from './form.js';
import { QRManager } from './qr-manager.js';
import { abrirModalIndicar } from './ui/indicar.js';
import { getListas, criarLista, abrirGerenciadorListas, abrirAdicionarALista } from './ui/colecoes.js';
import { verificarNotificacoesConquistas } from './ui/notificacoes-meta.js';
import { mostrarOnboarding } from './ui/onboarding.js';
import { mostrarModalLetterboxd } from './ui/letterboxd.js';
import { mostrarComparacao } from './ui/comparar.js';
import { mostrarModalReavaliacao, salvarReavaliacao } from './ui/historico-notas.js';

let currentUser = null;          
let currentUserProfile = null;   
let unsubscribeFilmes = null;    
let filmes = [];                 
let filmesFiltrados = [];
let listasPersonalizadas = [];        
let isReadOnly = false;

let currentView = 'grid'; 

// Persistência de Ordenação (LocalStorage)
let sortBy = localStorage.getItem('mf_sortBy') || 'cadastradoEm';     
let sortDirection = localStorage.getItem('mf_sortDir') || 'asc';       

let paginaAtual = 1;
const ITENS_POR_PAGINA = 40;
let debounceTimer = null;

// Paginação independente por aba
const paginasPorAba = { todos: 1, assistidos: 1, naoAssistidos: 1, favoritos: 1 };
let abaAtiva = 'todos'; // 'todos' | 'assistidos' | 'naoAssistidos' | 'favoritos' 

document.addEventListener('DOMContentLoaded', () => {
    initWorker();
    const savedTheme = localStorage.getItem('theme') || 'dark';
    UI.applyTheme(savedTheme);

    document.getElementById('theme-toggle')?.addEventListener('click', () => {
        UI.openThemePicker();
    });

    // Evento disparado pelo picker de temas
    document.addEventListener('set-theme', (e) => {
        const tema = e.detail;
        UI.applyTheme(tema);
        localStorage.setItem('theme', tema);
        Swal.close();
        if (filmesFiltrados.length > 0) {
            requestAnimationFrame(() => {
                UI.renderCharts(filmesFiltrados.filter(f => f.assistido));
            });
        }
    });

    const urlParams = new URLSearchParams(window.location.search);
    const publicUser = urlParams.get('u');

    setupAppListeners();
    setupImportExportListeners();
    injetarElementosDinamicos(); // Injeta filtros e abas se faltarem no HTML

    if (publicUser) {
        isReadOnly = true;
        iniciarModoPublico(publicUser);
    } else {
        Auth.init(
            (user) => { 
                currentUser = user; 
                iniciarAplicacao(user); 
            },
            () => { 
                encerrarAplicacao(); 
            }
        );
    }
});

// Injeção de componentes HTML dinâmicos
function injetarElementosDinamicos() {
    // Filtro de Notas
    if (!document.getElementById('filtro-nota-min')) {
        const filterRow = document.querySelector('#filtros-container .row.g-2.mb-2');
        if (filterRow) {
            filterRow.insertAdjacentHTML('beforeend', `
                <div class="col-lg-2 col-md-3">
                    <div class="input-group input-group-sm h-100">
                        <span class="input-group-text bg-transparent border-secondary text-warning"><i class="fas fa-star"></i></span>
                        <input type="number" class="form-control border-secondary bg-transparent text-white" id="filtro-nota-min" placeholder="Min" min="0" max="10" step="0.1">
                        <input type="number" class="form-control border-secondary bg-transparent text-white" id="filtro-nota-max" placeholder="Max" min="0" max="10" step="0.1">
                    </div>
                </div>
            `);
        }
    }

    // Aba Favoritos
    if (!document.getElementById('favoritos-tab')) {
        const tabList = document.getElementById('filmesTab');
        if (tabList) {
            tabList.insertAdjacentHTML('beforeend', `
                <li class="nav-item">
                    <button class="nav-link py-1 px-3 fs-6 text-warning" id="favoritos-tab" data-bs-toggle="tab" data-bs-target="#favoritos-tab-pane" type="button" role="tab">
                        <i class="fas fa-star me-1"></i>Favoritos
                    </button>
                </li>
            `);
        }
        const tabContent = document.getElementById('filmesTabContent');
        if (tabContent) {
            tabContent.insertAdjacentHTML('beforeend', `
                <div class="tab-pane fade" id="favoritos-tab-pane" role="tabpanel" tabindex="0">
                    <div class="table-responsive" id="tabela-favoritos-container">
                        <p class="text-center text-muted pt-3">A carregar...</p>
                    </div>
                </div>
            `);
        }
    }

    // Set do Select Mobile com o LocalStorage
    const mobileSort = document.getElementById('mobile-sort');
    if (mobileSort) {
        const val = `${sortBy}-${sortDirection}`;
        if ([...mobileSort.options].some(o => o.value === val)) {
            mobileSort.value = val;
        }
    }
}

async function iniciarModoPublico(uidOuNickname) {
    try {
        let profile = null;

        // Se parece um UID do Firebase (20+ caracteres alfanuméricos), busca direto por getDoc
        const pareceUid = /^[a-zA-Z0-9]{20,}$/.test(uidOuNickname);
        if (pareceUid) {
            profile = await AuthService.getProfile(uidOuNickname);
        }

        // Fallback: tenta buscar por nickname (links antigos com ?u=nickname)
        if (!profile) {
            profile = await AuthService.getProfileByNickname(uidOuNickname);
        }
        
        if (!profile) {
            UI.alert('Ops!', 'Perfil não encontrado.', 'error');
            setTimeout(() => { 
                window.location.href = window.location.pathname; 
            }, 2000);
            return;
        }
        
        currentUserProfile = profile;
        UI.enableReadOnlyMode(profile);
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
            
            FormManager.init(
                () => currentUser?.uid, 
                () => filmes
            );
            
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
    
    if (unsubscribeFilmes) {
        unsubscribeFilmes();
        unsubscribeFilmes = null;
    }
    
    const container = document.getElementById('tabela-todos-container');
    if (container) {
        container.innerHTML = '';
    }
}

function _processarSnapshotFilmes(docs) {
    filmes = docs.map(doc => {
        const data = doc.data();
        const dataCadastro = (data.cadastradoEm && data.cadastradoEm.toDate)
            ? data.cadastradoEm.toDate()
            : new Date(0);
        return { id: doc.id, ...data, cadastradoEm: dataCadastro };
    });
    filmes.sort((a, b) => a.cadastradoEm - b.cadastradoEm);
    requestAnimationFrame(() => {
        Filters.atualizarExtras(filmes);
        Achievements.verificar(currentUserProfile, filmes);
        _verificarMetasProximas(filmes);
        QRManager.setupShareButton(currentUserProfile);
        refreshUI();
        if (UI.renderVitrines) UI.renderVitrines(filmes);
    });
}

function conectarBancoDeDados(uid) {
    if (unsubscribeFilmes) {
        unsubscribeFilmes();
        unsubscribeFilmes = null;
    }

    UI.renderSkeletons(UI.els.tabelaTodos, currentView, 16);

    const q = query(collection(db, "users", uid, "filmes"), limit(2000));

    // Modo visitante (read-only): usa getDocs (leitura única, sem autenticação necessária)
    if (isReadOnly) {
        getDocs(q)
            .then(snapshot => _processarSnapshotFilmes(snapshot.docs))
            .catch(error => {
                console.error(error);
                UI.toast("Erro ao carregar filmes do perfil público.", "error");
            });
        return;
    }

    // Modo logado: usa onSnapshot para atualizações em tempo real
    let onboardingMostrado = false;
    unsubscribeFilmes = onSnapshot(q, (snapshot) => {
        _processarSnapshotFilmes(snapshot.docs);

        verificarLembreteBackup(currentUserProfile, filmes);

        if (!onboardingMostrado && filmes.length === 0 && currentUserProfile && !currentUserProfile.tourCompleto) {
            onboardingMostrado = true;
            setTimeout(() => mostrarOnboarding(async () => {
                try {
                    const { doc: fsDoc, updateDoc } = await import("https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js");
                    await updateDoc(fsDoc(db, "users", currentUser.uid), { tourCompleto: true });
                } catch(e) {}
            }), 800);
        }
    }, (error) => {
        console.error(error);
        UI.toast("Erro de conexão com o banco de dados.", "error");
    });
}

// ── Backup: lembrete mensal ──────────────────────────────────
function verificarLembreteBackup(perfil, filmes) {
    if (!filmes.length) return;
    const KEY = 'mf_backup_lembrete';
    const ultimo = parseInt(localStorage.getItem(KEY) || '0');
    const agora  = Date.now();
    const UM_MES = 30 * 24 * 60 * 60 * 1000;

    if (agora - ultimo < UM_MES) return;

    // Mostra apenas se tem 10+ filmes
    if (filmes.length < 10) return;

    setTimeout(() => {
        const div = document.createElement('div');
        div.style.cssText = `position:fixed;bottom:24px;left:20px;
            background:rgba(15,23,42,0.96);border:1px solid rgba(251,191,36,0.3);
            border-left:3px solid #fbbf24;border-radius:10px;padding:14px 16px;
            max-width:280px;z-index:9990;box-shadow:0 8px 24px rgba(0,0,0,0.4);
            animation:slideInRight 0.35s ease forwards;`;
        div.innerHTML = `
            <div style="display:flex;align-items:flex-start;gap:10px;">
                <span style="font-size:1.1rem;">💾</span>
                <div style="flex:1;">
                    <div style="font-size:0.78rem;font-weight:600;color:rgba(255,255,255,0.9);margin-bottom:4px;">
                        Lembrete de backup
                    </div>
                    <div style="font-size:0.72rem;color:rgba(255,255,255,0.5);line-height:1.4;margin-bottom:8px;">
                        Você tem ${filmes.length} filmes. Exporte para não perder seus dados.
                    </div>
                    <div style="display:flex;gap:6px;">
                        <button id="backup-agora" style="padding:4px 10px;border-radius:6px;border:none;
                            background:#fbbf24;color:#000;font-size:0.72rem;font-weight:600;cursor:pointer;">
                            Exportar agora
                        </button>
                        <button id="backup-depois" style="padding:4px 10px;border-radius:6px;
                            border:1px solid rgba(255,255,255,0.1);background:transparent;
                            color:rgba(255,255,255,0.4);font-size:0.72rem;cursor:pointer;">
                            Depois
                        </button>
                    </div>
                </div>
                <button onclick="this.closest('div[style]').remove()" style="background:none;border:none;
                    color:rgba(255,255,255,0.25);cursor:pointer;font-size:0.85rem;padding:0;">✕</button>
            </div>`;

        document.body.appendChild(div);

        document.getElementById('backup-agora')?.addEventListener('click', () => {
            document.getElementById('exportar-json-btn')?.click();
            localStorage.setItem(KEY, Date.now().toString());
            div.remove();
        });
        document.getElementById('backup-depois')?.addEventListener('click', () => {
            localStorage.setItem(KEY, Date.now().toString());
            div.remove();
        });

        setTimeout(() => {
            if (div.parentNode) {
                div.style.opacity = '0';
                div.style.transition = 'opacity 0.4s ease';
                setTimeout(() => div.remove(), 400);
            }
        }, 12000);
    }, 3000);
}

function getLista(aba) {
    switch(aba) {
        case 'assistidos':    return filmesFiltrados.filter(f => f.assistido);
        case 'naoAssistidos': return filmesFiltrados.filter(f => !f.assistido);
        case 'favoritos':     return filmesFiltrados.filter(f => f.assistido && (f.nota || 0) >= 8);
        default:              return filmesFiltrados;
    }
}

function refreshUI() {
    filmesFiltrados = Filters.aplicar(filmes);
    filmesFiltrados = Filters.ordenar(filmesFiltrados, sortBy, sortDirection);

    // Reseta páginas de todas as abas ao aplicar filtro
    Object.keys(paginasPorAba).forEach(k => paginasPorAba[k] = 1);

    renderAba(abaAtiva);
    atualizarIndicadoresVisuais();

    // Verifica notificações de meta após atualização
    verificarNotificacoesConquistas(filmes, currentUserProfile);
}

function renderAba(aba) {
    abaAtiva = aba;
    const lista = getLista(aba);
    const pagina = paginasPorAba[aba];
    const inicio = (pagina - 1) * ITENS_POR_PAGINA;
    const fim    = inicio + ITENS_POR_PAGINA;

    // Limpa apenas o container da aba ativa
    const containerMap = {
        todos:        UI.els.tabelaTodos,
        assistidos:   UI.els.tabelaAssistidos,
        naoAssistidos:UI.els.tabelaNaoAssistidos,
        favoritos:    document.getElementById('tabela-favoritos-container')
    };

    const container = containerMap[aba];
    if (container) container.innerHTML = '';

    const lote = lista.slice(inicio, fim);

    // Renderiza só a aba ativa (mais rápido, sem renderizar todas de uma vez)
    const renderFn = currentView === 'table' ? UI.renderTable : UI.renderGrid;
    if (container) renderFn(lote, container, false, filmes.length, inicio);

    // Stats sempre da lista completa filtrada (independente da aba ativa)
    const assistidosTotal = filmesFiltrados.filter(f => f.assistido);
    requestAnimationFrame(() => UI.updateStats(assistidosTotal, filmesFiltrados.length, filmesFiltrados));

    atualizarControlesPaginacao(lista, pagina);
    atualizarContadorAba(lista, aba);
}

// Contador de Resultados e Badge de Filtros
function atualizarContadorAba(lista, aba) {
    const countEl = document.getElementById('info-paginacao-total');
    if (!countEl) return;
    if (filmes.length === 0) { countEl.textContent = '...'; return; }
    const qtd = lista.length;
    const total = filmes.length;
    if (qtd === total) {
        countEl.innerHTML = `<strong class="text-white">${qtd}</strong>`;
    } else {
        countEl.innerHTML = `<strong class="text-white">${qtd}</strong> de ${total}`;
    }
}

function atualizarIndicadoresVisuais() {
    const isFiltered = filmesFiltrados.length !== filmes.length;
    const limparBtn = document.getElementById('limpar-filtros');
    
    if (limparBtn) {
        if (isFiltered) {
            limparBtn.innerHTML = '<i class="fas fa-times me-1"></i>Limpar <span class="badge bg-danger ms-1 rounded-circle" style="font-size:0.6rem; padding: 0.25em 0.4em;">!</span>';
            limparBtn.classList.add('text-danger', 'fw-bold');
        } else {
            limparBtn.innerHTML = '<i class="fas fa-times me-1"></i>Limpar';
            limparBtn.classList.remove('text-danger', 'fw-bold');
        }
    }
    // Contador é atualizado por atualizarContadorAba ao renderizar a aba
}

function atualizarControlesPaginacao(lista, pagAtual) {
    lista    = lista    || getLista(abaAtiva);
    pagAtual = pagAtual || paginasPorAba[abaAtiva];

    const totalPaginas = Math.ceil(lista.length / ITENS_POR_PAGINA) || 1;
    const btnAnt   = document.getElementById('btn-pag-anterior');
    const btnProx  = document.getElementById('btn-pag-proximo');
    const paginasEl = document.getElementById('paginas-numeradas');
    const wrapper  = document.querySelector('.paginacao-wrapper');

    // Esconde paginação se couber numa página só
    if (wrapper) wrapper.style.display = totalPaginas <= 1 ? 'none' : 'flex';

    if (btnAnt) btnAnt.disabled = (pagAtual === 1);
    if (btnProx) btnProx.disabled = (pagAtual >= totalPaginas);

    if (!paginasEl) return;

    const MAX_VISIBLE = 7;
    let paginas = [];

    // Em telas pequenas reduz o número de botões visíveis
    const isMobile = window.innerWidth < 480;
    const maxVis = isMobile ? 5 : MAX_VISIBLE;

    if (totalPaginas <= maxVis) {
        paginas = Array.from({ length: totalPaginas }, (_, i) => i + 1);
    } else {
        paginas.push(1);
        const wing = isMobile ? 1 : 1;
        if (pagAtual > 2 + wing) paginas.push('...');
        const start = Math.max(2, pagAtual - wing);
        const end   = Math.min(totalPaginas - 1, pagAtual + wing);
        for (let p = start; p <= end; p++) paginas.push(p);
        if (pagAtual < totalPaginas - 1 - wing) paginas.push('...');
        paginas.push(totalPaginas);
    }

    paginasEl.innerHTML = paginas.map(p => {
        if (p === '...') return `<span class="pag-ellipsis">…</span>`;
        const isActive = p === pagAtual;
        return `<button class="btn-pag-numero ${isActive ? 'active' : ''}" data-pag="${p}" aria-label="Página ${p}" ${isActive ? 'aria-current="page"' : ''}>${p}</button>`;
    }).join('');

    // Listeners nos botões de página
    paginasEl.querySelectorAll('.btn-pag-numero').forEach(btn => {
        btn.addEventListener('click', () => {
            const p = parseInt(btn.dataset.pag);
            if (p !== paginasPorAba[abaAtiva]) {
                paginasPorAba[abaAtiva] = p;
                document.getElementById('lista-section')?.scrollIntoView({ behavior: 'auto', block: 'start' });
                renderAba(abaAtiva);
            }
        });
    });
}

const TOGGLE_SECTIONS = ['cadastro-section', 'graficos-section', 'perfil-section'];

function toggleSectionSmooth(section) {
    if (!section) return;

    const isHidden = section.style.display === 'none' || !section.style.display;

    if (isHidden) {
        // Fecha as outras seções antes de abrir esta
        TOGGLE_SECTIONS.forEach(id => {
            if (id !== section.id) {
                const other = document.getElementById(id);
                if (other && other.style.display !== 'none') {
                    other.style.opacity = '0';
                    other.style.transform = 'translateY(15px)';
                    other.style.transition = 'opacity 0.2s ease-in, transform 0.2s ease-in';
                    setTimeout(() => { other.style.display = 'none'; }, 200);
                }
            }
        });

        section.style.display = 'block';
        section.style.opacity = '0';
        section.style.transform = 'translateY(15px)';
        section.style.transition = 'opacity 0.3s ease-out, transform 0.3s ease-out';

        requestAnimationFrame(() => {
            section.style.opacity = '1';
            section.style.transform = 'translateY(0)';
        });
        setTimeout(() => section.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
    } else {
        section.style.opacity = '0';
        section.style.transform = 'translateY(15px)';
        section.style.transition = 'opacity 0.3s ease-in, transform 0.3s ease-in';
        setTimeout(() => { section.style.display = 'none'; }, 300);
    }
}

function setupAppListeners() {
    let lastScrollY = window.scrollY;
    let ticking = false;
    const navbar = document.querySelector('.navbar');
    const btnTopo = document.getElementById('btn-voltar-topo');
    
    window.addEventListener('scroll', () => {
        if (!ticking) {
            window.requestAnimationFrame(() => {
                const currentScrollY = window.scrollY;
                if (currentScrollY > lastScrollY && currentScrollY > 80) {
                    navbar?.classList.add('navbar--hidden');
                } else {
                    navbar?.classList.remove('navbar--hidden');
                }
                lastScrollY = currentScrollY;

                if (currentScrollY > 400) {
                    btnTopo?.classList.add('show');
                } else {
                    btnTopo?.classList.remove('show');
                }
                ticking = false;
            });
            ticking = true;
        }
    }, { passive: true });

    btnTopo?.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

    // Poster hover preview na tabela
    document.addEventListener('mouseover', (e) => {
        const cell = e.target.closest('.poster-hover-cell');
        if (cell && cell.dataset.poster) {
            cell.style.setProperty('--poster-url', `url('${cell.dataset.poster}')`);
        }
    });

    const sectionObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                document.querySelectorAll('.app-nav a').forEach(a => a.classList.remove('text-info', 'fw-bold'));
                
                let targetLink = null;
                if (entry.target.id === 'cadastro-section') targetLink = document.getElementById('nav-cadastrar-btn');
                else if (entry.target.id === 'graficos-section') targetLink = document.getElementById('nav-graficos-btn');
                else if (entry.target.id === 'perfil-section') targetLink = document.getElementById('nav-perfil-btn');
                else targetLink = document.querySelector(`.app-nav a[href="#${entry.target.id}"]`);
                
                if (targetLink) targetLink.classList.add('text-info', 'fw-bold');
            }
        });
    }, { root: null, rootMargin: '-20% 0px -60% 0px', threshold: 0 });

    document.querySelectorAll('section').forEach(sec => sectionObserver.observe(sec));

    document.getElementById('nav-sugerir-btn')?.addEventListener('click', (e) => { 
        e.preventDefault(); 
        sugerirFilmeAleatorio(); 
    });

    // Botão "Sugerir Filme" no corpo da página (além do da navbar)
    document.getElementById('sugerir-filme-btn')?.addEventListener('click', (e) => {
        e.preventDefault();
        sugerirFilmeAleatorio();
    });

    document.getElementById('btn-importar-letterboxd')?.addEventListener('click', () => {
        // Passa a lista atual para detecção de duplicatas
        mostrarModalLetterboxd(filmes, async (filmesImportados) => {
            for (const f of filmesImportados) {
                try {
                    await MovieService.save(currentUser.uid, f, null);
                } catch(e) {
                    console.warn('[Letterboxd] Falha ao salvar:', f.titulo, e.message);
                }
            }
        });
    });

    document.getElementById('btn-minhas-listas')?.addEventListener('click', () => {
        abrirGerenciadorListas(db, currentUser.uid, filmes, listasPersonalizadas, (l) => {
            listasPersonalizadas = l;
        });
    });

    document.getElementById('btn-indicar-filme')?.addEventListener('click', (e) => {
        e.preventDefault();
        const nome = currentUser?.displayName || currentUserProfile?.nome || 'Um amigo';
        abrirModalIndicar(filmes, nome);
    });

    document.getElementById('btn-comparar-amigo')?.addEventListener('click', (e) => {
        e.preventDefault();
        mostrarComparacao(db, currentUser?.uid, filmes, currentUserProfile);
    });

    document.getElementById('nav-cadastrar-btn')?.addEventListener('click', (e) => {
        e.preventDefault();
        const section = document.getElementById('cadastro-section');
        // Se está fechando o formulário e havia edição em andamento, cancela
        if (section && section.style.display !== 'none' && FormManager.filmeEmEdicaoId) {
            FormManager.cancelarEdicao();
        }
        toggleSectionSmooth(section);
    });
    
    document.getElementById('nav-graficos-btn')?.addEventListener('click', (e) => {
        e.preventDefault();
        const section = document.getElementById('graficos-section');
        toggleSectionSmooth(section);
        
        if (section.style.display !== 'none') {
            setTimeout(() => {
                const listaParaGraficos = filmesFiltrados.filter(f => f.assistido);
                if (listaParaGraficos.length > 0) UI.renderCharts(listaParaGraficos);
            }, 300);
        }
    });
    
    document.getElementById('nav-perfil-btn')?.addEventListener('click', (e) => {
        e.preventDefault(); 
        toggleSectionSmooth(document.getElementById('perfil-section'));
    });

    document.getElementById('btn-compartilhar-perfil')?.addEventListener('click', () => {
        const url = `${window.location.origin}${window.location.pathname}?u=${currentUserProfile.nickname}`;
        navigator.clipboard.writeText(url).then(() => UI.toast('Link copiado para a área de transferência!'));
    });

    document.getElementById('limpar-filtros')?.addEventListener('click', () => {
        document.querySelectorAll('#filtros-container input').forEach(input => input.value = '');
        document.querySelectorAll('#filtros-container select').forEach(select => select.value = 'todos');
        document.getElementById('filtro-periodo-rapido').value = 'custom';
        
        sortBy = 'cadastradoEm'; 
        sortDirection = 'asc'; 
        localStorage.setItem('mf_sortBy', sortBy); 
        localStorage.setItem('mf_sortDir', sortDirection);
        
        paginaAtual = 1;
        Object.keys(paginasPorAba).forEach(k => paginasPorAba[k] = 1);
        abaAtiva = 'todos';
        // Ativa a aba "Todos" visualmente no Bootstrap
        const todosTabEl = document.getElementById('todos-tab');
        if (todosTabEl) {
            const bsTab = window.bootstrap?.Tab?.getOrCreateInstance(todosTabEl);
            if (bsTab) bsTab.show();
        }
        refreshUI();
    });
    
    document.getElementById('mobile-sort')?.addEventListener('change', (e) => {
        const [sortRule, direction] = e.target.value.split('-');
        sortBy = sortRule; 
        sortDirection = direction; 
        localStorage.setItem('mf_sortBy', sortBy); 
        localStorage.setItem('mf_sortDir', sortDirection);
        
        paginaAtual = 1;
        Object.keys(paginasPorAba).forEach(k => paginasPorAba[k] = 1);
        refreshUI();
    });

    document.addEventListener('input', (e) => {
        if (e.target.closest('#filtros-container')) {
            paginaAtual = 1;
            if (e.target.id.includes('data')) { 
                sortBy = 'dataAssistido'; 
                sortDirection = 'desc'; 
            }
            if (e.target.type === 'text' || e.target.type === 'number') { 
                clearTimeout(debounceTimer); 
                debounceTimer = setTimeout(refreshUI, 300); 
            } else { 
                refreshUI(); 
            }
        }
    });

    document.addEventListener('change', (e) => {
        if (e.target.closest('#filtros-container') && e.target.tagName === 'SELECT') {
            paginaAtual = 1; 
            refreshUI();
        }
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

    // Listeners das abas — detecta qual aba foi clicada e renderiza com paginação própria
    document.getElementById('filmesTab')?.addEventListener('shown.bs.tab', (e) => {
        const tabId = e.target.id;
        if      (tabId === 'todos-tab')          abaAtiva = 'todos';
        else if (tabId === 'assistidos-tab')     abaAtiva = 'assistidos';
        else if (tabId === 'nao-assistidos-tab') abaAtiva = 'naoAssistidos';
        else if (tabId === 'favoritos-tab')      abaAtiva = 'favoritos';
        paginasPorAba[abaAtiva] = 1;
        renderAba(abaAtiva);
    });

    document.getElementById('btn-pag-anterior')?.addEventListener('click', () => {
        if (paginasPorAba[abaAtiva] > 1) {
            paginasPorAba[abaAtiva]--;
            document.getElementById('lista-section')?.scrollIntoView({ behavior: 'auto', block: 'start' });
            renderAba(abaAtiva);
        }
    });

    document.getElementById('btn-pag-proximo')?.addEventListener('click', () => {
        const lista = getLista(abaAtiva);
        const totalPaginas = Math.ceil(lista.length / ITENS_POR_PAGINA);
        if (paginasPorAba[abaAtiva] < totalPaginas) {
            paginasPorAba[abaAtiva]++;
            document.getElementById('lista-section')?.scrollIntoView({ behavior: 'auto', block: 'start' });
            renderAba(abaAtiva);
        }
    });

    // ATALHOS DE TECLADO (POWER USERS)
    document.addEventListener('keydown', (e) => {
        if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;

        if (e.key.toLowerCase() === 'n') {
            e.preventDefault();
            const section = document.getElementById('cadastro-section');
            const isHidden = !section || section.style.display === 'none' || !section.style.display;
            if (isHidden) {
                toggleSectionSmooth(section);
            }
            // Aguarda scroll + animação terminar antes de focar
            setTimeout(() => {
                const titulo = document.getElementById('titulo');
                if (titulo) {
                    titulo.focus();
                    titulo.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }, 420);
        }
        
        if (e.key.toLowerCase() === 'f') {
            e.preventDefault();
            document.getElementById('filtro-busca')?.focus();
            document.getElementById('lista-section')?.scrollIntoView({ behavior: 'smooth' });
        }

        if (e.key === 'Escape') {
            ['cadastro-section', 'graficos-section', 'perfil-section'].forEach(id => {
                const sec = document.getElementById(id);
                if (sec && sec.style.display !== 'none' && sec.style.display !== '') {
                    toggleSectionSmooth(sec);
                }
            });
        }

        if (e.key === 'Enter' || e.key === ' ') {
            const cardAtivo = document.activeElement;
            if (cardAtivo && cardAtivo.classList.contains('movie-card')) { 
                e.preventDefault(); 
                cardAtivo.click(); 
            }
        }
    });

    // Dropdown da tabela — teleporta o menu para o body para escapar de
    // qualquer stacking context criado por transform/will-change nos ancestrais
    let _activeTableMenu = null;
    let _activeTableToggle = null;

    document.addEventListener('show.bs.dropdown', (e) => {
        const toggle = e.target;
        if (!toggle?.closest('.tabela-filmes')) return;

        const dropdown = toggle.closest('.dropdown');
        const menu = dropdown?.querySelector('.dropdown-menu');
        if (!menu) return;

        _activeTableToggle = toggle;
        _activeTableMenu   = menu;

        // Move para o body antes do Bootstrap posicionar
        document.body.appendChild(menu);
        menu.style.position   = 'fixed';
        menu.style.display    = 'block';
        menu.style.visibility = 'hidden';
        menu.style.zIndex     = '99999';
        menu.style.inset      = 'auto';
        menu.style.transform  = 'none';
        menu.style.margin     = '0';
        menu.style.minWidth   = '180px';
    });

    document.addEventListener('shown.bs.dropdown', (e) => {
        const toggle = e.target;
        if (!toggle?.closest('.tabela-filmes') && toggle !== _activeTableToggle) return;
        const menu = _activeTableMenu;
        if (!menu) return;

        const rect  = toggle.getBoundingClientRect();
        const viewW = window.innerWidth;
        const viewH = window.innerHeight;
        const menuW = menu.offsetWidth  || 190;
        const menuH = menu.offsetHeight || 170;

        let top  = rect.bottom + 2;
        let left = rect.right  - menuW;
        if (left < 8)              left = 8;
        if (left + menuW > viewW - 8) left = viewW - menuW - 8;
        if (top  + menuH > viewH - 8) top  = rect.top - menuH - 2;

        menu.style.top        = `${top}px`;
        menu.style.left       = `${left}px`;
        menu.style.visibility = 'visible';
    });

    document.addEventListener('hide.bs.dropdown', (e) => {
        const toggle = e.target;
        if (toggle !== _activeTableToggle) return;

        const menu = _activeTableMenu;
        if (!menu) return;

        // Devolve o menu ao dropdown original antes de fechar
        const dropdown = _activeTableToggle?.closest('.dropdown');
        if (dropdown && !dropdown.contains(menu)) {
            dropdown.appendChild(menu);
        }
        menu.style.cssText = '';
        _activeTableMenu   = null;
        _activeTableToggle = null;
    });

    // Setas das vitrines
    function setupVitrineArrow(scrollId, leftBtnId, rightBtnId) {
        const container = document.getElementById(scrollId);
        const btnLeft   = document.getElementById(leftBtnId);
        const btnRight  = document.getElementById(rightBtnId);
        if (!container || !btnLeft || !btnRight) return;

        const SCROLL_AMOUNT = 320;

        btnLeft.addEventListener('click', () => {
            container.scrollBy({ left: -SCROLL_AMOUNT, behavior: 'smooth' });
        });
        btnRight.addEventListener('click', () => {
            container.scrollBy({ left: SCROLL_AMOUNT, behavior: 'smooth' });
        });

        // Mostra/esconde setas conforme posição do scroll
        function updateArrows() {
            btnLeft.style.opacity  = container.scrollLeft > 0 ? '1' : '0.3';
            btnLeft.style.pointerEvents  = container.scrollLeft > 0 ? 'auto' : 'none';
            const atEnd = container.scrollLeft + container.clientWidth >= container.scrollWidth - 4;
            btnRight.style.opacity = atEnd ? '0.3' : '1';
            btnRight.style.pointerEvents = atEnd ? 'none' : 'auto';
        }
        container.addEventListener('scroll', updateArrows, { passive: true });
        updateArrows();
    }

    // Inicializa após renderVitrines ser chamada (usa MutationObserver)
    const vitrineObserver = new MutationObserver(() => {
        setupVitrineArrow('vitrine-destaques',   'arrow-destaques-left',   'arrow-destaques-right');
        setupVitrineArrow('vitrine-recomendados','arrow-recomendados-left','arrow-recomendados-right');
    });
    const vitrineEl = document.getElementById('vitrine-destaques');
    if (vitrineEl) vitrineObserver.observe(vitrineEl, { childList: true });

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
            
            localStorage.setItem('mf_sortBy', sortBy); 
            localStorage.setItem('mf_sortDir', sortDirection);
            refreshUI(); 
            return;
        }

        const carouselCard = target.closest('.js-carousel-card');
        if (carouselCard) {
            const targetId = carouselCard.dataset.targetId;
            const viewBtnTable = document.getElementById('view-btn-table');
            if (viewBtnTable) viewBtnTable.click();

            setTimeout(() => {
                const tr = document.querySelector(`tr[data-id="${targetId}"] .btn-detalhes`);
                if (tr) tr.click();
                document.getElementById('lista-section')?.scrollIntoView({behavior: 'smooth'});
            }, 100);
            return;
        }

        const item = target.closest('[data-id]');
        if (!item) return;
        
        const id = item.dataset.id;
        
        if (target.closest('.btn-indicar')) {
            e.stopPropagation();
            const nome = currentUser?.displayName || currentUserProfile?.nome || 'Um amigo';
            abrirModalIndicar([filme], nome);
            return;
        }

        if (target.closest('.btn-reavaliar')) {
            e.stopPropagation();
            if (isReadOnly || !filme.assistido) return;
            mostrarModalReavaliacao(filme, async (fid, novaNota, notaAnterior) => {
                try {
                    await salvarReavaliacao(db, currentUser.uid, fid, novaNota, notaAnterior, filme.titulo);
                    UI.toast(`Nota atualizada para ★ ${novaNota.toFixed(1)}`, 'success');
                } catch(e) {
                    UI.alert('Erro', e.message, 'error');
                }
            });
            return;
        }

        if (target.closest('.btn-add-to-lista')) {
            e.stopPropagation();
            if (isReadOnly) return;
            abrirAdicionarALista(db, currentUser.uid, id, listasPersonalizadas, (l) => {
                listasPersonalizadas = l;
            });
            return;
        }

        if (target.closest('.btn-quick-watch')) {
            e.stopPropagation();
            if (isReadOnly) return;
            const filme = filmes.find(x => x.id === id);
            if (!filme) return;
            const novoStatus = !filme.assistido;
            MovieService.toggleAssistido(currentUser.uid, id, novoStatus)
                .then(() => UI.toast(novoStatus ? 'Marcado como assistido!' : 'Desmarcado!', 'success'))
                .catch(err => UI.alert('Erro', err.message, 'error'));
            return;
        }
        
        if (target.closest('.btn-edit')) { 
            e.stopPropagation(); 
            if (isReadOnly) return; 
            FormManager.carregarParaEdicao(id); 
            return; 
        }
        
        if (target.closest('.btn-delete')) {
            e.stopPropagation();
            if (isReadOnly) return;
            const confirmacao = await UI.confirm('Excluir filme?', 'Esta ação é irreversível.');
            
            if (confirmacao.isConfirmed) {
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
        
        if (currentView === 'grid' || target.closest('.btn-view') || target.closest('.vitrine-card')) {
            const vitrineCard = target.closest('.vitrine-card');
            const targetId = vitrineCard ? vitrineCard.dataset.id : id;

            const filme = filmes.find(x => x.id === targetId);
            if (filme) {
                UI.showMovieDetailModal(
                    filme,
                    !isReadOnly ? async (fid, marcar) => {
                        await MovieService.toggleAssistido(currentUser?.uid, fid, marcar);
                        UI.toast(marcar ? 'Marcado como assistido!' : 'Desmarcado!');
                    } : null,
                    (titulo, ano) => {
                        if (!Swal.isVisible()) return Promise.resolve(null);
                        return MovieService.getTrailer(titulo, ano);
                    },
                    !isReadOnly ? async (fid, sinopse) => {
                        try {
                            await MovieService.updateCampos(currentUser?.uid, fid, { sinopse });
                        } catch(e) {
                            console.warn('[Sinopse] Falha ao salvar:', e.message);
                        }
                    } : null,
                    // Reavaliar nota — salva histórico
                    !isReadOnly ? async (filmeObj) => {
                        const { value: novaNota } = await Swal.fire({
                            title: `Reavaliar: ${filmeObj.titulo}`,
                            html: `<p style="color:rgba(255,255,255,0.4);font-size:0.85rem;margin-bottom:12px;">
                                       Nota atual: <strong style="color:#fbbf24;">★ ${filmeObj.nota?.toFixed(1)}</strong>
                                   </p>
                                   <input id="nova-nota-input" type="number" min="0" max="10" step="0.5"
                                       value="${filmeObj.nota || ''}"
                                       inputmode="decimal"
                                       style="width:120px;padding:10px;text-align:center;font-size:1.4rem;
                                              font-weight:700;border-radius:10px;border:1px solid rgba(255,255,255,0.15);
                                              background:rgba(255,255,255,0.05);color:#fff;">`,
                            showCancelButton: true,
                            confirmButtonText: 'Salvar nova nota',
                            cancelButtonText: 'Cancelar',
                            customClass: { popup: 'suggestion-swal-popup' },
                            preConfirm: () => {
                                const v = parseFloat(document.getElementById('nova-nota-input').value);
                                if (isNaN(v) || v < 0 || v > 10) {
                                    Swal.showValidationMessage('Nota deve ser entre 0 e 10');
                                    return false;
                                }
                                return v;
                            }
                        });
                        if (novaNota !== undefined) {
                            await MovieService.reavaliarFilme(currentUser?.uid, filmeObj.id, novaNota, filmeObj);
                            UI.toast(`Nova nota ${novaNota.toFixed(1)} salva! Histórico atualizado.`);
                        }
                    } : null
                );
            }
        }
    });
}

let _ultimaNotifMeta = 0;
function _verificarMetasProximas(filmes) {
    // Throttle: só verifica a cada 5 minutos
    const agora = Date.now();
    if (agora - _ultimaNotifMeta < 300000) return;

    const metas = [
        { meta: 50,  atual: filmes.length, label: 'filmes cadastrados' },
        { meta: 100, atual: filmes.length, label: 'filmes cadastrados' },
        { meta: 200, atual: filmes.length, label: 'filmes cadastrados' },
        { meta: 300, atual: filmes.length, label: 'filmes cadastrados' },
        { meta: 7,   atual: (() => {
            const dias = new Set(filmes.filter(f=>f.assistido&&f.dataAssistido).map(f=>f.dataAssistido.slice(0,10)));
            let s=0; const hoje=new Date();
            const ts = d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
            let c=new Date(hoje); if(!dias.has(ts(c))) c.setDate(c.getDate()-1);
            while(dias.has(ts(c))){ s++; c.setDate(c.getDate()-1); } return s;
        })(), label: 'dias seguidos' },
    ];

    for (const { meta, atual, label } of metas) {
        const faltam = meta - atual;
        if (faltam > 0 && faltam <= 5) {
            _ultimaNotifMeta = agora;
            UI.toast(`🏆 Você está a ${faltam} ${label === 'dias seguidos' ? 'dia(s)' : 'filme(s)'} de uma conquista! (${atual}/${meta} ${label})`);
            break;
        }
    }
}

function sugerirFilmeAleatorio() {
    // Usa todos os filmes não assistidos (ignora filtros ativos para não surpreender o usuário)
    const pendentes = filmes.filter(f => !f.assistido);
    
    if (!pendentes.length) {
        return UI.alert('Lista vazia!', 'Não há filmes não assistidos na sua coleção.', 'warning');
    }
    
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
    
    document.getElementById('import-btn')?.addEventListener('click', () => { 
        document.getElementById('import-file-input').click(); 
    });
    
    document.getElementById('import-file-input')?.addEventListener('change', importarArquivo);
}

function exportarCSV() {
    if (!filmesFiltrados.length) return UI.toast('Lista vazia', 'warning');
    
    const headers = ['titulo', 'ano', 'nota', 'direcao', 'atores', 'genero', 'tags', 'origem', 'assistido', 'dataAssistido', 'posterUrl'];
    
    const rows = filmesFiltrados.map(f => headers.map(header => { 
        let val = f[header];
        if (Array.isArray(val)) val = val.join('; ');
        if (val == null) val = '';
        val = String(val).replace(/"/g, '""').replace(/\n/g, ' ').replace(/\r/g, '');
        if (val.includes(',') || val.includes('"') || val.includes('\n')) val = `"${val}"`;
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
            
            const novosFilmes = dadosImportados.filter(novo => !filmes.some(existente => existente.titulo.toLowerCase() === novo.titulo.toLowerCase()));
            
            if (!novosFilmes.length) {
                return UI.alert('Informação', 'Nenhum filme novo encontrado no arquivo.', 'info');
            }
            
            const confirmacao = await UI.confirm('Importar Dados', `Deseja importar ${novosFilmes.length} filmes?`);
            
            if (confirmacao.isConfirmed) {
                UI.toast('Importando...'); 
                
                for (const filme of novosFilmes) {
                    const { id, cadastradoEm, ...dadosLimpos } = filme;
                    await MovieService.save(currentUser.uid, { ...dadosLimpos });
                }
                UI.toast('Importação concluída!');
            }
        } catch(err) { 
            UI.alert('Erro na Importação', err.message, 'error');
        } finally {
            e.target.value = ''; // Limpa input sempre, mesmo após erro
        }
    }; 
    
    reader.readAsText(file);
}