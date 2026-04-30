/**
 * notificacoes-meta.js
 * Notificações motivacionais ao se aproximar de conquistas.
 */

const METAS = [
    { total: 10,  msg: '🎬 Faltam apenas <strong>%r filmes</strong> para a conquista <em>Cinéfilo Iniciante</em>!' },
    { total: 50,  msg: '🏅 Você está a <strong>%r filmes</strong> de se tornar um <em>Colecionador</em>!' },
    { total: 100, msg: '🏆 Apenas <strong>%r filmes</strong> para o <em>Centenário</em>! Continue!' },
    { total: 200, msg: '📚 A conquista <em>Arquivo Vivo</em> está a <strong>%r filmes</strong> de distância!' },
    { total: 300, msg: '📖 <strong>%r filmes</strong> para se tornar uma <em>Enciclopédia</em> cinematográfica!' },
];

const ALERTA_QUANDO_FALTAM = 5; // Avisa quando faltam até X filmes
const _notificacoesEnviadas = new Set();

export function verificarNotificacoesConquistas(filmes, perfil) {
    if (!filmes?.length) return;
    const total = filmes.length;

    for (const meta of METAS) {
        const faltam = meta.total - total;
        if (faltam > 0 && faltam <= ALERTA_QUANDO_FALTAM) {
            const key = `meta_${meta.total}_${total}`;
            if (_notificacoesEnviadas.has(key)) continue;
            _notificacoesEnviadas.add(key);

            const msg = meta.msg.replace('%r', faltam);

            // Toast discreto no canto
            const div = document.createElement('div');
            div.innerHTML = `
                <div style="display:flex;align-items:flex-start;gap:10px;">
                    <span style="font-size:1.1rem;flex-shrink:0;">🎯</span>
                    <div>
                        <div style="font-size:0.8rem;font-weight:600;color:rgba(255,255,255,0.9);margin-bottom:3px;">
                            Meta próxima!
                        </div>
                        <div style="font-size:0.75rem;color:rgba(255,255,255,0.55);line-height:1.4;">${msg}</div>
                    </div>
                    <button onclick="this.closest('.meta-toast').remove()"
                        style="background:none;border:none;color:rgba(255,255,255,0.3);cursor:pointer;
                               font-size:0.9rem;flex-shrink:0;padding:0;margin-left:4px;">✕</button>
                </div>`;

            div.className = 'meta-toast';
            div.style.cssText = `
                position:fixed;bottom:${24 + (_notificacoesEnviadas.size - 1) * 80}px;right:20px;
                background:rgba(15,23,42,0.95);border:1px solid rgba(59,130,246,0.3);
                border-left:3px solid #3b82f6;border-radius:10px;padding:12px 14px;
                max-width:300px;z-index:9990;box-shadow:0 8px 24px rgba(0,0,0,0.4);
                animation:slideInRight 0.35s ease forwards;`;

            document.body.appendChild(div);
            setTimeout(() => {
                div.style.opacity = '0';
                div.style.transition = 'opacity 0.4s ease';
                setTimeout(() => div.remove(), 400);
            }, 6000);

            break; // Só mostra uma notificação por vez
        }
    }
}
