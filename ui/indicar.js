/**
 * indicar.js
 * Fluxo: filtrar gênero → sortear ou escolher → ver card → compartilhar/trocar/cancelar
 */

// ─────────────────────────────────────────────────────────────
// GERADOR DE CARD — Canvas nativo
// ─────────────────────────────────────────────────────────────

async function carregarImagem(url) {
    if (!url || url === 'N/A') return null;

    // Tenta carregar via proxy CORS (allorigins) para permitir uso no canvas
    const resized = url.replace(/\._V1_.*\.jpg/i, '._V1_SX400_.jpg');
    const proxyUrl = `https://wsrv.nl/?url=${encodeURIComponent(resized)}&w=400&output=jpg`;

    const tentar = (src) => new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload  = () => resolve(img);
        img.onerror = () => resolve(null);
        img.src = src;
        setTimeout(() => resolve(null), 5000);
    });

    // Tenta proxy primeiro, depois URL direta como fallback
    return (await tentar(proxyUrl)) || (await tentar(resized));
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight, maxLines = 2) {
    const words = text.split(' ');
    let line = '', currentY = y, lineCount = 0;
    for (let n = 0; n < words.length; n++) {
        const testLine = line + words[n] + ' ';
        if (ctx.measureText(testLine).width > maxWidth && n > 0) {
            if (lineCount >= maxLines - 1) {
                ctx.fillText(line.trim().replace(/\s*$/, '…'), x, currentY);
                return currentY;
            }
            ctx.fillText(line.trim(), x, currentY);
            line = words[n] + ' ';
            currentY += lineHeight;
            lineCount++;
        } else {
            line = testLine;
        }
    }
    ctx.fillText(line.trim(), x, currentY);
    return currentY;
}

