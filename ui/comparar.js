/**
 * comparar.js — Comparar perfil com amigo
 */
import { UI } from '../ui.js';

async function buscarPerfilPublico(db, identificador) {
    const { collection, getDocs, query: fsQuery, where, doc, getDoc }
        = await import("https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js");

    // Detecta se é UID direto (20+ chars alfanuméricos sem @ ou /)
    const pareceUid = /^[a-zA-Z0-9]{20,}$/.test(identificador.trim());
    let uid = null;

    if (pareceUid) {
        // Link gerado pelo QR Code — usa UID diretamente (getDoc, sem query)
        uid = identificador.trim();
    } else {
        // Digitou @nickname ou link antigo com ?u=nickname
        const nickSemArroba = identificador.replace('@','').trim();
        const nickComArroba = '@' + nickSemArroba;

        // Tenta as 4 combinações: com/sem @ e com/sem lowercase
        const tentativas = [
            nickSemArroba,
            nickSemArroba.toLowerCase(),
            nickComArroba,
            nickComArroba.toLowerCase(),
        ].filter((v, i, arr) => arr.indexOf(v) === i); // remove duplicatas

        let snap = null;
        for (const tentativa of tentativas) {
            snap = await getDocs(fsQuery(collection(db, 'users'), where('nickname','==', tentativa)));
            if (!snap.empty) break;
        }

        if (!snap || snap.empty) throw new Error(`Usuário @${nickSemArroba} não encontrado.`);
        uid = snap.docs[0].id;
    }

    const perfilSnap = await getDoc(doc(db, 'users', uid));
    if (!perfilSnap.exists()) throw new Error('Perfil não encontrado.');
    const perfil = { uid, ...perfilSnap.data() };

    // Bloqueia apenas se explicitamente marcado como privado
    if (perfil.publico === false) throw new Error('Este perfil é privado.');

    let filmes = [];
    try {
        const filmesSnap = await getDocs(collection(db, 'users', uid, 'filmes'));
        filmes = filmesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch(e) {
        throw new Error('Não foi possível acessar os filmes deste perfil. O perfil pode ser privado.');
    }

    return { perfil, filmes };
}

function calcularStats(filmes) {
    const assistidos = filmes.filter(f => f.assistido);
    const comNota    = assistidos.filter(f => f.nota);
    const media      = comNota.length
        ? parseFloat((comNota.reduce((s,f) => s + f.nota, 0) / comNota.length).toFixed(1)) : 0;
    const genCount = {};
    assistidos.forEach(f => (f.genero||[]).forEach(g => { genCount[g] = (genCount[g]||0)+1; }));
    const topGenero = Object.entries(genCount).sort((a,b) => b[1]-a[1])[0]?.[0] || '-';
    const dirCount = {};
    assistidos.forEach(f => (f.direcao||[]).forEach(d => { if(d) dirCount[d] = (dirCount[d]||0)+1; }));
    const topDir = Object.entries(dirCount).sort((a,b) => b[1]-a[1])[0]?.[0] || '-';
    return { total: filmes.length, assistidos: assistidos.length, media, topGenero, topDir };
}

export async function mostrarComparacao(db, meuUid, meusFilmes, meuPerfil) {
    const { value: identificador } = await Swal.fire({
        title: '<span style="font-size:1.1rem;font-weight:700;color:#fff;">🤝 Comparar com Amigo</span>',
        width: 'min(460px, 95vw)',
        background: '#1e293b',
        color: '#f1f5f9',
        html: `
            <p style="font-size:0.88rem;color:#94a3b8;margin-bottom:16px;">
                Digite o nickname ou cole o link público do perfil do seu amigo.
            </p>
            <input id="input-comparar" placeholder="@nickname ou link do perfil"
                style="width:100%;padding:11px 14px;border-radius:8px;font-size:0.9rem;
                       border:1px solid #334155;background:#0f172a;color:#f1f5f9;outline:none;
                       box-sizing:border-box;">
            <p style="font-size:0.78rem;color:#64748b;margin-top:8px;">
                Ex: <strong style="color:#94a3b8;">kaique-rangel</strong> ou link do perfil público
            </p>`,
        showCancelButton: true,
        confirmButtonText: 'Comparar →',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#3b82f6',
        customClass: { popup: 'suggestion-swal-popup' },
        preConfirm: () => {
            const v = document.getElementById('input-comparar').value.trim();
            if (!v) { Swal.showValidationMessage('Digite um nickname ou link.'); return false; }
            return v;
        }
    });
    if (!identificador) return;

    Swal.fire({
        background: '#1e293b',
        html: `<div style="text-align:center;padding:24px;">
                   <i class="fas fa-spinner fa-spin fa-2x" style="color:#3b82f6;"></i>
                   <p style="margin-top:12px;color:#94a3b8;font-size:0.9rem;">Buscando perfil...</p>
               </div>`,
        showConfirmButton: false, allowOutsideClick: false,
        customClass: { popup: 'suggestion-swal-popup' }
    });

    let amigo;
    try {
        amigo = await buscarPerfilPublico(db, identificador);
    } catch(e) {
        Swal.fire({ title: 'Erro', text: e.message, icon: 'warning',
            background: '#1e293b', color: '#f1f5f9',
            customClass: { popup: 'suggestion-swal-popup' } });
        return;
    }

    const euStats    = calcularStats(meusFilmes);
    const amigoStats = calcularStats(amigo.filmes);
    const euNome     = meuPerfil?.nome || 'Você';
    const amigoNome  = amigo.perfil.nome || amigo.perfil.nickname || 'Amigo';

    // Filmes em comum
    const meuIndex = new Map(meusFilmes.map(f => [`${f.titulo?.toLowerCase()}|${f.ano}`, f]));
    const emComum  = amigo.filmes.filter(f => meuIndex.has(`${f.titulo?.toLowerCase()}|${f.ano}`));

    // Divergências de nota
    const divergencias = emComum
        .map(fa => {
            const meu  = meuIndex.get(`${fa.titulo?.toLowerCase()}|${fa.ano}`);
            const diff = Math.abs((meu?.nota||0) - (fa.nota||0));
            return { titulo: fa.titulo, minhaNota: meu?.nota||0, notaAmigo: fa.nota||0, diff };
        })
        .filter(d => d.diff >= 1.5)
        .sort((a,b) => b.diff - a.diff)
        .slice(0, 5);

    // O amigo recomenda
    const meuSet      = new Set(meusFilmes.map(f => `${f.titulo?.toLowerCase()}|${f.ano}`));
    const recomendados = amigo.filmes
        .filter(f => f.assistido && !meuSet.has(`${f.titulo?.toLowerCase()}|${f.ano}`) && (f.nota||0) >= 7)
        .sort((a,b) => (b.nota||0) - (a.nota||0))
        .slice(0, 5);

    // ── HTML ──
    const statRow = (label, v1, v2, maior = true) => {
        const euVence    = maior ? Number(v1) > Number(v2) : false;
        const amigoVence = maior ? Number(v2) > Number(v1) : false;
        return `
        <tr>
            <td style="text-align:right;padding:10px 12px;font-size:0.95rem;font-weight:700;
                       color:${euVence ? '#4ade80' : '#f1f5f9'};">${v1}</td>
            <td style="text-align:center;padding:10px 8px;font-size:0.72rem;color:#64748b;
                       text-transform:uppercase;letter-spacing:0.06em;white-space:nowrap;">${label}</td>
            <td style="text-align:left;padding:10px 12px;font-size:0.95rem;font-weight:700;
                       color:${amigoVence ? '#60a5fa' : '#f1f5f9'};">${v2}</td>
        </tr>`;
    };

    const statRowText = (label, v1, v2) => `
        <tr>
            <td style="text-align:right;padding:8px 12px;font-size:0.82rem;color:#e2e8f0;">${v1}</td>
            <td style="text-align:center;padding:8px 8px;font-size:0.72rem;color:#64748b;
                       text-transform:uppercase;letter-spacing:0.06em;white-space:nowrap;">${label}</td>
            <td style="text-align:left;padding:8px 12px;font-size:0.82rem;color:#e2e8f0;">${v2}</td>
        </tr>`;

    const divHTML = divergencias.length
        ? divergencias.map(d => `
            <div style="display:flex;justify-content:space-between;align-items:center;
                        padding:8px 0;border-bottom:1px solid #1e293b;">
                <span style="font-size:0.85rem;color:#e2e8f0;flex:1;min-width:0;
                             white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${d.titulo}</span>
                <div style="display:flex;align-items:center;gap:10px;flex-shrink:0;margin-left:10px;">
                    <span style="font-size:0.85rem;font-weight:600;color:#4ade80;">★ ${d.minhaNota.toFixed(1)}</span>
                    <span style="font-size:0.72rem;color:#475569;">vs</span>
                    <span style="font-size:0.85rem;font-weight:600;color:#60a5fa;">★ ${d.notaAmigo.toFixed(1)}</span>
                </div>
            </div>`).join('')
        : `<p style="font-size:0.85rem;color:#64748b;text-align:center;padding:12px 0;">
               Nenhuma divergência grande nas notas 🤝
           </p>`;

    const recHTML = recomendados.length
        ? recomendados.map(f => `
            <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid #1e293b;">
                ${f.posterUrl && f.posterUrl !== 'N/A'
                    ? `<img src="${f.posterUrl}" style="width:32px;height:48px;object-fit:cover;border-radius:4px;flex-shrink:0;">`
                    : `<div style="width:32px;height:48px;background:#0f172a;border-radius:4px;flex-shrink:0;"></div>`}
                <div style="min-width:0;">
                    <div style="font-size:0.88rem;color:#f1f5f9;font-weight:500;
                                white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${f.titulo}</div>
                    <div style="font-size:0.75rem;color:#fbbf24;">★ ${f.nota?.toFixed(1)||'N/A'} por ${amigoNome}</div>
                </div>
            </div>`).join('')
        : `<p style="font-size:0.85rem;color:#64748b;text-align:center;padding:12px 0;">
               Você já assistiu tudo que ${amigoNome} recomendaria! 🎬
           </p>`;

    Swal.fire({
        background: '#1e293b',
        color: '#f1f5f9',
        title: `<span style="font-size:1rem;font-weight:700;color:#f1f5f9;">⚡ ${euNome} vs ${amigoNome}</span>`,
        width: 'min(600px, 95vw)',
        html: `
        <div style="overflow-y:auto;max-height:72vh;">

            <!-- Cabeçalho nomes -->
            <div style="display:grid;grid-template-columns:1fr 40px 1fr;align-items:center;
                        gap:8px;margin-bottom:16px;padding:12px;
                        background:#0f172a;border-radius:10px;">
                <div style="text-align:right;">
                    <div style="font-size:1rem;font-weight:700;color:#4ade80;">${euNome}</div>
                    <div style="font-size:0.75rem;color:#64748b;">@${meuPerfil?.nickname||''}</div>
                </div>
                <div style="text-align:center;font-size:1.3rem;">⚡</div>
                <div style="text-align:left;">
                    <div style="font-size:1rem;font-weight:700;color:#60a5fa;">${amigoNome}</div>
                    <div style="font-size:0.75rem;color:#64748b;">@${amigo.perfil.nickname||''}</div>
                </div>
            </div>

            <!-- Stats -->
            <table style="width:100%;border-collapse:collapse;margin-bottom:16px;
                          background:#0f172a;border-radius:10px;overflow:hidden;">
                ${statRow('Cadastrados',  euStats.total,      amigoStats.total)}
                ${statRow('Assistidos',   euStats.assistidos, amigoStats.assistidos)}
                ${statRow('Nota média',   euStats.media,      amigoStats.media)}
                ${statRowText('Gênero fav.',   euStats.topGenero,  amigoStats.topGenero)}
                ${statRowText('Dir. favorito', euStats.topDir,      amigoStats.topDir)}
            </table>

            <!-- Filmes em comum -->
            <div style="text-align:center;padding:14px;background:#0f172a;border-radius:10px;margin-bottom:16px;">
                <div style="font-size:2rem;font-weight:800;color:#f1f5f9;">${emComum.length}</div>
                <div style="font-size:0.8rem;color:#64748b;">filmes em comum na coleção</div>
            </div>

            <!-- Divergências -->
            <div style="background:#0f172a;border-radius:10px;padding:14px;margin-bottom:16px;">
                <p style="font-size:0.75rem;color:#64748b;text-transform:uppercase;
                           letter-spacing:0.07em;margin-bottom:10px;font-weight:600;">
                    Maiores divergências de nota
                    <span style="color:#4ade80;margin-left:6px;">você</span>
                    <span style="color:#475569;"> vs </span>
                    <span style="color:#60a5fa;">${amigoNome}</span>
                </p>
                ${divHTML}
            </div>

            <!-- Recomendações -->
            ${recomendados.length ? `
            <div style="background:#0f172a;border-radius:10px;padding:14px;">
                <p style="font-size:0.75rem;color:#64748b;text-transform:uppercase;
                           letter-spacing:0.07em;margin-bottom:10px;font-weight:600;">
                    ${amigoNome} recomenda — você ainda não assistiu
                </p>
                ${recHTML}
            </div>` : ''}

        </div>`,
        showConfirmButton: false,
        showCancelButton: true,
        cancelButtonText: 'Fechar',
        customClass: { popup: 'suggestion-swal-popup', cancelButton: 'suggestion-deny-btn' }
    });
}