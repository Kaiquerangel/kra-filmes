/**
 * colecoes.js
 * Coleções personalizadas — fluxo:
 * 1. "Minhas Listas" abre painel com todas as coleções
 * 2. Clicar numa coleção abre página dedicada (overlay) com design cinematográfico
 * 3. Em qualquer filme (card ou tabela) botão "Adicionar à Lista"
 */

import { UI } from '../ui.js';

// ─── Firestore ops ───────────────────────────────────────────
async function fsOps() {
    const { collection, addDoc, getDocs, doc, updateDoc, deleteDoc, serverTimestamp }
        = await import("https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js");
    return { collection, addDoc, getDocs, doc, updateDoc, deleteDoc, serverTimestamp };
}

// ─── CRUD ────────────────────────────────────────────────────
export async function getListas(db, uid) {
    const { collection, getDocs } = await fsOps();
    const snap = await getDocs(collection(db, 'users', uid, 'colecoes'));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function criarLista(db, uid, nome, descricao = '') {
    const { collection, addDoc, serverTimestamp } = await fsOps();
    const ref = await addDoc(collection(db, 'users', uid, 'colecoes'), {
        nome, descricao, filmes: [], criadaEm: serverTimestamp()
    });
    return ref.id;
}

async function atualizarLista(db, uid, listaId, campos) {
    const { doc, updateDoc } = await fsOps();
    await updateDoc(doc(db, 'users', uid, 'colecoes', listaId), campos);
}

async function excluirLista(db, uid, listaId) {
    const { doc, deleteDoc } = await fsOps();
    await deleteDoc(doc(db, 'users', uid, 'colecoes', listaId));
}

async function toggleFilmeNaLista(db, uid, listaId, filmeId, listas) {
    const lista = listas.find(l => l.id === listaId);
    if (!lista) return;
    const filmes = lista.filmes || [];
    const novo = filmes.includes(filmeId)
        ? filmes.filter(id => id !== filmeId)
        : [...filmes, filmeId];
    await atualizarLista(db, uid, listaId, { filmes: novo });
    lista.filmes = novo;
}

// ─── Injetar estilos da página de lista (uma vez) ────────────
function injetarEstilos() {
    if (document.getElementById('colecao-page-style')) return;
    const st = document.createElement('style');
    st.id = 'colecao-page-style';
    st.textContent = `
        #colecao-page-overlay {
            position: fixed; inset: 0; z-index: 9000;
            background: #07090f;
            overflow-y: auto;
            animation: colPageIn 0.3s cubic-bezier(0.16,1,0.3,1);
        }
        @keyframes colPageIn {
            from { opacity: 0; transform: translateY(18px); }
            to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes colPageOut {
            from { opacity: 1; transform: translateY(0); }
            to   { opacity: 0; transform: translateY(12px); }
        }

        /* ── HERO ── */
        .col-page-hero {
            position: relative;
            padding: 32px 48px 0;
            overflow: hidden;
        }
        .col-page-hero-bg {
            position: absolute; inset: 0; pointer-events: none;
            background:
                radial-gradient(ellipse 55% 120% at 75% -20%, rgba(168,85,247,0.22) 0%, transparent 65%),
                radial-gradient(ellipse 35% 70% at 5% 110%, rgba(109,40,217,0.14) 0%, transparent 55%),
                radial-gradient(ellipse 80% 40% at 50% 100%, rgba(7,9,15,0.9) 0%, transparent 100%);
        }
        /* Grain sutil */
        .col-page-hero-bg::after {
            content: '';
            position: absolute; inset: 0;
            opacity: 0.025;
            background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
            background-size: 160px;
        }

        /* ── BARRA TOPO ── */
        .col-topbar {
            position: relative;
            display: flex; align-items: center; justify-content: space-between;
            margin-bottom: 36px;
        }
        .col-back-btn {
            display: inline-flex; align-items: center; gap: 7px;
            font-size: 0.76rem; color: rgba(255,255,255,0.4); cursor: pointer;
            padding: 7px 13px; border-radius: 9px;
            border: 1px solid rgba(255,255,255,0.08);
            background: rgba(255,255,255,0.04);
            transition: all 0.15s; font-family: inherit; letter-spacing: 0.01em;
        }
        .col-back-btn:hover { color: rgba(255,255,255,0.9); background: rgba(255,255,255,0.08); border-color: rgba(255,255,255,0.14); }

        /* ── HERO CONTENT ── */
        .col-hero-body {
            position: relative;
            display: flex; align-items: flex-end; gap: 24px;
            padding-bottom: 28px;
        }

        /* Colagem de pôsteres */
        .col-poster-collage {
            position: relative; width: 148px; height: 108px; flex-shrink: 0;
        }
        .col-poster-collage img {
            position: absolute; object-fit: cover;
            box-shadow: 0 12px 32px rgba(0,0,0,0.7);
            border: 2px solid rgba(255,255,255,0.06);
        }
        .col-poster-collage img:nth-child(1) { width:58px;height:87px;border-radius:8px;left:0;top:10px;transform:rotate(-6deg);z-index:1; }
        .col-poster-collage img:nth-child(2) { width:62px;height:93px;border-radius:9px;left:40px;top:4px;z-index:3; }
        .col-poster-collage img:nth-child(3) { width:56px;height:84px;border-radius:8px;left:88px;top:12px;transform:rotate(5deg);z-index:2; }

        /* Texto hero */
        .col-hero-text { flex: 1; min-width: 0; }
        .col-lista-tag {
            display: inline-flex; align-items: center; gap: 5px;
            font-size: 0.65rem; text-transform: uppercase; letter-spacing: 0.12em;
            color: #a855f7; margin-bottom: 7px; font-weight: 500;
        }
        .col-lista-nome {
            font-family: 'DM Serif Display', Georgia, serif;
            font-size: 2.4rem; line-height: 1.05; color: #fff;
            margin-bottom: 10px; letter-spacing: -0.01em;
        }
        .col-hero-meta {
            display: flex; align-items: center; gap: 12px; flex-wrap: wrap;
            font-size: 0.78rem; color: rgba(255,255,255,0.38);
        }
        .col-hero-meta strong { color: rgba(255,255,255,0.82); font-weight: 500; }
        .col-meta-dot { width: 3px; height: 3px; border-radius: 50%; background: rgba(255,255,255,0.15); }

        /* ── STATS BAR ── */
        .col-stats-wrap {
            position: relative;
            padding: 0 48px;
            margin-top: -1px;
            background: rgba(255,255,255,0.015);
            border-top: 1px solid rgba(255,255,255,0.06);
            border-bottom: 1px solid rgba(255,255,255,0.06);
        }
        .col-stats-bar {
            display: flex; max-width: 560px;
        }
        .col-stat-block {
            padding: 16px 24px 16px 0;
            display: flex; flex-direction: column; gap: 3px;
            margin-right: 24px;
            border-right: 1px solid rgba(255,255,255,0.06);
            min-width: 100px;
        }
        .col-stat-block:last-child { border-right: none; margin-right: 0; }
        .col-stat-label { font-size: 0.63rem; text-transform: uppercase; letter-spacing: 0.09em; color: rgba(255,255,255,0.3); }
        .col-stat-value { font-size: 1.25rem; font-weight: 700; color: #fff; letter-spacing: -0.01em; }

        /* ── CONTROLES ── */
        .col-controls {
            display: flex; align-items: center; justify-content: space-between;
            gap: 12px; padding: 12px 48px;
            border-bottom: 1px solid rgba(255,255,255,0.06);
            flex-wrap: wrap;
        }
        .col-view-tabs {
            display: flex; gap: 2px;
        }
        .col-view-tab {
            padding: 6px 16px; border-radius: 7px; font-size: 0.78rem;
            color: rgba(255,255,255,0.35); cursor: pointer; transition: all 0.13s;
            border: none; background: none; font-family: inherit;
        }
        .col-view-tab:hover { color: rgba(255,255,255,0.65); background: rgba(255,255,255,0.04); }
        .col-view-tab.active {
            background: rgba(168,85,247,0.12);
            color: #c084fc;
            border: 1px solid rgba(168,85,247,0.2);
        }
        .col-sort-select {
            background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08);
            border-radius: 8px; color: rgba(255,255,255,0.6);
            font-size: 0.76rem; padding: 6px 11px; outline: none; cursor: pointer;
            font-family: inherit; transition: all 0.13s;
        }
        .col-sort-select:hover { border-color: rgba(255,255,255,0.14); color: rgba(255,255,255,0.85); }

        /* ── LISTA DE FILMES ── */
        .col-filmes-wrap { padding: 16px 48px 56px; max-width: 900px; margin: 0 auto; }
        .col-filme-row {
            display: grid;
            grid-template-columns: 32px 44px 1fr auto;
            align-items: center; gap: 16px;
            padding: 9px 12px; border-radius: 10px;
            border: 1px solid transparent;
            cursor: pointer;
            transition: background 0.13s, border-color 0.13s, transform 0.13s;
            margin-bottom: 3px;
            animation: colRowIn 0.35s ease both;
        }
        .col-filme-row:hover {
            background: rgba(255,255,255,0.04);
            border-color: rgba(255,255,255,0.06);
            transform: translateX(3px);
        }
        @keyframes colRowIn {
            from { opacity:0; transform:translateY(6px); }
            to   { opacity:1; transform:translateY(0); }
        }
        .col-row-num {
            font-size: 0.7rem; color: rgba(255,255,255,0.22);
            text-align: right; font-variant-numeric: tabular-nums;
        }
        .col-row-poster {
            width: 44px; height: 64px; border-radius: 6px; overflow: hidden;
            flex-shrink: 0; background: #131c2b;
            border: 1px solid rgba(255,255,255,0.07);
            display: flex; align-items: center; justify-content: center;
        }
        .col-row-poster img { width: 100%; height: 100%; object-fit: cover; }
        .col-row-titulo {
            font-size: 0.88rem; font-weight: 600; color: rgba(255,255,255,0.85);
            white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-bottom: 5px;
            transition: color 0.13s;
        }
        .col-filme-row:hover .col-row-titulo { color: #fff; }
        .col-row-meta { display: flex; align-items: center; gap: 7px; flex-wrap: wrap; }
        .col-row-ano { font-size: 0.71rem; color: rgba(255,255,255,0.3); }
        .col-row-nota { display: flex; align-items: center; gap: 3px; font-size: 0.71rem; font-weight: 600; color: #fbbf24; }
        .col-row-status { font-size: 0.65rem; padding: 2px 6px; border-radius: 4px; font-weight: 600; letter-spacing: 0.02em; }
        .col-status-ok  { background: rgba(52,211,153,0.1); color: #34d399; }
        .col-status-pen { background: rgba(255,255,255,0.05); color: rgba(255,255,255,0.3); }
        .col-row-actions { display: flex; align-items: center; gap: 6px; opacity: 0; transition: opacity 0.13s; }
        .col-filme-row:hover .col-row-actions { opacity: 1; }
        .col-btn-rm {
            width:28px; height:28px; border-radius:7px;
            border:1px solid rgba(239,68,68,0.2); background:transparent;
            color:rgba(239,68,68,0.5); cursor:pointer;
            display:flex; align-items:center; justify-content:center; font-size:0.7rem;
            transition:all 0.13s;
        }
        .col-btn-rm:hover { background:rgba(239,68,68,0.1); color:#f87171; border-color:rgba(239,68,68,0.4); }
        .col-empty {
            text-align:center; padding:56px 24px; color:rgba(255,255,255,0.35);
        }
        .col-empty i { font-size:2.5rem; opacity:0.2; display:block; margin-bottom:14px; }
        @media (max-width:600px) {
            .col-page-hero, .col-controls, .col-filmes-wrap { padding-left:18px; padding-right:18px; }
            .col-lista-nome { font-size:1.5rem; }
            .col-stats-bar { display:grid; grid-template-columns:1fr 1fr; }
            .col-filme-row { grid-template-columns:24px 44px 1fr auto; gap:10px; }
        }
    `;
    document.head.appendChild(st);

    // Fonte DM Serif Display se não estiver carregada
    if (!document.querySelector('link[href*="DM+Serif"]')) {
        const lk = document.createElement('link');
        lk.rel = 'stylesheet';
        lk.href = 'https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&display=swap';
        document.head.appendChild(lk);
    }
}

// ─── PÁGINA DEDICADA da coleção ───────────────────────────────
function abrirPaginaLista(lista, todosFilmes, db, uid, listas, onUpdate, onVoltar) {
    injetarEstilos();

    // Estado local da página
    let filmesLista = todosFilmes.filter(f => (lista.filmes || []).includes(f.id));
    let abaAtiva = 'todos';
    let sortAtual = 'nota';

    function getFilmesFiltrados() {
        let base = [...filmesLista];
        if (abaAtiva === 'assistidos') base = base.filter(f => f.assistido);
        if (abaAtiva === 'pendentes')  base = base.filter(f => !f.assistido);
        if (sortAtual === 'nota')   base.sort((a,b) => (b.nota||0)-(a.nota||0));
        if (sortAtual === 'ano')    base.sort((a,b) => (a.ano||0)-(b.ano||0));
        if (sortAtual === 'titulo') base.sort((a,b) => (a.titulo||'').localeCompare(b.titulo||''));
        return base;
    }

    // Stats
    function calcStats() {
        const assistidos = filmesLista.filter(f => f.assistido && f.nota);
        const media = assistidos.length
            ? (assistidos.reduce((s,f) => s+f.nota, 0) / assistidos.length).toFixed(1)
            : '–';
        const melhor = assistidos.length
            ? Math.max(...assistidos.map(f => f.nota)).toFixed(1) : '–';
        return {
            media,
            melhor,
            assistidos: filmesLista.filter(f => f.assistido).length,
            pendentes:  filmesLista.filter(f => !f.assistido).length,
        };
    }

    // Colagem de pôsteres (até 3)
    function posterCollageHTML() {
        const ids = (lista.filmes || []).slice(0, 3);
        const imgs = ids.map(fid => {
            const f = todosFilmes.find(x => x.id === fid);
            return f?.posterUrl && f.posterUrl !== 'N/A'
                ? `<img src="${f.posterUrl}" alt="${f.titulo||''}">`
                : '';
        }).filter(Boolean);
        if (!imgs.length) return `<div style="width:80px;height:80px;background:#131c2b;border-radius:10px;display:flex;align-items:center;justify-content:center;"><i class="fas fa-bookmark" style="font-size:1.6rem;color:rgba(168,85,247,0.4);"></i></div>`;
        return `<div class="col-poster-collage">${imgs.join('')}</div>`;
    }

    function renderFilmes() {
        const lista_el = document.getElementById('col-filmes-list');
        if (!lista_el) return;
        const arr = getFilmesFiltrados();
        if (!arr.length) {
            lista_el.innerHTML = `<div class="col-empty"><i class="fas fa-film"></i>Nenhum filme nesta seleção.</div>`;
            return;
        }
        lista_el.innerHTML = arr.map((f, i) => `
            <div class="col-filme-row" style="animation-delay:${i*0.04}s" data-id="${f.id}">
                <div class="col-row-num">${i+1}</div>
                <div class="col-row-poster">
                    ${f.posterUrl && f.posterUrl !== 'N/A'
                        ? `<img src="${f.posterUrl}" alt="${f.titulo||''}">`
                        : `<i class="fas fa-film" style="color:rgba(255,255,255,0.1);font-size:0.85rem;"></i>`}
                </div>
                <div>
                    <div class="col-row-titulo">${f.titulo || '–'}</div>
                    <div class="col-row-meta">
                        <span class="col-row-ano">${f.ano || ''}</span>
                        ${f.nota ? `<span class="col-row-nota"><i class="fas fa-star" style="font-size:0.6rem;"></i> ${f.nota.toFixed(1)}</span>` : ''}
                        <span class="col-row-status ${f.assistido ? 'col-status-ok' : 'col-status-pen'}">
                            ${f.assistido ? 'Assistido' : 'Pendente'}
                        </span>
                    </div>
                </div>
                <div class="col-row-actions">
                    <button class="col-btn-rm" data-id="${f.id}" title="Remover da lista">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            </div>`).join('');

        // Botões remover
        lista_el.querySelectorAll('.col-btn-rm').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                btn.disabled = true;
                await toggleFilmeNaLista(db, uid, lista.id, btn.dataset.id, listas);
                listas = await getListas(db, uid);
                onUpdate(listas);
                const listaAtual = listas.find(l => l.id === lista.id);
                if (listaAtual) {
                    lista.filmes = listaAtual.filmes;
                    filmesLista = todosFilmes.filter(f => (lista.filmes||[]).includes(f.id));
                    atualizarStats();
                    renderFilmes();
                }
            });
        });
    }

    function atualizarStats() {
        const s = calcStats();
        const el = document.getElementById('col-stats-bar');
        if (!el) return;
        el.innerHTML = `
            <div class="col-stat-block"><div class="col-stat-label">Nota média</div><div class="col-stat-value" style="color:#fbbf24;">★ ${s.media}</div></div>
            <div class="col-stat-block"><div class="col-stat-label">Assistidos</div><div class="col-stat-value" style="color:#34d399;">${s.assistidos} / ${filmesLista.length}</div></div>
            <div class="col-stat-block"><div class="col-stat-label">Melhor nota</div><div class="col-stat-value" style="color:#fbbf24;">${s.melhor}</div></div>
            <div class="col-stat-block"><div class="col-stat-label">Pendentes</div><div class="col-stat-value" style="color:#a855f7;">${s.pendentes}</div></div>`;
    }

    // Monta o HTML da página
    const s = calcStats();
    const overlay = document.createElement('div');
    overlay.id = 'colecao-page-overlay';
    overlay.innerHTML = `
        <!-- HERO -->
        <div class="col-page-hero">
            <div class="col-page-hero-bg"></div>

            <div class="col-topbar">
                <button class="col-back-btn" id="col-back-btn">
                    <i class="fas fa-arrow-left" style="font-size:0.65rem;"></i> Minhas Listas
                </button>
            </div>

            <div class="col-hero-body">
                ${posterCollageHTML()}
                <div class="col-hero-text">
                    <div class="col-lista-tag">
                        <i class="fas fa-bookmark" style="font-size:0.55rem;"></i> Coleção
                    </div>
                    <div class="col-lista-nome">${lista.nome}</div>
                    <div class="col-hero-meta">
                        <span><strong>${filmesLista.length}</strong> filme${filmesLista.length !== 1 ? 's' : ''}</span>
                        ${lista.descricao ? `<span class="col-meta-dot"></span><span>${lista.descricao}</span>` : ''}
                    </div>
                </div>
            </div>
        </div>

        <!-- STATS -->
        <div class="col-stats-wrap">
            <div class="col-stats-bar" id="col-stats-bar">
                <div class="col-stat-block">
                    <div class="col-stat-label">Nota média</div>
                    <div class="col-stat-value" style="color:#fbbf24;">★ ${s.media}</div>
                </div>
                <div class="col-stat-block">
                    <div class="col-stat-label">Assistidos</div>
                    <div class="col-stat-value" style="color:#34d399;">${s.assistidos} / ${filmesLista.length}</div>
                </div>
                <div class="col-stat-block">
                    <div class="col-stat-label">Melhor nota</div>
                    <div class="col-stat-value" style="color:#fbbf24;">${s.melhor}</div>
                </div>
                <div class="col-stat-block">
                    <div class="col-stat-label">Pendentes</div>
                    <div class="col-stat-value" style="color:#a855f7;">${s.pendentes}</div>
                </div>
            </div>
        </div>

        <!-- CONTROLES -->
        <div class="col-controls">
            <div class="col-view-tabs">
                <button class="col-view-tab active" data-aba="todos">Todos</button>
                <button class="col-view-tab" data-aba="assistidos">Assistidos</button>
                <button class="col-view-tab" data-aba="pendentes">Pendentes</button>
            </div>
            <select class="col-sort-select" id="col-sort-select">
                <option value="nota">Nota ↓</option>
                <option value="ano">Ano ↑</option>
                <option value="titulo">Título A–Z</option>
            </select>
        </div>

        <!-- FILMES -->
        <div class="col-filmes-wrap">
            <div id="col-filmes-list"></div>
        </div>`;

    document.body.appendChild(overlay);
    renderFilmes();

    // Voltar
    document.getElementById('col-back-btn').addEventListener('click', () => {
        overlay.style.animation = 'colPageOut 0.2s ease forwards';
        setTimeout(() => {
            overlay.remove();
            if (onVoltar) onVoltar();
        }, 200);
    });

    // Tabs
    overlay.querySelectorAll('.col-view-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            overlay.querySelectorAll('.col-view-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            abaAtiva = tab.dataset.aba;
            renderFilmes();
        });
    });

    // Ordenação
    document.getElementById('col-sort-select').addEventListener('change', (e) => {
        sortAtual = e.target.value;
        renderFilmes();
    });
}

