import { UI } from './ui.js';

export const Achievements = {
    DEFINICOES: [
        // ── Existentes ──
        { 
            id: 'cinefilo_10', nome: 'Cinéfilo Iniciante', descricao: 'Cadastrou 10 filmes.', 
            icone: 'fa-solid fa-film', target: 10,
            progress: (lista) => Math.min(lista.length, 10),
            check: (lista) => lista.length >= 10 
        },
        { 
            id: 'cinefilo_50', nome: 'Colecionador', descricao: '50 filmes cadastrados.', 
            icone: 'fa-solid fa-layer-group', target: 50,
            progress: (lista) => Math.min(lista.length, 50),
            check: (lista) => lista.length >= 50
        },
        { 
            id: 'cinefilo_100', nome: 'Centenário', descricao: '100 filmes cadastrados.', 
            icone: 'fa-solid fa-trophy', target: 100,
            progress: (lista) => Math.min(lista.length, 100),
            check: (lista) => lista.length >= 100
        },
        { 
            id: 'cinefilo_200', nome: 'Arquivo Vivo', descricao: '200 filmes cadastrados.', 
            icone: 'fa-solid fa-database', target: 200,
            progress: (lista) => Math.min(lista.length, 200),
            check: (lista) => lista.length >= 200
        },
        { 
            id: 'cinefilo_300', nome: 'Enciclopédia', descricao: '300 filmes cadastrados.', 
            icone: 'fa-solid fa-book-open', target: 300,
            progress: (lista) => Math.min(lista.length, 300),
            check: (lista) => lista.length >= 300
        },
        { 
            id: 'critico_10', nome: 'Crítico Exigente', descricao: 'Deu nota 10 para algum filme.', 
            icone: 'fa-solid fa-star', target: 1,
            progress: (lista) => lista.filter(f => f.nota === 10).length,
            check: (lista) => lista.some(f => f.nota === 10) 
        },
        { 
            id: 'critico_severo', nome: 'Crítico Severo', descricao: 'Deu nota abaixo de 5 para algum filme.', 
            icone: 'fa-solid fa-thumbs-down', target: 1,
            progress: (lista) => lista.filter(f => f.nota > 0 && f.nota < 5).length,
            check: (lista) => lista.some(f => f.nota > 0 && f.nota < 5)
        },
        { 
            id: 'nacional_5', nome: 'Patriota', descricao: '5 filmes nacionais cadastrados.', 
            icone: 'fa-solid fa-flag', target: 5,
            progress: (lista) => lista.filter(f => f.origem === 'Nacional').length,
            check: (lista) => lista.filter(f => f.origem === 'Nacional').length >= 5 
        },
        { 
            id: 'fa_carteirinha_3', nome: 'Fã de Carteirinha', descricao: '3 filmes do mesmo diretor.', 
            icone: 'fa-solid fa-user-check', target: 3,
            progress: (lista) => {
                const c = {};
                lista.flatMap(f => f.direcao || []).forEach(d => { if (d) c[d] = (c[d] || 0) + 1; });
                return Math.max(0, ...Object.values(c), 0);
            },
            check: (lista) => { 
                const c = {}; 
                lista.flatMap(f => f.direcao || []).forEach(d => { if (d) c[d] = (c[d] || 0) + 1; }); 
                return Object.values(c).some(q => q >= 3); 
            } 
        },
        { 
            id: 'completista', nome: 'Completista', descricao: 'Assistiu 5+ filmes do mesmo diretor.', 
            icone: 'fa-solid fa-crown', target: 5,
            progress: (lista) => {
                const c = {};
                lista.filter(f => f.assistido).flatMap(f => f.direcao || []).forEach(d => { if (d) c[d] = (c[d] || 0) + 1; });
                return Math.max(0, ...Object.values(c), 0);
            },
            check: (lista) => {
                const c = {};
                lista.filter(f => f.assistido).flatMap(f => f.direcao || []).forEach(d => { if (d) c[d] = (c[d] || 0) + 1; });
                return Object.values(c).some(q => q >= 5);
            }
        },
        { 
            id: 'maratonista_5', nome: 'Maratonista', descricao: '5 filmes assistidos no mesmo mês.', 
            icone: 'fa-solid fa-person-running', target: 5,
            progress: (lista) => {
                const c = {};
                lista.filter(f => f.assistido && f.dataAssistido).forEach(f => {
                    const m = f.dataAssistido.slice(0, 7);
                    c[m] = (c[m] || 0) + 1;
                });
                return Math.max(0, ...Object.values(c), 0);
            },
            check: (lista) => { 
                const c = {}; 
                lista.filter(f => f.assistido && f.dataAssistido).forEach(f => { 
                    try { const m = f.dataAssistido.slice(0, 7); c[m] = (c[m] || 0) + 1; } catch(e) {} 
                }); 
                return Object.values(c).some(q => q >= 5); 
            } 
        },
        {
            id: 'cinefilo_internacional', nome: 'Cidadão do Mundo', descricao: 'Assistiu filmes de 5 gêneros diferentes.',
            icone: 'fa-solid fa-globe', target: 5,
            progress: (lista) => new Set(lista.filter(f => f.assistido).flatMap(f => f.genero || [])).size,
            check: (lista) => new Set(lista.filter(f => f.assistido).flatMap(f => f.genero || [])).size >= 5
        },
        {
            id: 'sequencia_7', nome: 'Semana Cinéfila', descricao: 'Assistiu filmes 7 dias seguidos.',
            icone: 'fa-solid fa-calendar-check', target: 7,
            progress: (lista) => _calcStreak(lista),
            check: (lista) => _calcStreak(lista) >= 7
        },
        {
            id: 'nota_media_8', nome: 'Padrão Elevado', descricao: 'Média geral de notas acima de 8.',
            icone: 'fa-solid fa-chart-line', target: 1,
            progress: (lista) => {
                const ass = lista.filter(f => f.assistido && f.nota);
                if (!ass.length) return 0;
                return parseFloat((ass.reduce((a, f) => a + f.nota, 0) / ass.length).toFixed(1));
            },
            check: (lista) => {
                const ass = lista.filter(f => f.assistido && f.nota);
                if (!ass.length) return false;
                return (ass.reduce((a, f) => a + f.nota, 0) / ass.length) >= 8;
            }
        },
    ],

    verificar: (currentUserProfile, filmes) => {
        if (!currentUserProfile) return;
        
        const stats = Achievements.DEFINICOES.map(def => {
            const currentProgress = def.progress ? def.progress(filmes) : 0;
            return { 
                ...def, 
                unlocked: def.check(filmes),
                progress: Math.min(currentProgress, def.target || currentProgress)
            };
        });
        
        UI.renderAchievements(stats);
        UI.renderProfile(currentUserProfile, filmes);
    }
};

function _calcStreak(lista) {
    const dias = new Set(
        lista.filter(f => f.assistido && f.dataAssistido)
             .map(f => f.dataAssistido.slice(0, 10))
    );
    if (!dias.size) return 0;
    let maxStreak = 1, cur = 1;
    const sorted = [...dias].sort();
    for (let i = 1; i < sorted.length; i++) {
        const prev = new Date(sorted[i-1]);
        const curr = new Date(sorted[i]);
        const diff = (curr - prev) / 86400000;
        if (diff === 1) { cur++; maxStreak = Math.max(maxStreak, cur); }
        else cur = 1;
    }
    return maxStreak;
}