async function gerarCardIndicacao(filme, nomeUsuario = 'Um amigo') {
    const W = 600, H = 340;
    const canvas = document.createElement('canvas');
    canvas.width  = W * 2;
    canvas.height = H * 2;
    canvas.style.width  = W + 'px';
    canvas.style.height = H + 'px';
    const ctx = canvas.getContext('2d');
    ctx.scale(2, 2);

    // Fundo
    const grad = ctx.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, '#0d1628'); grad.addColorStop(0.6, '#111827'); grad.addColorStop(1, '#0a1020');
    ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H);

    // Borda acento esquerdo
    const acc = ctx.createLinearGradient(0, 0, 0, H);
    acc.addColorStop(0, '#3b82f6'); acc.addColorStop(1, '#6366f1');
    ctx.fillStyle = acc; ctx.fillRect(0, 0, 4, H);

    // Pôster
    const PW = 140, PH = 210, PX = 24, PY = (H - PH) / 2, PR = 8;
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(PX, PY, PW, PH, PR);
    ctx.clip();
    const posterImg = await carregarImagem(filme.posterUrl);
    if (posterImg) {
        ctx.drawImage(posterImg, PX, PY, PW, PH);
    } else {
        ctx.fillStyle = '#1e293b'; ctx.fillRect(PX, PY, PW, PH);
        ctx.font = '36px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText('🎬', PX + PW / 2, PY + PH / 2 + 12);
    }
    ctx.restore();
    ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(PX, PY, PW, PH, PR); ctx.stroke();

    // Área texto
    const TX = PX + PW + 20, TW = W - TX - 20;
    let TY = 48;

    // "indicado por"
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.font = '500 11px Inter,sans-serif'; ctx.textAlign = 'left';
    ctx.fillText(`🎬  ${nomeUsuario} indica:`, TX, TY);
    TY += 22;

    // Título
    ctx.fillStyle = '#f0f4ff';
    ctx.font = 'bold 21px Inter,sans-serif';
    TY = wrapText(ctx, filme.titulo, TX, TY, TW, 27) + 16;

    // Separador
    ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(TX, TY); ctx.lineTo(TX + TW, TY); ctx.stroke();
    TY += 14;

    // Ano + origem
    const meta = [
        filme.ano ? `📅 ${filme.ano}` : '',
        filme.origem === 'Nacional' ? '🇧🇷 Nacional' : filme.origem === 'Internacional' ? '🌍 Internacional' : ''
    ].filter(Boolean).join('   ');
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.font = '13px Inter,sans-serif';
    ctx.fillText(meta, TX, TY); TY += 20;

    // Direção
    if (filme.direcao?.length) {
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.font = '12px Inter,sans-serif';
        ctx.fillText(`Dir. ${filme.direcao.slice(0,2).join(', ')}`, TX, TY);
        TY += 18;
    }

    // Gêneros (pills)
    if (filme.genero?.length) {
        TY += 6;
        let gX = TX;
        for (const g of filme.genero.slice(0, 3)) {
            ctx.font = '500 10px Inter,sans-serif';
            const tw = ctx.measureText(g).width, pH = 20, pW = tw + 16;
            ctx.fillStyle = 'rgba(59,130,246,0.18)';
            ctx.beginPath(); ctx.roundRect(gX, TY, pW, pH, 10); ctx.fill();
            ctx.strokeStyle = 'rgba(59,130,246,0.35)'; ctx.lineWidth = 0.8;
            ctx.beginPath(); ctx.roundRect(gX, TY, pW, pH, 10); ctx.stroke();
            ctx.fillStyle = '#93c5fd'; ctx.textAlign = 'center';
            ctx.fillText(g, gX + pW / 2, TY + 13); ctx.textAlign = 'left';
            gX += pW + 6;
        }
        TY += 30;
    }

    // Nota (se assistido)
    if (filme.assistido && filme.nota) {
        TY += 4;
        const bW = 72, bH = 32;
        const bG = ctx.createLinearGradient(TX, TY, TX + bW, TY + bH);
        bG.addColorStop(0, 'rgba(251,191,36,0.22)'); bG.addColorStop(1, 'rgba(245,158,11,0.1)');
        ctx.fillStyle = bG;
        ctx.beginPath(); ctx.roundRect(TX, TY, bW, bH, 8); ctx.fill();
        ctx.strokeStyle = 'rgba(251,191,36,0.3)'; ctx.lineWidth = 0.8;
        ctx.beginPath(); ctx.roundRect(TX, TY, bW, bH, 8); ctx.stroke();
        ctx.fillStyle = '#fbbf24'; ctx.font = 'bold 17px Inter,sans-serif';
        ctx.fillText(`★ ${filme.nota.toFixed(1)}`, TX + 9, TY + 21);
        ctx.fillStyle = 'rgba(255,255,255,0.28)'; ctx.font = '10px Inter,sans-serif';
        ctx.fillText('minha nota / 10', TX + bW + 8, TY + 19);
    }

    // Rodapé
    ctx.fillStyle = 'rgba(255,255,255,0.06)'; ctx.fillRect(0, H - 30, W, 30);
    ctx.fillStyle = 'rgba(255,255,255,0.22)'; ctx.font = '500 11px Inter,sans-serif';
    ctx.textAlign = 'left'; ctx.fillText('Meus Filmes', 16, H - 10);
    ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.font = '10px Inter,sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(window.location.hostname || 'meusfilmes.app', W - 16, H - 10);

    return canvas;
}

// ─────────────────────────────────────────────────────────────
// PASSO 3 — Preview do card + ações
// ─────────────────────────────────────────────────────────────