// ─── MODAL: Gerenciar coleções ────────────────────────────────
export async function abrirGerenciadorListas(db, uid, todosFilmes, listas, onUpdate) {

    const renderHTML = () => {
        const listasHTML = listas.length
            ? listas.map(l => {
                const qtd = (l.filmes || []).length;
                const idsPreview = (l.filmes || []).slice(0, 3);
                const postersPreview = idsPreview.map(fid => {
                    const f = todosFilmes.find(x => x.id === fid);
                    return f?.posterUrl && f.posterUrl !== 'N/A'
                        ? `<img src="${f.posterUrl}" style="width:28px;height:42px;object-fit:cover;border-radius:3px;flex-shrink:0;">`
                        : `<div style="width:28px;height:42px;background:#1e293b;border-radius:3px;flex-shrink:0;"></div>`;
                }).join('');

                return `
                <div class="colecao-item" data-id="${l.id}"
                     style="display:flex;align-items:center;gap:12px;padding:12px 14px;
                            border-radius:10px;border:1px solid rgba(255,255,255,0.08);
                            background:rgba(255,255,255,0.03);margin-bottom:8px;cursor:pointer;
                            transition:all 0.15s;"
                     onmouseover="this.style.background='rgba(59,130,246,0.1)';this.style.borderColor='rgba(59,130,246,0.25)'"
                     onmouseout="this.style.background='rgba(255,255,255,0.03)';this.style.borderColor='rgba(255,255,255,0.08)'">

                    <div style="display:flex;gap:3px;flex-shrink:0;">
                        ${postersPreview || `<div style="width:28px;height:42px;background:#1e293b;border-radius:3px;display:flex;align-items:center;justify-content:center;"><i class="fas fa-film" style="font-size:0.6rem;color:rgba(255,255,255,0.2);"></i></div>`}
                    </div>

                    <div style="flex:1;min-width:0;">
                        <div style="font-size:0.9rem;font-weight:600;color:rgba(255,255,255,0.92);">${l.nome}</div>
                        <div style="font-size:0.75rem;color:rgba(255,255,255,0.45);margin-top:2px;">
                            ${qtd === 0 ? 'Nenhum filme ainda' : `${qtd} filme${qtd > 1 ? 's' : ''}`}
                            ${l.descricao ? ` · ${l.descricao}` : ''}
                        </div>
                    </div>

                    <div style="display:flex;gap:6px;flex-shrink:0;" onclick="event.stopPropagation()">
                        <button class="btn-colecao-ver" data-id="${l.id}"
                            style="padding:5px 10px;border-radius:6px;border:1px solid rgba(59,130,246,0.3);
                                   background:rgba(59,130,246,0.1);color:#60a5fa;font-size:0.75rem;cursor:pointer;">
                            <i class="fas fa-eye me-1"></i>Ver
                        </button>
                        <button class="btn-colecao-excluir" data-id="${l.id}" data-nome="${l.nome}"
                            style="padding:5px 10px;border-radius:6px;border:1px solid rgba(239,68,68,0.2);
                                   background:transparent;color:rgba(239,68,68,0.7);font-size:0.75rem;cursor:pointer;">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>`;
            }).join('')
            : `<div style="text-align:center;padding:32px 16px;">
                   <i class="fas fa-bookmark" style="font-size:2rem;color:rgba(255,255,255,0.1);display:block;margin-bottom:12px;"></i>
                   <div style="font-size:0.88rem;color:rgba(255,255,255,0.5);">Nenhuma lista criada ainda.</div>
                   <div style="font-size:0.78rem;color:rgba(255,255,255,0.3);margin-top:4px;">Crie sua primeira lista abaixo!</div>
               </div>`;

        return `
            <div style="max-height:300px;overflow-y:auto;margin-bottom:16px;">${listasHTML}</div>
            <div style="border-top:1px solid rgba(255,255,255,0.08);padding-top:14px;">
                <div style="font-size:0.72rem;color:rgba(255,255,255,0.5);text-transform:uppercase;
                            letter-spacing:0.06em;margin-bottom:8px;font-weight:600;">
                    <i class="fas fa-plus me-1"></i> Nova lista
                </div>
                <div style="display:flex;gap:8px;margin-bottom:6px;">
                    <input id="nova-lista-nome" placeholder="Nome da lista (ex: Clássicos, Para o fim de semana...)"
                        style="flex:1;padding:9px 12px;border-radius:8px;border:1px solid rgba(255,255,255,0.15);
                               background:rgba(255,255,255,0.06);color:#fff;font-size:0.85rem;outline:none;">
                    <button id="btn-criar-lista"
                        style="padding:9px 16px;border-radius:8px;border:none;flex-shrink:0;
                               background:#3b82f6;color:#fff;font-size:0.85rem;cursor:pointer;font-weight:500;">
                        Criar
                    </button>
                </div>
                <input id="nova-lista-desc" placeholder="Descrição opcional..."
                    style="width:100%;padding:7px 12px;border-radius:8px;box-sizing:border-box;
                           border:1px solid rgba(255,255,255,0.08);background:rgba(255,255,255,0.03);
                           color:rgba(255,255,255,0.7);font-size:0.78rem;outline:none;">
            </div>
            <div style="margin-top:12px;padding:10px 12px;background:rgba(168,85,247,0.06);
                        border:1px solid rgba(168,85,247,0.15);border-radius:8px;">
                <p style="font-size:0.75rem;color:rgba(255,255,255,0.6);margin:0;line-height:1.5;">
                    <i class="fas fa-lightbulb me-1" style="color:#a855f7;"></i>
                    <strong style="color:rgba(255,255,255,0.85);">Como adicionar filmes:</strong>
                    Na lista de filmes, clique nos <strong style="color:rgba(255,255,255,0.85);">três pontos ⋮</strong> de qualquer filme
                    ou no ícone <i class="fas fa-bookmark" style="color:#a855f7;"></i> e escolha <em>"Adicionar à Lista"</em>.
                </p>
            </div>`;
    };

    const abrirModal = () => {
        Swal.fire({
            title: '<span style="font-size:1rem;font-weight:600;"><i class="fas fa-bookmark me-2" style="color:#a855f7;"></i>Minhas Listas</span>',
            width: 'min(560px, 95vw)',
            html: renderHTML(),
            showConfirmButton: false,
            showCancelButton: true,
            cancelButtonText: 'Fechar',
            customClass: { popup: 'suggestion-swal-popup', cancelButton: 'suggestion-deny-btn' },
            didOpen: () => {
                const criar = async () => {
                    const nome = document.getElementById('nova-lista-nome')?.value.trim();
                    const desc = document.getElementById('nova-lista-desc')?.value.trim();
                    if (!nome) { document.getElementById('nova-lista-nome')?.focus(); return; }
                    const btn = document.getElementById('btn-criar-lista');
                    if (btn) { btn.disabled = true; btn.textContent = '...'; }
                    await criarLista(db, uid, nome, desc);
                    listas = await getListas(db, uid);
                    onUpdate(listas);
                    Swal.close();
                    setTimeout(abrirModal, 150);
                };

                document.getElementById('btn-criar-lista')?.addEventListener('click', criar);
                document.getElementById('nova-lista-nome')?.addEventListener('keydown', e => {
                    if (e.key === 'Enter') criar();
                });

                // Ver → abre página dedicada
                document.querySelectorAll('.btn-colecao-ver').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        const l = listas.find(x => x.id === btn.dataset.id);
                        if (l) {
                            Swal.close();
                            setTimeout(() => abrirPaginaLista(l, todosFilmes, db, uid, listas, onUpdate, abrirModal), 150);
                        }
                    });
                });

                // Clique no item também abre
                document.querySelectorAll('.colecao-item').forEach(item => {
                    item.addEventListener('click', (e) => {
                        if (e.target.closest('button')) return;
                        const l = listas.find(x => x.id === item.dataset.id);
                        if (l) {
                            Swal.close();
                            setTimeout(() => abrirPaginaLista(l, todosFilmes, db, uid, listas, onUpdate, abrirModal), 150);
                        }
                    });
                });

                // Excluir
                document.querySelectorAll('.btn-colecao-excluir').forEach(btn => {
                    btn.addEventListener('click', async (e) => {
                        e.stopPropagation();
                        const { isConfirmed } = await Swal.fire({
                            title: 'Excluir lista?',
                            text: `"${btn.dataset.nome}" será removida permanentemente.`,
                            icon: 'warning',
                            showCancelButton: true,
                            confirmButtonText: 'Excluir',
                            confirmButtonColor: '#ef4444',
                            cancelButtonText: 'Cancelar',
                            customClass: { popup: 'suggestion-swal-popup' }
                        });
                        if (isConfirmed) {
                            await excluirLista(db, uid, btn.dataset.id);
                            listas = await getListas(db, uid);
                            onUpdate(listas);
                            Swal.close();
                            setTimeout(abrirModal, 150);
                        }
                    });
                });
            }
        });
    };

    abrirModal();
}

