import { UI } from './ui.js';

export const Achievements = {
    DEFINICOES: [
        { 
            id: 'cinefilo_10', 
            nome: 'Cinéfilo Iniciante', 
            descricao: 'Cadastrou 10 filmes.', 
            icone: 'fa-solid fa-film',
            target: 10,
            progress: (lista) => lista.length,
            check: (lista) => lista.length >= 10 
        },
        { 
            id: 'critico_10', 
            nome: 'Crítico Exigente', 
            descricao: 'Deu nota 10 para algum filme.', 
            icone: 'fa-solid fa-star',
            target: 1,
            progress: (lista) => lista.filter(f => f.nota === 10).length,
            check: (lista) => lista.some(f => f.nota === 10) 
        },
        { 
            id: 'nacional_5', 
            nome: 'Patriota', 
            descricao: '5 filmes nacionais cadastrados.', 
            icone: 'fa-solid fa-flag',
            target: 5,
            progress: (lista) => lista.filter(f => f.origem === 'Nacional').length,
            check: (lista) => lista.filter(f => f.origem === 'Nacional').length >= 5 
        },
        { 
            id: 'fa_carteirinha_3', 
            nome: 'Fã de Carteirinha', 
            descricao: '3 filmes do mesmo diretor.', 
            icone: 'fa-solid fa-user-check',
            target: 3,
            progress: (lista) => {
                const contagem = {};
                lista.flatMap(f => f.direcao || []).forEach(d => {
                    if (d) contagem[d] = (contagem[d] || 0) + 1;
                });
                return Math.max(0, ...Object.values(contagem), 0);
            },
            check: (lista) => { 
                const contagem = {}; 
                lista.flatMap(f => f.direcao || []).forEach(diretor => { 
                    if (diretor) contagem[diretor] = (contagem[diretor] || 0) + 1;
                }); 
                return Object.values(contagem).some(qtd => qtd >= 3); 
            } 
        },
        { 
            id: 'maratonista_5', 
            nome: 'Maratonista', 
            descricao: '5 filmes assistidos no mesmo mês.', 
            icone: 'fa-solid fa-person-running',
            target: 5,
            progress: (lista) => {
                const contagem = {};
                lista.filter(f => f.assistido && f.dataAssistido).forEach(f => {
                    const mesAno = f.dataAssistido.slice(0, 7);
                    contagem[mesAno] = (contagem[mesAno] || 0) + 1;
                });
                return Math.max(0, ...Object.values(contagem), 0);
            },
            check: (lista) => { 
                const contagem = {}; 
                lista.filter(f => f.assistido && f.dataAssistido).forEach(f => { 
                    try { 
                        const mesAno = f.dataAssistido.slice(0, 7); 
                        contagem[mesAno] = (contagem[mesAno] || 0) + 1;
                    } catch(e) {
                        console.error("Erro ao verificar conquista Maratonista", e);
                    } 
                }); 
                return Object.values(contagem).some(qtd => qtd >= 5); 
            } 
        }
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