async function mostrarPreviewCard(filme, nomeUsuario, todosFilmes, generosAtivos) {
    const posterPreview = (filme.posterUrl && filme.posterUrl !== 'N/A')
        ? `<img src="${filme.posterUrl.replace(/\._V1_.*\.jpg/i,'._V1_SX200_.jpg')}"
                style="width:60px;border-radius:6px;box-shadow:0 4px 12px rgba(0,0,0,0.5);margin-bottom:10px;"
                onerror="this.style.display='none'">`
        : '';

    Swal.fire({
        title: '',
        html: `<div class="text-center py-4">
                   ${posterPreview}
                   <i class="fas fa-spinner fa-spin fa-2x" style="color:#3b82f6;display:block;"></i>
                   <p style="color:rgba(255,255,255,0.4);margin-top:12px;font-size:0.85rem;">Gerando card para <strong style="color:rgba(255,255,255,0.7);">${filme.titulo}</strong>...</p>
               </div>`,
        showConfirmButton: false, allowOutsideClick: false,
        customClass: { popup: 'suggestion-swal-popup' }
    });

    const canvas  = await gerarCardIndicacao(filme, nomeUsuario);
    const dataUrl = canvas.toDataURL('image/png');

    const textoBase =
        `🎬 *${filme.titulo}*\n` +
        (filme.ano ? `📅 ${filme.ano}\n` : '') +
        (filme.genero?.length ? `🎭 ${filme.genero.slice(0,3).join(', ')}\n` : '') +
        (filme.assistido ? `⭐ Nota: ${filme.nota?.toFixed(1) || 'N/A'}/10` : `📋 Na minha lista`);
    const whatsUrl = `https://wa.me/?text=${encodeURIComponent(textoBase)}`;

    Swal.fire({
        title: `<span style="font-size:0.95rem;font-weight:600;color:rgba(255,255,255,0.7);">Indicar: ${filme.titulo}</span>`,
        width: 'min(660px, 95vw)',
        html: `
            <div style="text-align:center;">
                <!-- Preview do card -->
                <div style="border-radius:10px;overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,0.6);
                            display:inline-block;max-width:100%;margin-bottom:16px;">
                    <img src="${dataUrl}" style="width:100%;max-width:600px;display:block;" alt="Card">
                </div>

                <!-- Ações -->
                <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-bottom:10px;">
                    <a href="${dataUrl}"
                       download="indicacao-${filme.titulo.replace(/[^a-z0-9]/gi,'_').toLowerCase()}.png"
                       style="display:inline-flex;align-items:center;gap:7px;padding:9px 18px;
                              background:rgba(59,130,246,0.15);border:1px solid rgba(59,130,246,0.35);
                              border-radius:8px;color:#93c5fd;font-size:0.82rem;text-decoration:none;">
                        <i class="fas fa-download"></i> Salvar imagem
                    </a>
                    <a href="${whatsUrl}" target="_blank" rel="noopener"
                       style="display:inline-flex;align-items:center;gap:7px;padding:9px 18px;
                              background:rgba(37,211,102,0.12);border:1px solid rgba(37,211,102,0.3);
                              border-radius:8px;color:#4ade80;font-size:0.82rem;text-decoration:none;">
                        <i class="fab fa-whatsapp"></i> WhatsApp
                    </a>
                    <button id="btn-copiar-texto-indicar"
                       style="display:inline-flex;align-items:center;gap:7px;padding:9px 18px;
                              background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);
                              border-radius:8px;color:rgba(255,255,255,0.5);font-size:0.82rem;cursor:pointer;">
                        <i class="fas fa-copy"></i> Copiar texto
                    </button>
                </div>

                <!-- Trocar -->
                <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;">
                    <button id="btn-indicar-sortear-outro"
                       style="display:inline-flex;align-items:center;gap:7px;padding:8px 16px;
                              background:transparent;border:1px solid rgba(255,255,255,0.1);
                              border-radius:8px;color:rgba(255,255,255,0.4);font-size:0.8rem;cursor:pointer;">
                        <i class="fas fa-dice"></i> Sortear outro
                    </button>
                    <button id="btn-indicar-escolher"
                       style="display:inline-flex;align-items:center;gap:7px;padding:8px 16px;
                              background:transparent;border:1px solid rgba(255,255,255,0.1);
                              border-radius:8px;color:rgba(255,255,255,0.4);font-size:0.8rem;cursor:pointer;">
                        <i class="fas fa-list"></i> Escolher outro
                    </button>
                </div>
            </div>`,
        showConfirmButton: false,
        showCancelButton: true,
        cancelButtonText: 'Fechar',
        customClass: { popup: 'suggestion-swal-popup', cancelButton: 'suggestion-deny-btn' },
        didOpen: () => {
            document.getElementById('btn-copiar-texto-indicar')?.addEventListener('click', () => {
                navigator.clipboard.writeText(textoBase)
                    .then(() => { UI_toast('Texto copiado!'); })
                    .catch(() => {});
            });
            document.getElementById('btn-indicar-sortear-outro')?.addEventListener('click', () => {
                // Sorteia direto sem fechar — mostra loading no lugar do card
                const pool = filtrarPorGeneros(todosFilmes, generosAtivos);
                if (!pool.length) return;
                const novoFilme = pool[Math.floor(Math.random() * pool.length)];
                // Fecha e reabre o preview com o novo filme (sem voltar ao passo 1)
                Swal.close();
                setTimeout(() => mostrarPreviewCard(novoFilme, nomeUsuario, todosFilmes, generosAtivos), 150);
            });
            document.getElementById('btn-indicar-escolher')?.addEventListener('click', () => {
                Swal.close();
                setTimeout(() => escolherFilmeParaIndicar(todosFilmes, nomeUsuario, generosAtivos), 150);
            });
        }
    });
}