// ─── MODAL: Adicionar filme a uma lista ──────────────────────
export function abrirAdicionarALista(db, uid, filmeId, listas, onUpdate) {
    if (!listas.length) {
        Swal.fire({
            title: 'Nenhuma lista criada',
            html: `<p style="color:rgba(255,255,255,0.7);font-size:0.88rem;">
                       Você ainda não tem nenhuma lista.<br>
                       Clique em <strong>"Minhas Listas"</strong> para criar a primeira.
                   </p>`,
            icon: 'info',
            confirmButtonText: 'Entendi',
            customClass: { popup: 'suggestion-swal-popup' }
        });
        return;
    }

    const itens = listas.map(l => {
        const jaEsta = (l.filmes || []).includes(filmeId);
        return `
            <button class="btn-toggle-lista" data-id="${l.id}"
                style="display:flex;align-items:center;justify-content:space-between;
                       width:100%;padding:12px 14px;border-radius:10px;margin-bottom:8px;cursor:pointer;
                       border:1px solid ${jaEsta ? 'rgba(34,197,94,0.35)' : 'rgba(255,255,255,0.1)'};
                       background:${jaEsta ? 'rgba(34,197,94,0.08)' : 'rgba(255,255,255,0.03)'};
                       transition:all 0.15s;"
                onmouseover="this.style.borderColor='${jaEsta ? 'rgba(34,197,94,0.6)' : 'rgba(59,130,246,0.4)'}'"
                onmouseout="this.style.borderColor='${jaEsta ? 'rgba(34,197,94,0.35)' : 'rgba(255,255,255,0.1)'}'">
                <div style="text-align:left;">
                    <div style="font-size:0.88rem;font-weight:600;color:rgba(255,255,255,0.92);">
                        <i class="fas fa-bookmark me-2" style="color:${jaEsta ? '#4ade80' : '#a855f7'};"></i>${l.nome}
                    </div>
                    <div style="font-size:0.72rem;color:rgba(255,255,255,0.4);margin-top:2px;">
                        ${(l.filmes||[]).length} filme${(l.filmes||[]).length !== 1 ? 's' : ''}
                    </div>
                </div>
                <span style="font-size:0.8rem;font-weight:500;color:${jaEsta ? '#4ade80' : 'rgba(255,255,255,0.35)'};">
                    ${jaEsta ? '<i class="fas fa-check-circle"></i> Adicionado' : '<i class="fas fa-plus"></i> Adicionar'}
                </span>
            </button>`;
    }).join('');

    Swal.fire({
        title: '<span style="font-size:0.95rem;font-weight:600;"><i class="fas fa-bookmark me-2" style="color:#a855f7;"></i>Adicionar à lista</span>',
        width: 'min(440px, 95vw)',
        html: `<div>${itens}</div>`,
        showConfirmButton: false,
        showCancelButton: true,
        cancelButtonText: 'Fechar',
        customClass: { popup: 'suggestion-swal-popup', cancelButton: 'suggestion-deny-btn' },
        didOpen: () => {
            document.querySelectorAll('.btn-toggle-lista').forEach(btn => {
                btn.addEventListener('click', async () => {
                    btn.disabled = true; btn.style.opacity = '0.6';
                    await toggleFilmeNaLista(db, uid, btn.dataset.id, filmeId, listas);
                    listas = await getListas(db, uid);
                    onUpdate(listas);
                    Swal.close();
                    setTimeout(() => abrirAdicionarALista(db, uid, filmeId, listas, onUpdate), 150);
                });
            });
        }
    });
}