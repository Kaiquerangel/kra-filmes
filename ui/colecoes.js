/**
 * colecoes.js
 * Coleções personalizadas — fluxo claro:
 * 1. "Minhas Listas" abre painel com todas as coleções
 * 2. Clicar numa coleção mostra os filmes dela
 * 3. Em qualquer filme (card ou tabela) botão "Adicionar à Lista"
 */

import { UI } from '../ui.js';

// ─── Firestore ops ──────────────────────────────────────────
async function fsOps() {
    const { collection, addDoc, getDocs, doc, updateDoc, deleteDoc, serverTimestamp }
        = await import("https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js");
    return { collection, addDoc, getDocs, doc, updateDoc, deleteDoc, serverTimestamp };
}

// ─── CRUD ───────────────────────────────────────────────────
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
    lista.filmes = novo; // atualiza em memória
}

// ─── MODAL: Gerenciar coleções ──────────────────────────────
export async function abrirGerenciadorListas(db, uid, todosFilmes, listas, onUpdate) {

    const renderHTML = () => {
        const listasHTML = listas.length
            ? listas.map(l => {
                const qtd = (l.filmes || []).length;
                // Pega até 3 pôsteres para preview
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

                    <!-- Preview de pôsteres -->
                    <div style="display:flex;gap:3px;flex-shrink:0;">
                        ${postersPreview || `<div style="width:28px;height:42px;background:#1e293b;border-radius:3px;display:flex;align-items:center;justify-content:center;"><i class="fas fa-film" style="font-size:0.6rem;color:rgba(255,255,255,0.2);"></i></div>`}
                    </div>

                    <!-- Info -->
                    <div style="flex:1;min-width:0;">
                        <div style="font-size:0.9rem;font-weight:600;color:rgba(255,255,255,0.92);">
                            ${l.nome}
                        </div>
                        <div style="font-size:0.75rem;color:rgba(255,255,255,0.45);margin-top:2px;">
                            ${qtd === 0 ? 'Nenhum filme ainda' : `${qtd} filme${qtd > 1 ? 's' : ''}`}
                            ${l.descricao ? ` · ${l.descricao}` : ''}
                        </div>
                    </div>

                    <!-- Ações -->
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
                   <div style="font-size:0.78rem;color:rgba(255,255,255,0.3);margin-top:4px;">
                       Crie sua primeira lista abaixo!
                   </div>
               </div>`;

        return `
            <!-- Lista das coleções -->
            <div style="max-height:300px;overflow-y:auto;margin-bottom:16px;">
                ${listasHTML}
            </div>

            <!-- Criar nova -->
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
                // Criar lista
                const criar = async () => {
                    const nome = document.getElementById('nova-lista-nome')?.value.trim();
                    const desc = document.getElementById('nova-lista-desc')?.value.trim();
                    if (!nome) {
                        document.getElementById('nova-lista-nome')?.focus();
                        return;
                    }
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

                // Ver filmes de uma lista
                document.querySelectorAll('.btn-colecao-ver').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        const lista = listas.find(l => l.id === btn.dataset.id);
                        if (lista) { Swal.close(); setTimeout(() => verFilmesDaLista(lista, todosFilmes, db, uid, listas, onUpdate, abrirModal), 150); }
                    });
                });

                // Clique no item também abre
                document.querySelectorAll('.colecao-item').forEach(item => {
                    item.addEventListener('click', (e) => {
                        if (e.target.closest('button')) return;
                        const lista = listas.find(l => l.id === item.dataset.id);
                        if (lista) { Swal.close(); setTimeout(() => verFilmesDaLista(lista, todosFilmes, db, uid, listas, onUpdate, abrirModal), 150); }
                    });
                });

                // Excluir lista
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

// ─── Ver filmes de uma coleção ──────────────────────────────
function verFilmesDaLista(lista, todosFilmes, db, uid, listas, onUpdate, onVoltar) {
    const ids = new Set(lista.filmes || []);
    const filmesLista = todosFilmes.filter(f => ids.has(f.id));

    const itens = filmesLista.length
        ? filmesLista.map(f => `
            <div style="display:flex;align-items:center;gap:12px;padding:10px 0;
                        border-bottom:1px solid rgba(255,255,255,0.06);">
                ${f.posterUrl && f.posterUrl !== 'N/A'
                    ? `<img src="${f.posterUrl}" style="width:36px;height:54px;object-fit:cover;border-radius:4px;flex-shrink:0;">`
                    : `<div style="width:36px;height:54px;background:#1e293b;border-radius:4px;flex-shrink:0;display:flex;align-items:center;justify-content:center;"><i class="fas fa-film" style="color:rgba(255,255,255,0.15);font-size:0.75rem;"></i></div>`}
                <div style="flex:1;min-width:0;">
                    <div style="font-size:0.88rem;font-weight:600;color:rgba(255,255,255,0.92);
                                white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                        ${f.titulo}
                    </div>
                    <div style="font-size:0.75rem;color:rgba(255,255,255,0.45);margin-top:2px;">
                        ${f.ano || ''}
                        ${f.nota ? `<span style="color:#fbbf24;"> · ★ ${f.nota.toFixed(1)}</span>` : ''}
                        ${f.assistido ? `<span style="color:#22c55e;"> · Assistido</span>` : `<span style="color:rgba(255,255,255,0.3);"> · Pendente</span>`}
                    </div>
                </div>
                <button class="btn-remover-da-lista" data-id="${f.id}"
                    style="padding:4px 8px;border-radius:5px;border:1px solid rgba(239,68,68,0.2);
                           background:transparent;color:rgba(239,68,68,0.6);font-size:0.7rem;
                           cursor:pointer;flex-shrink:0;" title="Remover desta lista">
                    <i class="fas fa-times"></i>
                </button>
            </div>`).join('')
        : `<div style="text-align:center;padding:32px;color:rgba(255,255,255,0.4);">
               <i class="fas fa-film" style="font-size:2rem;opacity:0.3;display:block;margin-bottom:12px;"></i>
               Esta lista está vazia.<br>
               <span style="font-size:0.78rem;opacity:0.7;">
                   Adicione filmes pelos três pontos ⋮ em qualquer filme.
               </span>
           </div>`;

    Swal.fire({
        title: `<span style="font-size:0.95rem;font-weight:600;">
                    <i class="fas fa-bookmark me-2" style="color:#a855f7;"></i>${lista.nome}
                    <span style="font-size:0.75rem;color:rgba(255,255,255,0.4);font-weight:400;"> · ${filmesLista.length} filme${filmesLista.length !== 1 ? 's' : ''}</span>
                </span>`,
        width: 'min(520px, 95vw)',
        html: `<div style="max-height:420px;overflow-y:auto;">${itens}</div>`,
        showConfirmButton: false,
        showCancelButton: true,
        cancelButtonText: '← Voltar às listas',
        customClass: { popup: 'suggestion-swal-popup', cancelButton: 'suggestion-deny-btn' },
        didOpen: () => {
            document.querySelectorAll('.btn-remover-da-lista').forEach(btn => {
                btn.addEventListener('click', async () => {
                    await toggleFilmeNaLista(db, uid, lista.id, btn.dataset.id, listas);
                    listas = await getListas(db, uid);
                    onUpdate(listas);
                    Swal.close();
                    setTimeout(() => verFilmesDaLista(
                        listas.find(l => l.id === lista.id) || lista,
                        todosFilmes, db, uid, listas, onUpdate, onVoltar
                    ), 150);
                });
            });
        }
    }).then(res => {
        if (res.isDismissed && onVoltar) setTimeout(onVoltar, 150);
    });
}

// ─── MODAL: Adicionar filme a uma lista ─────────────────────
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
                <span style="font-size:0.8rem;font-weight:500;
                             color:${jaEsta ? '#4ade80' : 'rgba(255,255,255,0.35)'};">
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
                    btn.disabled = true;
                    btn.style.opacity = '0.6';
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