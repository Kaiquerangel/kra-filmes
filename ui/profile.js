import { els } from './elements.js';

const toLocaleDateStr = (date) =>
    `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;

// ─────────────────────────────────────────────────────────────────────────────
//  renderProfile — atualiza apenas valores, nunca reescreve estrutura do pai
// ─────────────────────────────────────────────────────────────────────────────
export const renderProfile = (profile, filmes) => {
    if (!profile) return;

    if (els.perfilNome)      els.perfilNome.textContent = profile.nome;
    if (els.perfilNick)      els.perfilNick.textContent = `@${profile.nickname}`;
    if (els.perfilDesde && profile.membroDesde) {
        const d = new Date(profile.membroDesde.seconds * 1000);
        els.perfilDesde.textContent = `Membro desde ${d.toLocaleDateString('pt-BR',{year:'numeric',month:'long'})}`;
    }

    const total       = filmes.length;
    const assistidos  = filmes.filter(f => f.assistido).length;
    const pct         = total ? Math.round((assistidos / total) * 100) : 0;

    if (els.perfilTotal)      els.perfilTotal.textContent     = total;
    if (els.perfilAssistidos) els.perfilAssistidos.textContent = assistidos;

    const engEl = document.getElementById('perfil-engajamento');
    if (engEl) engEl.textContent = `${pct}%`;

    // Avatar — cria só uma vez
    if (!document.getElementById('dynamic-avatar-wrapper')) {
        const ph = document.getElementById('perfil-avatar-placeholder');
        if (ph) {
            const iniciais = profile.nome ? profile.nome.substring(0,2).toUpperCase() : '??';
            ph.insertAdjacentHTML('afterend', `
                <div id="dynamic-avatar-wrapper" style="position:relative;display:inline-block;margin-bottom:1rem;">
                    <div style="width:88px;height:88px;border-radius:50%;
                                background:linear-gradient(135deg,#1a6fff,#0d4fc4);
                                display:flex;align-items:center;justify-content:center;
                                font-size:2rem;font-weight:700;color:#fff;
                                box-shadow:0 0 0 3px #181c27,0 0 0 5px rgba(59,158,255,0.4);">
                        ${iniciais}
                    </div>
                    <span style="position:absolute;bottom:4px;right:4px;
                                 width:14px;height:14px;background:#34d48a;
                                 border-radius:50%;border:3px solid #181c27;"></span>
                </div>`);
            ph.style.display = 'none';
        }
    }

    _renderAnoEmFilmes(filmes);
    _renderHeatmap(filmes);
};

// ─────────────────────────────────────────────────────────────────────────────
//  renderAchievements
// ─────────────────────────────────────────────────────────────────────────────
export const renderAchievements = (conquistas) => {
    const container = els.conquistasContainer;
    if (!container) return;

    if (!conquistas.length) {
        container.innerHTML = '<p class="text-muted">Sem conquistas.</p>';
        return;
    }

    const unlocked = conquistas.filter(c => c.unlocked).length;
    const countEl  = document.getElementById('conquistas-desbloqueadas-count');
    if (countEl) countEl.textContent = `${unlocked} de ${conquistas.length} desbloqueadas`;

    // Grid: sempre 3 colunas no desktop, 2 no mobile, centralizado
    container.innerHTML = `
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;align-items:start;">
            ${conquistas.map(_cardHtml).join('')}
        </div>`;

    // Event listeners seguros (sem inline handlers)
    container.querySelectorAll('.btn-share-conquista').forEach(btn => {
        btn.addEventListener('click', e => {
            e.stopPropagation();
            const txt = `Desbloqueei "${btn.dataset.nome}" no Meus Filmes! 🏆`;
            navigator.clipboard.writeText(txt).then(() =>
                Swal.fire({toast:true,position:'top-end',icon:'success',title:'Copiado!',showConfirmButton:false,timer:2000}));
        });
    });

    container.querySelectorAll('.conquista-card').forEach(card => {
        const def = card.querySelector('.c-default');
        const hov = card.querySelector('.c-hover');
        if (!def || !hov) return;
        card.addEventListener('mouseenter', () => {
            def.style.display = 'none';
            hov.style.display = 'flex';
            card.style.transform = 'translateY(-3px)';
        });
        card.addEventListener('mouseleave', () => {
            hov.style.display = 'none';
            def.style.display = 'flex';
            card.style.transform = 'translateY(0)';
        });
    });
};

// ─────────────────────────────────────────────────────────────────────────────
//  Helpers privados
// ─────────────────────────────────────────────────────────────────────────────
function _cardHtml(c) {
    const ok     = c.unlocked;
    const border = ok ? 'rgba(212,175,55,0.5)'    : 'rgba(255,255,255,0.08)';
    const bg     = ok ? 'rgba(212,175,55,0.06)'   : 'transparent';
    const iconC  = ok ? '#d4af37'                  : 'rgba(255,255,255,0.18)';
    const nameC  = ok ? '#fff'                     : 'rgba(255,255,255,0.35)';

    const badge = ok
        ? `<div style="position:absolute;top:8px;right:8px;width:20px;height:20px;
                       background:#d4af37;border-radius:4px;
                       display:flex;align-items:center;justify-content:center;">
               <i class="fas fa-check" style="font-size:9px;color:#000;"></i>
           </div>`
        : `<div style="position:absolute;top:8px;right:8px;width:20px;height:20px;
                       background:rgba(255,255,255,0.05);border-radius:4px;
                       display:flex;align-items:center;justify-content:center;">
               <i class="fas fa-lock" style="font-size:9px;color:rgba(255,255,255,0.2);"></i>
           </div>`;

    // Footer padrão: sempre mostra descricao + progresso
    const progress = ok
        ? `<div style="text-align:center;">
               <span style="font-size:0.72rem;color:#d4af37;display:block;"><i class="fas fa-check me-1"></i>Concluída</span>
               <span style="font-size:0.65rem;color:rgba(255,255,255,0.28);display:block;margin-top:3px;line-height:1.3;">${c.descricao}</span>
           </div>`
        : `<div style="text-align:center;">
               ${c.target ? `<span style="font-size:0.78rem;font-weight:600;color:rgba(255,255,255,0.4);display:block;">${c.progress ?? 0} / ${c.target}</span>` : ''}
               <span style="font-size:0.65rem;color:rgba(255,255,255,0.28);display:block;margin-top:3px;line-height:1.3;">${c.descricao}</span>
           </div>`;

    // Hover: compartilhar (desbloqueada) ou apenas descricao mais legível (bloqueada)
    const shareBtn = ok
        ? `<div style="text-align:center;">
               <button class="btn-share-conquista" data-nome="${c.nome.replace(/"/g,'&quot;')}"
                   style="background:none;border:none;color:#3b9eff;font-size:0.75rem;
                          cursor:pointer;display:flex;align-items:center;gap:4px;padding:0;margin:0 auto;">
                   <i class="fas fa-share-alt"></i> Compartilhar
               </button>
           </div>`
        : `<div style="text-align:center;">
               ${c.target ? `<span style="font-size:0.78rem;font-weight:600;color:rgba(255,255,255,0.4);display:block;">${c.progress ?? 0} / ${c.target}</span>` : ''}
               <span style="font-size:0.65rem;color:rgba(255,255,255,0.35);display:block;margin-top:3px;line-height:1.3;">${c.descricao}</span>
           </div>`;

    return `
        <div class="conquista-card" style="position:relative;border:1px solid ${border};
             border-radius:10px;background:${bg};padding:14px 12px 12px;
             display:flex;flex-direction:column;align-items:center;text-align:center;
             transition:transform 0.18s ease,border-color 0.18s ease;cursor:default;">
            ${badge}
            <i class="${c.icone} fa-lg mb-2" style="color:${iconC};"></i>
            <span style="font-size:0.82rem;font-weight:600;color:${nameC};line-height:1.2;margin-bottom:auto;padding-bottom:8px;">${c.nome}</span>
            <!-- default footer -->
            <div class="c-default" style="display:flex;align-items:center;justify-content:center;width:100%;">
                ${progress}
            </div>
            <!-- hover footer -->
            <div class="c-hover" style="display:none;align-items:center;justify-content:center;width:100%;">
                ${shareBtn}
            </div>
        </div>`;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Heatmap estilo GitHub
// ─────────────────────────────────────────────────────────────────────────────
function _renderAnoEmFilmes(filmes) {
    const wrapper = document.getElementById('ano-em-filmes-wrapper');
    if (!wrapper) return;

    const anoAtual = new Date().getFullYear();
    const assistidosAno = filmes.filter(f => f.assistido && f.dataAssistido && f.dataAssistido.startsWith(String(anoAtual)));
    const assistidosAnoAnterior = filmes.filter(f => f.assistido && f.dataAssistido && f.dataAssistido.startsWith(String(anoAtual - 1)));

    if (!assistidosAno.length) { wrapper.innerHTML = ''; return; }

    // Gênero do ano
    const genCount = {};
    assistidosAno.forEach(f => (f.genero || []).forEach(g => { genCount[g] = (genCount[g] || 0) + 1; }));
    const topGeneroAno = Object.entries(genCount).sort((a,b) => b[1]-a[1])[0];

    // Diretor do ano
    const dirCount = {};
    assistidosAno.forEach(f => (f.direcao || []).forEach(d => { if(d) dirCount[d] = (dirCount[d] || 0) + 1; }));
    const topDirAno = Object.entries(dirCount).sort((a,b) => b[1]-a[1])[0];

    // Nota média do ano
    const mediAno = assistidosAno.filter(f => f.nota).reduce((s,f) => s+f.nota, 0) / (assistidosAno.filter(f=>f.nota).length || 1);

    // Comparativo com ano anterior
    const diff = assistidosAno.length - assistidosAnoAnterior.length;
    const diffTxt = diff > 0
        ? `<span style="color:#22c55e;">↑ ${diff}a mais que em ${anoAtual-1}</span>`
        : diff < 0
        ? `<span style="color:#f87171;">↓ ${Math.abs(diff)} a menos que em ${anoAtual-1}</span>`
        : `<span style="color:rgba(255,255,255,0.4);">igual a ${anoAtual-1}</span>`;

    wrapper.innerHTML = `
        <div style="border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:1.25rem;background:rgba(255,255,255,0.02);margin-bottom:1.5rem;">
            <h5 style="font-size:0.9rem;font-weight:700;color:rgba(255,255,255,0.55);text-transform:uppercase;letter-spacing:0.06em;margin:0 0 1rem;">
                Seu ${anoAtual} em Filmes
            </h5>
            <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:10px;">
                <div style="background:rgba(59,130,246,0.08);border:1px solid rgba(59,130,246,0.2);border-radius:8px;padding:12px;text-align:center;">
                    <div style="font-size:2rem;font-weight:800;color:#3b9eff;">${assistidosAno.length}</div>
                    <div style="font-size:0.72rem;color:rgba(255,255,255,0.4);margin-top:2px;">filmes em ${anoAtual} · ${diffTxt}</div>
                </div>
                <div style="background:rgba(168,85,247,0.08);border:1px solid rgba(168,85,247,0.2);border-radius:8px;padding:12px;text-align:center;">
                    <div style="font-size:2rem;font-weight:800;color:#a855f7;">${mediAno.toFixed(1)}</div>
                    <div style="font-size:0.72rem;color:rgba(255,255,255,0.4);margin-top:2px;">nota média do ano</div>
                </div>
                <div style="background:rgba(245,200,66,0.06);border:1px solid rgba(245,200,66,0.15);border-radius:8px;padding:12px;text-align:center;">
                    <div style="font-size:0.95rem;font-weight:700;color:#f5c842;">${topGeneroAno ? topGeneroAno[0] : '-'}</div>
                    <div style="font-size:0.72rem;color:rgba(255,255,255,0.4);margin-top:2px;">gênero favorito do ano</div>
                </div>
                <div style="background:rgba(34,197,94,0.06);border:1px solid rgba(34,197,94,0.15);border-radius:8px;padding:12px;text-align:center;">
                    <div style="font-size:0.88rem;font-weight:700;color:#22c55e;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${topDirAno ? topDirAno[0].split(' ').slice(-1)[0] : '-'}</div>
                    <div style="font-size:0.72rem;color:rgba(255,255,255,0.4);margin-top:2px;">diretor mais assistido</div>
                </div>
            </div>
        </div>`;
}

function _renderHeatmap(filmes) {
    if (!document.getElementById('heatmap-css')) {
        document.head.insertAdjacentHTML('beforeend', `
            <style id="heatmap-css">
                #heatmap-scroll-inner::-webkit-scrollbar{height:4px;}
                #heatmap-scroll-inner::-webkit-scrollbar-track{background:transparent;}
                #heatmap-scroll-inner::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.1);border-radius:4px;}
                #heatmap-scroll-inner::-webkit-scrollbar-thumb:hover{background:rgba(255,255,255,0.2);}
            </style>`);
    }

    const wrapper = document.getElementById('heatmap-wrapper');
    if (!wrapper) return;

    const hoje  = new Date(); hoje.setHours(0,0,0,0);
    const inicio = new Date(hoje);
    inicio.setDate(inicio.getDate() - 364);
    inicio.setDate(inicio.getDate() - inicio.getDay()); // recua ao domingo

    // Mapa de contagens por data (sem fuso)
    const mapa = {};
    let totalAno = 0;
    filmes.forEach(f => {
        if (f.assistido && f.dataAssistido) {
            const d = new Date(f.dataAssistido.replace(/-/g,'/'));
            if (d >= inicio && d <= hoje) {
                const k = toLocaleDateStr(d);
                mapa[k] = (mapa[k] || 0) + 1;
                totalAno++;
            }
        }
    });

    const diasAtivos = Object.keys(mapa).length;
    const maxVal     = Math.max(...Object.values(mapa), 1);

    const CORES  = ['rgba(255,255,255,0.05)','#0e4429','#006d32','#26a641','#39d353'];
    const MESES  = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
    const DSEM   = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];

    function nivel(n) {
        if (!n) return 0;
        if (n === 1) return 1;
        if (n <= Math.ceil(maxVal * 0.33)) return 2;
        if (n <= Math.ceil(maxVal * 0.66)) return 3;
        return 4;
    }

    // Monta colunas (semanas)
    const CELL = 11; // px
    const GAP  = 3;  // px
    const ROW  = CELL + GAP; // 14px por linha

    let colsHtml  = '';
    let lastMonth = -1;
    let cur       = new Date(inicio);

    while (cur <= hoje) {
        let monthTxt = '';
        let cells    = '';

        for (let d = 0; d < 7; d++) {
            const dt      = new Date(cur);
            dt.setDate(dt.getDate() + d);
            if (dt.getMonth() !== lastMonth && dt <= hoje) {
                monthTxt = MESES[dt.getMonth()];
                lastMonth = dt.getMonth();
            }
            const future  = dt > hoje;
            const k       = toLocaleDateStr(dt);
            const cnt     = mapa[k] || 0;
            const color   = future ? 'transparent' : CORES[nivel(cnt)];
            const dtFmt   = dt.toLocaleDateString('pt-BR',{day:'2-digit',month:'short',year:'numeric'});
            const tip     = future ? '' : (cnt ? `${cnt} filme(s) — ${dtFmt}` : `Nenhum — ${dtFmt}`);
            cells += `<div title="${tip}"
                style="width:${CELL}px;height:${CELL}px;background:${color};border-radius:2px;
                       cursor:${future?'default':'crosshair'};transition:transform .1s;"
                onmouseover="this.style.transform='scale(1.4)'"
                onmouseout="this.style.transform='scale(1)'"></div>`;
        }

        colsHtml += `
            <div style="display:flex;flex-direction:column;gap:${GAP}px;flex-shrink:0;">
                <div style="height:16px;font-size:0.6rem;color:rgba(255,255,255,0.38);
                            white-space:nowrap;line-height:16px;">${monthTxt}</div>
                ${cells}
            </div>`;

        cur.setDate(cur.getDate() + 7);
    }

    // Dias da semana (eixo Y)
    const eixoY = DSEM.map((d,i) =>
        `<div style="height:${ROW}px;font-size:0.58rem;color:rgba(255,255,255,0.32);
                     line-height:${ROW}px;text-align:right;padding-right:5px;
                     ${![0,3,6].includes(i)?'visibility:hidden;':''}">${d}</div>`
    ).join('');

    wrapper.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;
                    margin-bottom:10px;flex-wrap:wrap;gap:8px;">
            <h5 style="margin:0;font-weight:700;color:#fff;font-size:0.95rem;
                       display:flex;align-items:center;gap:8px;">
                <i class="fas fa-calendar-alt" style="color:#3b9eff;font-size:0.85rem;"></i>
                Atividade de Visualização
            </h5>
            <span style="font-size:0.78rem;color:rgba(255,255,255,0.4);">
                <strong style="color:#3b9eff;">${totalAno}</strong> filmes em
                <strong style="color:#3b9eff;">${diasAtivos}</strong> dias no último ano
            </span>
        </div>

        <div style="background:#151a23;border:1px solid rgba(255,255,255,0.05);
                    border-radius:12px;padding:14px 16px;">
            <div style="display:flex;gap:4px;align-items:flex-start;">
                <!-- Eixo Y -->
                <div style="display:flex;flex-direction:column;padding-top:16px;flex-shrink:0;">
                    ${eixoY}
                </div>
                <!-- Grade de semanas com scroll suave -->
                <div id="heatmap-scroll-inner"
                     style="display:flex;gap:${GAP}px;overflow-x:auto;
                            padding-bottom:6px;flex:1;">
                    ${colsHtml}
                </div>
            </div>
            <!-- Legenda -->
            <div style="display:flex;align-items:center;justify-content:flex-end;
                        gap:5px;margin-top:8px;">
                <span style="font-size:0.65rem;color:rgba(255,255,255,0.3);">Menos</span>
                ${CORES.map(c=>`<div style="width:10px;height:10px;background:${c};border-radius:2px;"></div>`).join('')}
                <span style="font-size:0.65rem;color:rgba(255,255,255,0.3);">Mais</span>
            </div>
        </div>`;
}