// Toast helper (não depende do módulo UI)
function UI_toast(msg) {
    const t = document.createElement('div');
    t.textContent = msg;
    t.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#1e293b;color:#fff;padding:8px 20px;border-radius:20px;font-size:0.82rem;z-index:99999;box-shadow:0 4px 12px rgba(0,0,0,0.5);';
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 2500);
}

// ─────────────────────────────────────────────────────────────
// PASSO 2A — Sortear
// ─────────────────────────────────────────────────────────────

function sortearFilmeParaIndicar(filmes, nomeUsuario, generosAtivos) {
    const pool = filtrarPorGeneros(filmes, generosAtivos);
    if (!pool.length) {
        Swal.fire({ title: 'Nenhum filme', text: 'Nenhum filme encontrado para os gêneros selecionados.', icon: 'warning', customClass: { popup: 'suggestion-swal-popup' } });
        return;
    }
    const sorteado = pool[Math.floor(Math.random() * pool.length)];
    mostrarPreviewCard(sorteado, nomeUsuario, filmes, generosAtivos);
}

// ─────────────────────────────────────────────────────────────
// PASSO 2B — Escolher da lista
// ─────────────────────────────────────────────────────────────

function escolherFilmeParaIndicar(filmes, nomeUsuario, generosAtivos) {
    const pool = filtrarPorGeneros(filmes, generosAtivos);
    if (!pool.length) {
        Swal.fire({ title: 'Nenhum filme', text: 'Nenhum filme encontrado para os gêneros selecionados.', icon: 'warning', customClass: { popup: 'suggestion-swal-popup' } });
        return;
    }

    const itensHTML = pool.map((f, i) => `
        <button class="btn-escolher-indicar" data-idx="${i}"
            style="display:flex;align-items:center;gap:10px;width:100%;padding:8px 10px;
                   background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);
                   border-radius:8px;cursor:pointer;text-align:left;margin-bottom:6px;
                   transition:background 0.15s;"
            onmouseover="this.style.background='rgba(59,130,246,0.12)'"
            onmouseout="this.style.background='rgba(255,255,255,0.03)'">
            ${f.posterUrl && f.posterUrl !== 'N/A'
                ? `<img src="${f.posterUrl}" style="width:36px;height:54px;object-fit:cover;border-radius:4px;flex-shrink:0;">`
                : `<div style="width:36px;height:54px;background:#1e293b;border-radius:4px;flex-shrink:0;display:flex;align-items:center;justify-content:center;"><i class="fas fa-film" style="color:rgba(255,255,255,0.2);font-size:0.8rem;"></i></div>`}
            <div style="min-width:0;">
                <div style="font-size:0.85rem;font-weight:600;color:#f0f4ff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${f.titulo}</div>
                <div style="font-size:0.72rem;color:rgba(255,255,255,0.35);">
                    ${f.ano || ''} ${f.genero?.slice(0,2).join(' · ') || ''}
                </div>
                <div style="font-size:0.7rem;margin-top:2px;">
                    ${f.assistido
                        ? `<span style="color:#22c55e;">★ ${f.nota?.toFixed(1) || 'N/A'}</span>`
                        : `<span style="color:#fbbf24;">📋 Pendente</span>`}
                </div>
            </div>
        </button>`).join('');

    Swal.fire({
        title: `<span style="font-size:0.95rem;">Escolha um filme</span>`,
        width: 'min(520px, 95vw)',
        html: `
            <input id="busca-indicar" placeholder="Buscar pelo título..."
                style="width:100%;padding:8px 12px;border-radius:8px;border:1px solid rgba(255,255,255,0.1);
                       background:rgba(255,255,255,0.05);color:#fff;font-size:0.85rem;margin-bottom:10px;outline:none;">
            <div id="lista-escolher-indicar" style="max-height:360px;overflow-y:auto;padding-right:4px;">
                ${itensHTML}
            </div>`,
        showConfirmButton: false,
        showCancelButton: true,
        cancelButtonText: 'Voltar',
        customClass: { popup: 'suggestion-swal-popup', cancelButton: 'suggestion-deny-btn' },
        didOpen: () => {
            // Busca em tempo real
            document.getElementById('busca-indicar')?.addEventListener('input', function() {
                const q = this.value.toLowerCase();
                document.querySelectorAll('.btn-escolher-indicar').forEach((btn, i) => {
                    const titulo = pool[i].titulo.toLowerCase();
                    btn.style.display = titulo.includes(q) ? 'flex' : 'none';
                });
            });

            // Click no filme
            document.getElementById('lista-escolher-indicar')?.addEventListener('click', (e) => {
                const btn = e.target.closest('.btn-escolher-indicar');
                if (!btn) return;
                const idx = parseInt(btn.dataset.idx);
                Swal.close();
                setTimeout(() => mostrarPreviewCard(pool[idx], nomeUsuario, filmes, generosAtivos), 200);
            });
        }
    });
}

