/**
 * onboarding.js
 * Tour de boas-vindas para novos usuários.
 * Só aparece uma vez — controle via Firestore no perfil do usuário.
 */

const PASSOS = [
    {
        titulo: '🎬 Bem-vindo ao Meus Filmes!',
        descricao: 'Seu diário cinematográfico pessoal. Vamos fazer um tour rápido para você aproveitar tudo.',
        icon: 'fas fa-film',
        cor: '#3b82f6'
    },
    {
        titulo: '📝 Cadastre seus filmes',
        descricao: 'Clique em <strong>Cadastrar</strong> na barra superior. Digite o título e a busca automática preenche tudo — pôster, direção, elenco e sinopse.',
        icon: 'fas fa-plus-circle',
        cor: '#22c55e',
        destaque: '#nav-cadastrar-btn'
    },
    {
        titulo: '📋 Organize sua lista',
        descricao: 'Use as abas <strong>Assistidos</strong>, <strong>Não Assistidos</strong> e <strong>Favoritos</strong> para navegar. Filtros avançados por gênero, nota, data e muito mais.',
        icon: 'fas fa-list',
        cor: '#a855f7',
        destaque: '#lista-section'
    },
    {
        titulo: '📊 Descubra seus padrões',
        descricao: 'A seção <strong>Gráficos</strong> mostra seus gêneros favoritos, diretores mais assistidos, evolução por décadas e muito mais.',
        icon: 'fas fa-chart-pie',
        cor: '#f97316',
        destaque: '#nav-graficos-btn'
    },
    {
        titulo: '🏆 Conquistas e Perfil',
        descricao: 'No <strong>Perfil</strong> você acompanha conquistas, seu heatmap de atividade e o resumo do seu ano em filmes.',
        icon: 'fas fa-trophy',
        cor: '#fbbf24',
        destaque: '#nav-perfil-btn'
    },
    {
        titulo: '🎲 Hora de começar!',
        descricao: 'Cadastre seu primeiro filme. Use o botão <strong>Sugerir Filme</strong> para descobrir o que assistir, ou <strong>Indicar Filme</strong> para compartilhar com amigos.',
        icon: 'fas fa-rocket',
        cor: '#ec4899'
    }
];

export function mostrarOnboarding(onConcluir) {
    let passoAtual = 0;

    function renderPasso() {
        const p = PASSOS[passoAtual];
        const total = PASSOS.length;
        const isUltimo = passoAtual === total - 1;

        const dots = PASSOS.map((_, i) => `
            <div onclick="window._onboardingIrPara(${i})" style="
                width:${i === passoAtual ? '20px' : '8px'};height:8px;border-radius:4px;cursor:pointer;
                background:${i === passoAtual ? p.cor : 'rgba(255,255,255,0.2)'};
                transition:all 0.25s ease;"></div>`).join('');

        Swal.fire({
            html: `
                <div style="text-align:center;padding:8px 0;">
                    <!-- Ícone animado -->
                    <div style="width:72px;height:72px;border-radius:20px;margin:0 auto 20px;
                                background:${p.cor}20;border:2px solid ${p.cor}50;
                                display:flex;align-items:center;justify-content:center;">
                        <i class="${p.icon}" style="font-size:2rem;color:${p.cor};"></i>
                    </div>

                    <h3 style="font-size:1.2rem;font-weight:700;color:#f0f4ff;margin-bottom:10px;">
                        ${p.titulo}
                    </h3>
                    <p style="font-size:0.88rem;color:rgba(255,255,255,0.55);line-height:1.6;margin-bottom:24px;">
                        ${p.descricao}
                    </p>

                    <!-- Dots de progresso -->
                    <div style="display:flex;justify-content:center;gap:6px;margin-bottom:24px;">
                        ${dots}
                    </div>

                    <!-- Botões -->
                    <div style="display:flex;gap:10px;justify-content:center;">
                        ${passoAtual > 0 ? `
                        <button id="onb-prev" style="padding:9px 20px;border-radius:8px;
                            border:1px solid rgba(255,255,255,0.15);background:transparent;
                            color:rgba(255,255,255,0.5);font-size:0.85rem;cursor:pointer;">
                            ← Anterior
                        </button>` : ''}
                        <button id="onb-skip" style="padding:9px 20px;border-radius:8px;
                            border:1px solid rgba(255,255,255,0.1);background:transparent;
                            color:rgba(255,255,255,0.3);font-size:0.82rem;cursor:pointer;">
                            Pular tour
                        </button>
                        <button id="onb-next" style="padding:9px 24px;border-radius:8px;
                            border:none;background:${p.cor};color:#fff;
                            font-size:0.88rem;font-weight:600;cursor:pointer;
                            box-shadow:0 4px 14px ${p.cor}50;transition:transform 0.15s;">
                            ${isUltimo ? '🚀 Começar!' : 'Próximo →'}
                        </button>
                    </div>

                    <!-- Contador -->
                    <p style="font-size:0.7rem;color:rgba(255,255,255,0.2);margin-top:16px;">
                        ${passoAtual + 1} de ${total}
                    </p>
                </div>`,
            showConfirmButton: false,
            showCancelButton: false,
            width: 'min(440px, 92vw)',
            allowOutsideClick: false,
            backdrop: 'rgba(0,0,15,0.75)',
            customClass: { popup: 'suggestion-swal-popup onboarding-popup' },
            willOpen: () => {
                // Destaque visual do elemento mencionado
                if (p.destaque) {
                    const el = document.querySelector(p.destaque);
                    if (el) {
                        el.style.outline = `2px solid ${p.cor}`;
                        el.style.outlineOffset = '4px';
                        el.style.borderRadius = '6px';
                        setTimeout(() => {
                            if (el) { el.style.outline = ''; el.style.outlineOffset = ''; }
                        }, 3000);
                    }
                }
            },
            didOpen: () => {
                window._onboardingIrPara = (i) => {
                    passoAtual = i;
                    Swal.close();
                    setTimeout(renderPasso, 80);
                };

                document.getElementById('onb-next')?.addEventListener('click', () => {
                    if (isUltimo) {
                        Swal.close();
                        if (onConcluir) onConcluir();
                    } else {
                        passoAtual++;
                        Swal.close();
                        setTimeout(renderPasso, 80);
                    }
                });

                document.getElementById('onb-prev')?.addEventListener('click', () => {
                    passoAtual--;
                    Swal.close();
                    setTimeout(renderPasso, 80);
                });

                document.getElementById('onb-skip')?.addEventListener('click', () => {
                    Swal.close();
                    if (onConcluir) onConcluir();
                });

                // Swipe gesture para mobile
                let touchStartX = 0;
                const popup = document.querySelector('.onboarding-popup');
                popup?.addEventListener('touchstart', e => { touchStartX = e.touches[0].clientX; });
                popup?.addEventListener('touchend', e => {
                    const diff = touchStartX - e.changedTouches[0].clientX;
                    if (Math.abs(diff) > 60) {
                        if (diff > 0 && !isUltimo) { passoAtual++; Swal.close(); setTimeout(renderPasso, 80); }
                        else if (diff < 0 && passoAtual > 0) { passoAtual--; Swal.close(); setTimeout(renderPasso, 80); }
                    }
                });
            }
        });
    }

    renderPasso();
}
