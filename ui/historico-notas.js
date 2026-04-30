/**
 * historico-notas.js
 * Permite reavaliar um filme e guarda histórico de notas com datas.
 */

export async function salvarReavaliacao(db, uid, filmeId, novaNota, notaAnterior, titulo) {
    const { doc, updateDoc, arrayUnion, serverTimestamp }
        = await import("https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js");

    const entrada = {
        nota: novaNota,
        data: new Date().toISOString().slice(0,10),
        ts:   Date.now()
    };

    // Salva nova nota + adiciona a anterior ao histórico
    await updateDoc(doc(db, 'users', uid, 'filmes', filmeId), {
        nota: novaNota,
        historicoNotas: arrayUnion({
            nota: notaAnterior,
            data: new Date().toISOString().slice(0,10),
            ts:   Date.now() - 1 // garante que a anterior vem antes
        })
    });

    return entrada;
}

export function mostrarModalReavaliacao(filme, onSalvar) {
    const historico = (filme.historicoNotas || []).sort((a,b) => a.ts - b.ts);

    const histHTML = historico.length
        ? `<div style="margin-bottom:16px;">
               <p style="font-size:0.72rem;color:rgba(255,255,255,0.3);text-transform:uppercase;
                          letter-spacing:0.06em;margin-bottom:8px;">Histórico de avaliações</p>
               <div style="display:flex;gap:8px;flex-wrap:wrap;">
                   ${historico.map(h => `
                       <div style="text-align:center;padding:8px 12px;border-radius:8px;
                                   border:1px solid rgba(255,255,255,0.08);background:rgba(255,255,255,0.03);">
                           <div style="font-size:1rem;font-weight:700;color:#fbbf24;">★ ${h.nota.toFixed(1)}</div>
                           <div style="font-size:0.65rem;color:rgba(255,255,255,0.3);margin-top:2px;">
                               ${new Date(h.data).toLocaleDateString('pt-BR',{day:'2-digit',month:'short',year:'2-digit'})}
                           </div>
                       </div>`).join('')}
                   <!-- Nota atual -->
                   <div style="text-align:center;padding:8px 12px;border-radius:8px;
                               border:2px solid rgba(59,130,246,0.4);background:rgba(59,130,246,0.08);">
                       <div style="font-size:1rem;font-weight:700;color:#60a5fa;">★ ${(filme.nota||0).toFixed(1)}</div>
                       <div style="font-size:0.65rem;color:rgba(255,255,255,0.3);margin-top:2px;">atual</div>
                   </div>
               </div>
           </div>`
        : '';

    const estrelas = Array.from({length:10}, (_,i) => i+1).map(n => `
        <button class="btn-estrela" data-nota="${n}"
            style="width:36px;height:36px;border-radius:8px;border:1px solid rgba(255,255,255,0.1);
                   background:${(filme.nota||0) >= n ? 'rgba(251,191,36,0.15)' : 'transparent'};
                   color:${(filme.nota||0) >= n ? '#fbbf24' : 'rgba(255,255,255,0.2)'};
                   font-size:0.82rem;font-weight:600;cursor:pointer;transition:all 0.12s;">
            ${n}
        </button>`).join('');

    Swal.fire({
        title: `<span style="font-size:0.95rem;font-weight:600;">Reavaliar: ${filme.titulo}</span>`,
        width: 'min(480px, 95vw)',
        html: `
            ${histHTML}
            <p style="font-size:0.78rem;color:rgba(255,255,255,0.4);margin-bottom:12px;">
                Nota atual: <strong style="color:#fbbf24;">★ ${(filme.nota||0).toFixed(1)}</strong>
                — Selecione sua nova avaliação:
            </p>
            <div id="estrelas-grid" style="display:flex;flex-wrap:wrap;gap:6px;justify-content:center;margin-bottom:8px;">
                ${estrelas}
            </div>
            <p id="nota-selecionada" style="font-size:0.78rem;color:rgba(255,255,255,0.3);margin-top:8px;">
                Clique em uma nota para selecionar
            </p>`,
        showCancelButton: true,
        showConfirmButton: false,
        cancelButtonText: 'Cancelar',
        customClass: { popup: 'suggestion-swal-popup', cancelButton: 'suggestion-deny-btn' },
        didOpen: () => {
            let notaSelecionada = null;

            document.getElementById('estrelas-grid')?.addEventListener('click', (e) => {
                const btn = e.target.closest('.btn-estrela');
                if (!btn) return;
                notaSelecionada = parseFloat(btn.dataset.nota);

                // Atualiza visual
                document.querySelectorAll('.btn-estrela').forEach((b, i) => {
                    const n = i + 1;
                    b.style.background = n <= notaSelecionada ? 'rgba(251,191,36,0.2)' : 'transparent';
                    b.style.color      = n <= notaSelecionada ? '#fbbf24' : 'rgba(255,255,255,0.2)';
                    b.style.borderColor= n <= notaSelecionada ? 'rgba(251,191,36,0.4)' : 'rgba(255,255,255,0.1)';
                });

                const diff = notaSelecionada - (filme.nota||0);
                const diffStr = diff > 0 ? `+${diff.toFixed(1)}` : diff.toFixed(1);
                const diffColor = diff > 0 ? '#22c55e' : diff < 0 ? '#f87171' : 'rgba(255,255,255,0.3)';
                document.getElementById('nota-selecionada').innerHTML =
                    `Nova nota: <strong style="color:#fbbf24;">★ ${notaSelecionada.toFixed(1)}</strong>
                     <span style="color:${diffColor};font-size:0.72rem;margin-left:6px;">(${diffStr} vs atual)</span>
                     <br><button id="btn-confirmar-nota" style="margin-top:10px;padding:8px 24px;border-radius:8px;
                         border:none;background:#3b82f6;color:#fff;font-size:0.85rem;cursor:pointer;font-weight:600;">
                         Confirmar nova nota
                     </button>`;

                document.getElementById('btn-confirmar-nota')?.addEventListener('click', () => {
                    if (notaSelecionada !== null && notaSelecionada !== filme.nota) {
                        Swal.close();
                        onSalvar(filme.id, notaSelecionada, filme.nota || 0);
                    } else if (notaSelecionada === filme.nota) {
                        Swal.showValidationMessage('A nota é igual à atual.');
                    }
                });
            });
        }
    });
}