// ─────────────────────────────────────────────────────────────
// PASSO 1 — Seleção de gêneros + modo (sortear/escolher)
// ─────────────────────────────────────────────────────────────

function filtrarPorGeneros(filmes, generos) {
    if (!generos.length) return filmes;
    return filmes.filter(f => f.genero?.some(g => generos.includes(g)));
}

export function abrirModalIndicar(filmes, nomeUsuario) {
    // Coleta todos os gêneros únicos
    const todosGeneros = [...new Set(filmes.flatMap(f => f.genero || []))].sort();

    const generoPills = todosGeneros.map(g => `
        <button class="btn-genero-indicar" data-genero="${g}"
            style="padding:5px 12px;border-radius:20px;border:1px solid rgba(255,255,255,0.12);
                   background:transparent;color:rgba(255,255,255,0.5);font-size:0.78rem;cursor:pointer;
                   transition:all 0.15s;white-space:nowrap;"
            onmouseover="if(!this.classList.contains('ativo')) this.style.borderColor='rgba(59,130,246,0.4)'"
            onmouseout="if(!this.classList.contains('ativo')) this.style.borderColor='rgba(255,255,255,0.12)'"
        >${g}</button>`).join('');

    Swal.fire({
        title: `<span style="font-size:1rem;font-weight:600;">🎬 Indicar um Filme</span>`,
        width: 'min(580px, 95vw)',
        html: `
            <p style="font-size:0.8rem;color:rgba(255,255,255,0.35);margin-bottom:14px;">
                Filtre por gênero (opcional) e escolha como selecionar o filme.
            </p>

            <!-- Gêneros -->
            <div style="margin-bottom:16px;">
                <p style="font-size:0.75rem;color:rgba(255,255,255,0.4);text-transform:uppercase;
                           letter-spacing:0.06em;margin-bottom:8px;">
                    Filtrar por gênero <span style="opacity:0.5;">(clique para selecionar)</span>
                </p>
                <div id="generos-indicar" style="display:flex;flex-wrap:wrap;gap:6px;max-height:140px;overflow-y:auto;padding:2px;">
                    ${generoPills}
                </div>
                <button id="btn-limpar-generos"
                    style="margin-top:8px;font-size:0.72rem;color:rgba(255,255,255,0.3);background:none;
                           border:none;cursor:pointer;padding:0;">
                    Limpar seleção
                </button>
            </div>

            <!-- Separador -->
            <div style="border-top:1px solid rgba(255,255,255,0.07);margin:16px 0;"></div>

            <!-- Modo -->
            <p style="font-size:0.75rem;color:rgba(255,255,255,0.4);text-transform:uppercase;
                       letter-spacing:0.06em;margin-bottom:10px;">Como escolher?</p>
            <div style="display:flex;gap:10px;justify-content:center;">
                <button id="btn-modo-sortear"
                    style="flex:1;padding:12px;border-radius:10px;border:1px solid rgba(59,130,246,0.3);
                           background:rgba(59,130,246,0.1);color:#93c5fd;cursor:pointer;font-size:0.85rem;">
                    <i class="fas fa-dice" style="display:block;font-size:1.4rem;margin-bottom:6px;"></i>
                    Sortear
                </button>
                <button id="btn-modo-escolher"
                    style="flex:1;padding:12px;border-radius:10px;border:1px solid rgba(255,255,255,0.1);
                           background:rgba(255,255,255,0.04);color:rgba(255,255,255,0.55);cursor:pointer;font-size:0.85rem;">
                    <i class="fas fa-list" style="display:block;font-size:1.4rem;margin-bottom:6px;"></i>
                    Escolher da lista
                </button>
            </div>`,
        showConfirmButton: false,
        showCancelButton: true,
        cancelButtonText: 'Cancelar',
        customClass: { popup: 'suggestion-swal-popup', cancelButton: 'suggestion-deny-btn' },
        didOpen: () => {
            const generosAtivos = new Set();

            // Toggle gênero
            document.getElementById('generos-indicar')?.addEventListener('click', (e) => {
                const btn = e.target.closest('.btn-genero-indicar');
                if (!btn) return;
                const g = btn.dataset.genero;
                if (generosAtivos.has(g)) {
                    generosAtivos.delete(g);
                    btn.classList.remove('ativo');
                    btn.style.cssText = btn.style.cssText
                        .replace('background:rgba(59,130,246,0.2)', 'background:transparent')
                        .replace('border-color:rgba(59,130,246,0.5)', 'border-color:rgba(255,255,255,0.12)')
                        .replace('color:#93c5fd', 'color:rgba(255,255,255,0.5)');
                    btn.style.background = 'transparent';
                    btn.style.borderColor = 'rgba(255,255,255,0.12)';
                    btn.style.color = 'rgba(255,255,255,0.5)';
                } else {
                    generosAtivos.add(g);
                    btn.classList.add('ativo');
                    btn.style.background = 'rgba(59,130,246,0.2)';
                    btn.style.borderColor = 'rgba(59,130,246,0.5)';
                    btn.style.color = '#93c5fd';
                }
            });

            document.getElementById('btn-limpar-generos')?.addEventListener('click', () => {
                generosAtivos.clear();
                document.querySelectorAll('.btn-genero-indicar').forEach(b => {
                    b.classList.remove('ativo');
                    b.style.background = 'transparent';
                    b.style.borderColor = 'rgba(255,255,255,0.12)';
                    b.style.color = 'rgba(255,255,255,0.5)';
                });
            });

            document.getElementById('btn-modo-sortear')?.addEventListener('click', () => {
                Swal.close();
                setTimeout(() => sortearFilmeParaIndicar(filmes, nomeUsuario, [...generosAtivos]), 200);
            });

            document.getElementById('btn-modo-escolher')?.addEventListener('click', () => {
                Swal.close();
                setTimeout(() => escolherFilmeParaIndicar(filmes, nomeUsuario, [...generosAtivos]), 200);
            });
        }
    });
}