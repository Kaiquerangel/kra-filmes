import { els, templates } from './elements.js';
import { getResizedUrl } from './helpers.js';
import { carouselCardHTML, carouselEmptyHTML, rankingBarsHTML } from './html-templates.js';

const ChartJS = window.Chart;
export const chartsInstances = {};

export const updateStats = (assistidos, total, filmesGerais = []) => {
    // statTotal = Filmes Assistidos (235), total = cadastrados (296)
    els.statTotal.textContent = assistidos.length;
    
    if (assistidos.length) {
        const sum = assistidos.reduce((a, f) => a + (f.nota || 0), 0);
        els.statMedia.textContent = (sum / assistidos.length).toFixed(1);
    } else {
        els.statMedia.textContent = '0.0';
    }
    
    const processarEstatisticas = () => {


        if (!assistidos.length) {
            ['ranking-generos-bars', 'ranking-atores-bars', 'ranking-diretores-bars', 'ranking-anos-bars', 'ranking-decadas-bars', 'ranking-anos-assistidos-bars'].forEach(id => { 
                const el = document.getElementById(id); if (el) el.innerHTML = '<p class="text-muted small">N/A</p>'; 
            }); 
            return;
        }
        
        const nac = assistidos.filter(f => f.origem === 'Nacional').length;
        els.statPctNac.textContent = `${Math.round((nac / assistidos.length) * 100)}%`; 
        els.statPctInt.textContent = `${Math.round(((assistidos.length - nac) / assistidos.length) * 100)}%`;
        
        const counts = { genero: {}, atores: {}, direcao: {}, decadas: {}, anos: {}, anosAssistidos: {} };
        let melhor = assistidos[0], pior = assistidos[0];
        
        assistidos.forEach(f => {
            ['genero', 'atores', 'direcao'].forEach(key => { 
                const items = Array.isArray(f[key]) ? f[key] : [f[key]]; 
                items.forEach(i => { if(i) { const nomeNormalizado = i.trim(); counts[key][nomeNormalizado] = (counts[key][nomeNormalizado] || 0) + 1; } }); 
            });
            if (f.ano) { const d = `Anos ${Math.floor(f.ano / 10) * 10}`; counts.decadas[d] = (counts.decadas[d] || 0) + 1; counts.anos[f.ano] = (counts.anos[f.ano] || 0) + 1; }
            if (f.dataAssistido) { const anoA = f.dataAssistido.substring(0, 4); counts.anosAssistidos[anoA] = (counts.anosAssistidos[anoA] || 0) + 1; }
            if ((f.nota || 0) > (melhor.nota || 0)) melhor = f; if ((f.nota || 10) < (pior.nota || 10)) pior = f;
        });
        
        els.statMelhor.textContent = melhor.titulo || '-'; els.statPior.textContent = pior.titulo || '-';

        // ── Nota Mediana ──
        const notasOrdenadas = assistidos.map(f => f.nota || 0).sort((a,b) => a - b);
        const mid = Math.floor(notasOrdenadas.length / 2);
        const mediana = notasOrdenadas.length % 2 === 0
            ? ((notasOrdenadas[mid-1] + notasOrdenadas[mid]) / 2).toFixed(1)
            : notasOrdenadas[mid].toFixed(1);
        const medianaEl = document.getElementById('stat-mediana-notas');
        if (medianaEl) medianaEl.textContent = mediana;

        // ── Sequência atual de dias ──
        const diasAssistidos = new Set(
            assistidos.filter(f => f.dataAssistido).map(f => f.dataAssistido.slice(0,10))
        );
        let streakAtual = 0;
        const hoje = new Date(); hoje.setHours(0,0,0,0);
        let diaCheck = new Date(hoje);
        const toStr = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
        // Verifica se assistiu hoje ou ontem para começar o streak
        if (!diasAssistidos.has(toStr(diaCheck))) diaCheck.setDate(diaCheck.getDate() - 1);
        while (diasAssistidos.has(toStr(diaCheck))) {
            streakAtual++;
            diaCheck.setDate(diaCheck.getDate() - 1);
        }
        const streakEl = document.getElementById('stat-sequencia-dias');
        if (streakEl) streakEl.textContent = streakAtual;

        // ── Ritmo mensal — 6 meses corridos (incluindo meses com 0 filmes) ──
        const mesesCount = {};
        assistidos.filter(f => f.dataAssistido).forEach(f => {
            const m = f.dataAssistido.slice(0, 7);
            mesesCount[m] = (mesesCount[m] || 0) + 1;
        });
        // Gera os 6 meses corridos anteriores ao mês atual
        let totalFilmes6Meses = 0;
        const hojeRitmo = new Date();
        for (let i = 1; i <= 6; i++) {
            const d = new Date(hojeRitmo.getFullYear(), hojeRitmo.getMonth() - i, 1);
            const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
            totalFilmes6Meses += (mesesCount[key] || 0);
        }
        const ritmo = Math.round(totalFilmes6Meses / 6);
        const ritmoEl = document.getElementById('stat-ritmo-mensal');
        if (ritmoEl) ritmoEl.textContent = ritmo;

        // ── Gênero do momento (últimos 30 dias) ──
        const limite30 = new Date(); limite30.setDate(limite30.getDate() - 30);
        const limite30Str = toStr(limite30);
        const generosRecentes = {};
        assistidos.filter(f => f.dataAssistido && f.dataAssistido >= limite30Str).forEach(f => {
            (f.genero || []).forEach(g => { generosRecentes[g] = (generosRecentes[g] || 0) + 1; });
        });
        const topGeneroMomento = Object.entries(generosRecentes).sort((a,b) => b[1]-a[1])[0];
        const genMomentEl = document.getElementById('stat-genero-momento');
        if (genMomentEl) genMomentEl.textContent = topGeneroMomento ? topGeneroMomento[0] : '-';

        // ── Último assistido ──
        const ultimoAssistido = assistidos.filter(f => f.dataAssistido).sort((a,b) => b.dataAssistido.localeCompare(a.dataAssistido))[0];
        const ultimoEl = document.getElementById('stat-ultimo-assistido');
        if (ultimoEl && ultimoAssistido) {
            const dataFmt = new Date(ultimoAssistido.dataAssistido.replace(/-/g,'/')).toLocaleDateString('pt-BR',{day:'2-digit',month:'short'});
            ultimoEl.textContent = `${ultimoAssistido.titulo.length > 20 ? ultimoAssistido.titulo.slice(0,20)+'…' : ultimoAssistido.titulo} · ${dataFmt}`;
        }
        
        const topAtores = Object.entries(counts.atores).sort((a,b) => b[1] - a[1]); els.statAtor.textContent = topAtores.length ? topAtores[0][0] : '-';
        const topDec = Object.entries(counts.decadas).sort((a,b) => b[1] - a[1]); els.statDecada.textContent = topDec.length ? topDec[0][0] : '-';
        
        renderRankings('ranking-generos-bars', Object.entries(counts.genero).sort((a,b)=>b[1]-a[1]).slice(0, 15));
        renderRankings('ranking-atores-bars', topAtores.slice(0, 15));
        renderRankings('ranking-diretores-bars', Object.entries(counts.direcao).sort((a,b)=>b[1]-a[1]).slice(0, 15));
        renderRankings('ranking-anos-bars', Object.entries(counts.anos).sort((a,b)=>b[1]-a[1]).slice(0, 15));
        renderRankings('ranking-decadas-bars', topDec.slice(0, 5));
        renderRankings('ranking-anos-assistidos-bars', Object.entries(counts.anosAssistidos).sort((a,b)=>b[1]-a[1]).slice(0, 10));
        
        if (window.carouselTimeout) clearTimeout(window.carouselTimeout); 
        window.carouselTimeout = setTimeout(() => { renderCarousel(assistidos); }, 100);
        
        const sectionStats = document.getElementById('estatisticas-section');
        const sectionGraficos = document.getElementById('graficos-section');
        
        if ((sectionStats && sectionStats.style.display !== 'none') || (sectionGraficos && sectionGraficos.style.display !== 'none')) { 
            if (window.statsTimeout) clearTimeout(window.statsTimeout); 
            window.statsTimeout = setTimeout(() => { renderCharts(assistidos); }, 200); 
        }
    };
    
    if (window.requestIdleCallback) window.requestIdleCallback(processarEstatisticas); else setTimeout(processarEstatisticas, 100);
};

export const renderCarousel = (assistidos) => {
    const containerUltimos = document.getElementById('ultimos-assistidos-container'); 
    if (!containerUltimos) return;
    
    const ultimos10 = assistidos.filter(f => f.assistido && f.dataAssistido).sort((a, b) => (b.dataAssistido > a.dataAssistido ? 1 : -1)).slice(0, 10);
        
    if (ultimos10.length === 0) { 
        containerUltimos.innerHTML = carouselEmptyHTML();
    } else {
        const html = ultimos10.map((f, i) => carouselCardHTML(f, i)).join('');
            
        requestAnimationFrame(() => { containerUltimos.innerHTML = html; });
    }
};

export const renderRankings = (elId, data) => {
    const container = document.getElementById(elId);
    if (!container) return;
    container.innerHTML = rankingBarsHTML(data);
};

const isMobileDevice = () => window.matchMedia('(hover:none)').matches;

export const renderCharts = (filmes) => {
    // Opções de interação touch para Chart.js (substitui touchPlugin indefinido)
    const touchPlugin = {
        interaction: {
            mode: 'nearest',
            intersect: false,
            axis: 'x'
        },
        events: ['mousemove', 'mouseout', 'click', 'touchstart', 'touchmove']
    };
    if (!ChartJS) return;
    
    const isDark = els.body.classList.contains('dark-mode');
    const colorText = isDark ? 'rgba(226, 232, 240, 0.8)' : 'rgba(0, 0, 0, 0.7)'; 
    const colorGrid = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';
    
    ChartJS.defaults.color = colorText; 
    ChartJS.defaults.borderColor = colorGrid;
    
    const createChart = (id, type, labels, data, labelStr, bgColors, borderColor, opts={}) => {
        const ctx = document.getElementById(id)?.getContext('2d'); 
        if (!ctx) return;
        
        if (chartsInstances[id]) chartsInstances[id].destroy();
        
        const mobile = isMobileDevice();
        chartsInstances[id] = new ChartJS(ctx, {
            type,
            data: { labels, datasets: [{ label: labelStr, data, backgroundColor: bgColors, borderColor: borderColor || (Array.isArray(bgColors)?bgColors[0]:bgColors), borderWidth: type.includes('line') ? 2 : 0, fill: true, tension: 0.3 }] },
            options: {
                responsive: true, maintainAspectRatio: false,
                interaction: { mode: 'nearest', intersect: false },
                events: mobile
                    ? ['touchstart', 'touchmove', 'click']
                    : ['mousemove', 'mouseout', 'click', 'touchstart', 'touchmove'],
                plugins: { legend: { display: true, labels: { color: colorText, boxWidth: 12 } } },
                scales: opts.scales || {},
                indexAxis: opts.indexAxis || 'x'
            }
        });
    };
    
    const count = (k) => { const c={}; filmes.forEach(f => (Array.isArray(f[k])?f[k]:[f[k]]).forEach(i=>{if(i)c[i]=(c[i]||0)+1})); return Object.entries(c).sort((a,b)=>b[1]-a[1]).slice(0,5); };
    
    const gens = count('genero'); createChart('generosChart','doughnut',gens.map(x=>x[0]),gens.map(x=>x[1]),'Filmes',['#a855f7','#3b82f6','#ec4899','#f97316','#14b8a6']);
    const dirs = count('direcao'); createChart('diretoresChart','bar',dirs.map(x=>x[0]),dirs.map(x=>x[1]),'Qtd.','rgba(236,72,153,0.7)',null,{indexAxis:'y'});
    
    const origs={}; filmes.forEach(f=>{if(f.origem)origs[f.origem]=(origs[f.origem]||0)+1}); createChart('origemChart','pie',Object.keys(origs),Object.values(origs),'Origem',['#3b82f6','#14b8a6']);
    const anosC={}; filmes.forEach(f=>{if(f.ano)anosC[f.ano]=(anosC[f.ano]||0)+1}); const topAnos=Object.entries(anosC).sort((a,b)=>b[0]-a[0]).slice(0,10).reverse(); createChart('anosChart','bar',topAnos.map(x=>x[0]),topAnos.map(x=>x[1]),'Qtd.','rgba(59,130,246,0.7)',null,{indexAxis:'y'});
    // ── Distribuição de Notas (barras com cor por faixa) ──
    const notasC = {};
    filmes.forEach(f => { if (f.nota != null) { const n = Math.round(f.nota); notasC[n] = (notasC[n] || 0) + 1; } });
    const nLabels = Array.from({length:11}, (_,i) => String(i));
    const nData   = nLabels.map(l => notasC[l] || 0);
    const nColors = nLabels.map(l => {
        const v = Number(l);
        if (v <= 4)  return 'rgba(239,68,68,0.75)';   // ruim → vermelho
        if (v <= 6)  return 'rgba(234,179,8,0.75)';    // ok → amarelo
        if (v <= 7)  return 'rgba(59,130,246,0.75)';   // bom → azul
        return 'rgba(34,197,94,0.75)';                  // ótimo → verde
    });
    {
        const ctx = document.getElementById('notasChart')?.getContext('2d');
        if (ctx) {
            if (chartsInstances['notasChart']) chartsInstances['notasChart'].destroy();
            chartsInstances['notasChart'] = new ChartJS(ctx, {
                type: 'bar',
                data: { labels: nLabels.map(l => `Nota ${l}`), datasets: [{ label: 'Filmes', data: nData, backgroundColor: nColors, borderWidth: 0, borderRadius: 4 }] },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false },
                        tooltip: { callbacks: { label: ctx => ` ${ctx.parsed.y} filme(s)` } }
                    },
                    scales: {
                        x: { ticks: { color: colorText }, grid: { display: false } },
                        y: { ticks: { color: colorText, precision: 0 }, grid: { color: colorGrid }, beginAtZero: true }
                    }
                }
            });
        }
    }

    // ── Média de Notas por Décadas (barras horizontais) ──
    {
        // Agrupa por décadas para evitar o ziguezague caótico ano a ano
        const medDec = {};
        filmes.forEach(f => {
            if (!f.ano || !f.nota) return;
            const dec = `${Math.floor(f.ano / 10) * 10}s`;
            if (!medDec[dec]) medDec[dec] = { s: 0, c: 0, min: 10, max: 0 };
            medDec[dec].s += f.nota;
            medDec[dec].c++;
            if (f.nota < medDec[dec].min) medDec[dec].min = f.nota;
            if (f.nota > medDec[dec].max) medDec[dec].max = f.nota;
        });

        const decLabels = Object.keys(medDec).sort();
        const decMedias = decLabels.map(d => parseFloat((medDec[d].s / medDec[d].c).toFixed(2)));
        const decCounts = decLabels.map(d => medDec[d].c);
        const mediaGeral = decMedias.length
            ? parseFloat((filmes.filter(f=>f.nota).reduce((s,f)=>s+f.nota,0) / filmes.filter(f=>f.nota).length).toFixed(2))
            : 0;

        // Cor da barra: verde se acima da média geral, azul se na média, laranja se abaixo
        const decColors = decMedias.map(m =>
            m >= mediaGeral + 0.3 ? 'rgba(34,197,94,0.75)'
            : m >= mediaGeral - 0.3 ? 'rgba(59,130,246,0.75)'
            : 'rgba(249,115,22,0.75)'
        );

        const ctx = document.getElementById('mediaNotasAnoChart')?.getContext('2d');
        if (ctx) {
            if (chartsInstances['mediaNotasAnoChart']) chartsInstances['mediaNotasAnoChart'].destroy();
            chartsInstances['mediaNotasAnoChart'] = new ChartJS(ctx, {
                type: 'bar',
                data: {
                    labels: decLabels,
                    datasets: [
                        {
                            label: 'Nota média',
                            data: decMedias,
                            backgroundColor: decColors,
                            borderWidth: 0,
                            borderRadius: 5,
                        },
                        {
                            // Linha da média geral como dataset de linha
                            label: `Média geral (${mediaGeral.toFixed(1)})`,
                            data: decLabels.map(() => mediaGeral),
                            type: 'line',
                            borderColor: 'rgba(255,255,255,0.35)',
                            borderWidth: 1.5,
                            borderDash: [6, 4],
                            pointRadius: 0,
                            fill: false,
                            order: 0
                        }
                    ]
                },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    plugins: {
                        legend: { display: true, labels: { color: colorText, boxWidth: 12, font: { size: 11 } } },
                        tooltip: {
                            callbacks: {
                                title: ctx => `Década de ${ctx[0].label}`,
                                label: ctx => {
                                    if (ctx.dataset.type === 'line') return ` Média geral: ${mediaGeral.toFixed(1)}`;
                                    const dec = decLabels[ctx.dataIndex];
                                    return [
                                        ` Nota média: ${ctx.parsed.y.toFixed(1)}`,
                                        ` Filmes: ${decCounts[ctx.dataIndex]}`
                                    ];
                                }
                            }
                        }
                    },
                    scales: {
                        x: { ticks: { color: colorText }, grid: { display: false } },
                        y: {
                            min: 5, max: 10,
                            ticks: { color: colorText, stepSize: 0.5 },
                            grid: { color: colorGrid },
                            title: { display: true, text: 'Nota média', color: colorText, font: { size: 11 } }
                        }
                    }
                }
            });
        }
    }

    // ── Assistidos por Mês ──
    {
        const mLab = [], mapM = {};
        const hojeM = new Date();
        const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
        for (let i = 11; i >= 0; i--) {
            const d = new Date(hojeM.getFullYear(), hojeM.getMonth() - i, 1);
            const k = `${cap(d.toLocaleString('pt-BR',{month:'short'}).replace('.','')).replace('./','')}/${d.getFullYear().toString().slice(-2)}`;
            mLab.push(k); mapM[k] = 0;
        }
        filmes.forEach(f => {
            if (f.assistido && f.dataAssistido) {
                const d = new Date(f.dataAssistido.replace(/-/g,'/'));
                const k = `${cap(d.toLocaleString('pt-BR',{month:'short'}).replace('.','')).replace('./','')}/${d.getFullYear().toString().slice(-2)}`;
                if (mapM[k] !== undefined) mapM[k]++;
            }
        });
        const vals = mLab.map(k => mapM[k]);
        const maxVal = Math.max(...vals, 1);
        const barColors = vals.map(v => v >= maxVal * 0.8 ? 'rgba(168,85,247,0.9)' : v >= maxVal * 0.4 ? 'rgba(168,85,247,0.6)' : 'rgba(168,85,247,0.3)');
        createChart('assistidosMesChart','bar',mLab,vals,'Assistidos',barColors);
    }

    // ── Nota × Era: barras empilhadas por faixa de nota, agrupadas por era ──
    {
        const scatterCtx = document.getElementById('scatterNotaAnoChart')?.getContext('2d');
        if (scatterCtx) {
            if (chartsInstances['scatterNotaAnoChart']) chartsInstances['scatterNotaAnoChart'].destroy();

            // Agrupa por era (décadas) e por faixa de nota
            const eras = {};
            filmes.filter(f => f.ano && f.nota).forEach(f => {
                const era = `${Math.floor(f.ano / 10) * 10}s`;
                if (!eras[era]) eras[era] = { otimo: 0, bom: 0, ok: 0, ruim: 0, total: 0 };
                eras[era].total++;
                if (f.nota >= 8)      eras[era].otimo++;
                else if (f.nota >= 7) eras[era].bom++;
                else if (f.nota >= 5) eras[era].ok++;
                else                  eras[era].ruim++;
            });

            const eraLabels = Object.keys(eras).sort();

            // Converte para percentual para facilitar comparação entre eras com tamanhos diferentes
            const toP = (era, key) => eras[era].total
                ? parseFloat(((eras[era][key] / eras[era].total) * 100).toFixed(1))
                : 0;

            chartsInstances['scatterNotaAnoChart'] = new ChartJS(scatterCtx, {
                type: 'bar',
                data: {
                    labels: eraLabels,
                    datasets: [
                        { label: 'Ótimo (≥8)', data: eraLabels.map(e => toP(e,'otimo')), backgroundColor: 'rgba(34,197,94,0.8)', borderWidth: 0, borderRadius: { topLeft: 0, topRight: 0, bottomLeft: 0, bottomRight: 0 }, stack: 'notas' },
                        { label: 'Bom (7–7.9)', data: eraLabels.map(e => toP(e,'bom')), backgroundColor: 'rgba(59,130,246,0.8)', borderWidth: 0, stack: 'notas' },
                        { label: 'Ok (5–6.9)', data: eraLabels.map(e => toP(e,'ok')), backgroundColor: 'rgba(234,179,8,0.8)', borderWidth: 0, stack: 'notas' },
                        { label: 'Ruim (<5)', data: eraLabels.map(e => toP(e,'ruim')), backgroundColor: 'rgba(239,68,68,0.8)', borderWidth: 0, stack: 'notas' },
                    ]
                },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    plugins: {
                        legend: { display: true, labels: { color: colorText, boxWidth: 12, font: { size: 11 } } },
                        tooltip: {
                            callbacks: {
                                title: ctx => `Filmes da década de ${ctx[0].label} (${eras[ctx[0].label]?.total || 0} filmes)`,
                                label: ctx => ` ${ctx.dataset.label}: ${ctx.parsed.y}% dos filmes desta era`
                            }
                        }
                    },
                    scales: {
                        x: { ticks: { color: colorText }, grid: { display: false }, stacked: true },
                        y: {
                            stacked: true,
                            max: 100,
                            ticks: { color: colorText, callback: v => v + '%' },
                            grid: { color: colorGrid },
                            title: { display: true, text: '% dos filmes desta era', color: colorText, font: { size: 11 } }
                        }
                    }
                }
            });
        }
    }

    // ── Progresso Acumulado ──
    {
        const progCtx = document.getElementById('progressoAcumuladoChart')?.getContext('2d');
        if (progCtx) {
            if (chartsInstances['progressoAcumuladoChart']) chartsInstances['progressoAcumuladoChart'].destroy();
            const porMes = {};
            filmes.filter(f => f.assistido && f.dataAssistido).forEach(f => {
                const m = f.dataAssistido.slice(0, 7);
                porMes[m] = (porMes[m] || 0) + 1;
            });
            const mesesOrdenados = Object.keys(porMes).sort();
            let acumulado = 0;
            const labelsAcum = mesesOrdenados.map(m => {
                const [y, mo] = m.split('-');
                const d = new Date(Number(y), Number(mo)-1, 1);
                return d.toLocaleString('pt-BR',{month:'short',year:'2-digit'}).replace('. ','/').replace('.','');
            });
            const dataAcum = mesesOrdenados.map(m => { acumulado += porMes[m]; return acumulado; });
            // Gradiente de cor da linha conforme sobe
            chartsInstances['progressoAcumuladoChart'] = new ChartJS(progCtx, {
                type: 'line',
                data: { labels: labelsAcum, datasets: [{
                    label: 'Filmes assistidos',
                    data: dataAcum,
                    backgroundColor: 'rgba(34,197,94,0.12)',
                    borderColor: '#22c55e',
                    borderWidth: 2.5,
                    fill: true,
                    tension: 0.4,
                    pointRadius: dataAcum.length > 30 ? 0 : 3,
                    pointHoverRadius: 6,
                    pointBackgroundColor: '#22c55e'
                }]},
                options: {
                    responsive: true, maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false },
                        tooltip: { callbacks: { label: ctx => ` Total: ${ctx.parsed.y} filmes` } }
                    },
                    scales: {
                        x: { ticks: { color: colorText, maxTicksLimit: 12, maxRotation: 45 }, grid: { display: false } },
                        y: { ticks: { color: colorText }, grid: { color: colorGrid }, beginAtZero: true }
                    }
                }
            });
        }
    }

    // ── Radar de Gostos ──
    {
        const radarCtx = document.getElementById('radarGostosChart')?.getContext('2d');
        if (radarCtx) {
            if (chartsInstances['radarGostosChart']) chartsInstances['radarGostosChart'].destroy();
            const genMedias = {};
            filmes.filter(f => f.nota && f.genero?.length).forEach(f => {
                f.genero.forEach(g => {
                    if (!genMedias[g]) genMedias[g] = { sum: 0, count: 0 };
                    genMedias[g].sum += f.nota;
                    genMedias[g].count++;
                });
            });
            // Ordena por quantidade de filmes e pega top 7
            const topGeneros = Object.entries(genMedias)
                .filter(([,v]) => v.count >= 2)  // pelo menos 2 filmes
                .sort((a,b) => b[1].count - a[1].count)
                .slice(0, 7)
                .map(([g, v]) => ({ g, media: parseFloat((v.sum/v.count).toFixed(1)), count: v.count }));

            if (topGeneros.length >= 3) {
                chartsInstances['radarGostosChart'] = new ChartJS(radarCtx, {
                    type: 'radar',
                    data: {
                        labels: topGeneros.map(x => `${x.g} (${x.count})`),
                        datasets: [{
                            label: 'Nota Média',
                            data: topGeneros.map(x => x.media),
                            backgroundColor: 'rgba(168,85,247,0.18)',
                            borderColor: '#a855f7',
                            borderWidth: 2,
                            pointBackgroundColor: topGeneros.map(x => x.media >= 8 ? '#22c55e' : x.media >= 7 ? '#a855f7' : '#f87171'),
                            pointRadius: 5,
                            pointHoverRadius: 7
                        }]
                    },
                    options: {
                        responsive: true, maintainAspectRatio: false,
                        plugins: {
                            legend: { display: false },
                            tooltip: { callbacks: { label: ctx => ` Nota média: ${ctx.parsed.r}` } }
                        },
                        scales: {
                            r: {
                                min: 5, max: 10,
                                ticks: { color: colorText, stepSize: 1, backdropColor: 'transparent', font: { size: 10 } },
                                grid: { color: colorGrid },
                                angleLines: { color: colorGrid },
                                pointLabels: { color: colorText, font: { size: 11 } }
                            }
                        }
                    }
                });
            } else {
                const el = document.getElementById('radarGostosChart');
                if (el) el.parentElement.innerHTML = '<p class="text-muted small text-center pt-5">Assista mais filmes de gêneros variados para ver o radar.</p>';
            }
        }
    }

    // ── Relógio Cinematográfico (por dia da semana) ──
    {
        const ctx = document.getElementById('relogioCinemaChart')?.getContext('2d');
        if (ctx) {
            if (chartsInstances['relogioCinemaChart']) chartsInstances['relogioCinemaChart'].destroy();
            const dias = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
            const contDias = new Array(7).fill(0);
            filmes.filter(f => f.assistido && f.dataAssistido).forEach(f => {
                const d = new Date(f.dataAssistido.replace(/-/g,'/'));
                contDias[d.getDay()]++;
            });
            const maxDia = Math.max(...contDias, 1);
            const diaColors = contDias.map(v => {
                const pct = v / maxDia;
                if (pct > 0.75) return 'rgba(59,130,246,0.85)';
                if (pct > 0.4)  return 'rgba(99,102,241,0.7)';
                return 'rgba(139,92,246,0.45)';
            });
            chartsInstances['relogioCinemaChart'] = new ChartJS(ctx, {
                type: 'bar',
                data: { labels: dias, datasets: [{ label: 'Filmes', data: contDias, backgroundColor: diaColors, borderWidth: 0, borderRadius: 6 }] },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    ...touchPlugin,
                    plugins: {
                        legend: { display: false },
                        tooltip: { callbacks: { label: c => ` ${c.parsed.y} filme(s) assistidos` } }
                    },
                    scales: {
                        x: { ticks: { color: colorText }, grid: { display: false } },
                        y: { ticks: { color: colorText, precision: 0 }, grid: { color: colorGrid }, beginAtZero: true }
                    }
                }
            });
        }
    }


    // ── Evolução do Gosto (nota média por ano de cadastro) ──
    {
        const ctx = document.getElementById('evolucaoGostoChart')?.getContext('2d');
        if (ctx) {
            if (chartsInstances['evolucaoGostoChart']) chartsInstances['evolucaoGostoChart'].destroy();
            const porAnoUso = {};
            filmes.filter(f => f.assistido && f.nota && f.cadastradoEm).forEach(f => {
                const ano = new Date(f.cadastradoEm?.seconds ? f.cadastradoEm.seconds*1000 : f.cadastradoEm).getFullYear();
                if (!porAnoUso[ano]) porAnoUso[ano] = { s: 0, c: 0 };
                porAnoUso[ano].s += f.nota;
                porAnoUso[ano].c++;
            });
            const anos = Object.keys(porAnoUso).sort();
            const medias = anos.map(a => parseFloat((porAnoUso[a].s/porAnoUso[a].c).toFixed(2)));
            const mediaGeral2 = medias.length ? parseFloat((medias.reduce((s,v)=>s+v,0)/medias.length).toFixed(2)) : 0;
            if (anos.length >= 2) {
                chartsInstances['evolucaoGostoChart'] = new ChartJS(ctx, {
                    type: 'line',
                    data: { labels: anos, datasets: [
                        { label: 'Nota média', data: medias, borderColor: '#a855f7', backgroundColor: 'rgba(168,85,247,0.1)', borderWidth: 2.5, fill: true, tension: 0.4, pointRadius: 6, pointBackgroundColor: medias.map(m => m >= mediaGeral2 ? '#22c55e' : '#f87171'), pointBorderWidth: 0 },
                        { label: `Média geral (${mediaGeral2.toFixed(1)})`, data: anos.map(()=>mediaGeral2), borderColor: 'rgba(255,255,255,0.2)', borderWidth: 1, borderDash: [5,4], pointRadius: 0, fill: false }
                    ]},
                    options: {
                        responsive: true, maintainAspectRatio: false,
                        ...touchPlugin,
                        plugins: {
                            legend: { display: true, labels: { color: colorText, boxWidth: 12 } },
                            tooltip: { callbacks: { label: c => ` ${c.dataset.label}: ${c.parsed.y}` } }
                        },
                        scales: {
                            x: { ticks: { color: colorText }, grid: { display: false } },
                            y: { min: 5, max: 10, ticks: { color: colorText, stepSize: 0.5 }, grid: { color: colorGrid } }
                        }
                    }
                });
            } else if (ctx.canvas?.parentElement) {
                ctx.canvas.parentElement.innerHTML = '<p class="text-muted small text-center pt-5">Dados insuficientes.<br>Use o app por mais de 1 ano para ver a evolução.</p>';
            }
        }
    }


    // ── Evolução da Nota Média ao longo do tempo de uso ──
    {
        const evolCtx = document.getElementById('evolucaoGostoChart')?.getContext('2d');
        if (evolCtx) {
            if (chartsInstances['evolucaoGostoChart']) chartsInstances['evolucaoGostoChart'].destroy();
            // Agrupa por mês de cadastro (não de lançamento)
            const porMesCad = {};
            filmes.filter(f => f.nota && f.cadastradoEm).forEach(f => {
                const d = new Date(f.cadastradoEm);
                const k = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
                if (!porMesCad[k]) porMesCad[k] = { sum: 0, count: 0 };
                porMesCad[k].sum += f.nota;
                porMesCad[k].count++;
            });
            const meses = Object.keys(porMesCad).sort();
            // Média móvel de 3 meses para suavizar
            const medias = meses.map((m, i) => {
                const slice = meses.slice(Math.max(0, i-1), i+2);
                const total = slice.reduce((s, k) => s + porMesCad[k].sum, 0);
                const count = slice.reduce((s, k) => s + porMesCad[k].count, 0);
                return count ? parseFloat((total / count).toFixed(2)) : null;
            });
            const labels = meses.map(m => {
                const [y, mo] = m.split('-');
                return new Date(Number(y), Number(mo)-1).toLocaleString('pt-BR', {month:'short', year:'2-digit'}).replace('. ','/');
            });
            chartsInstances['evolucaoGostoChart'] = new ChartJS(evolCtx, {
                type: 'line',
                data: { labels, datasets: [{
                    label: 'Nota média (média móvel 3m)',
                    data: medias,
                    borderColor: '#a855f7',
                    backgroundColor: 'rgba(168,85,247,0.1)',
                    borderWidth: 2.5,
                    fill: true,
                    tension: 0.4,
                    pointRadius: medias.length > 24 ? 0 : 3,
                    pointHoverRadius: 6,
                    pointBackgroundColor: '#a855f7',
                    spanGaps: true
                }]},
                options: {
                    responsive: true, maintainAspectRatio: false,
                    interaction: { mode: 'nearest', intersect: false },
                    plugins: {
                        legend: { display: false },
                        tooltip: { callbacks: { label: ctx => ` Nota média: ${ctx.parsed.y?.toFixed(1)}` } }
                    },
                    scales: {
                        x: { ticks: { color: colorText, maxTicksLimit: 12, maxRotation: 45 }, grid: { display: false } },
                        y: { min: 5, max: 10, ticks: { color: colorText, stepSize: 0.5 }, grid: { color: colorGrid } }
                    }
                }
            });
        }
    }

    // ── Heatmap Gênero × Nota Média (redesenhado) ──
    {
        const heatmapEl = document.getElementById('heatmap-genero-nota');
        if (heatmapEl) {
            const genNotas = {};
            filmes.filter(f => f.nota && f.genero?.length).forEach(f => {
                f.genero.forEach(g => {
                    if (!genNotas[g]) genNotas[g] = { sum: 0, count: 0 };
                    genNotas[g].sum += f.nota;
                    genNotas[g].count++;
                });
            });
            const topG = Object.entries(genNotas)
                .filter(([,v]) => v.count >= 2)
                .sort((a,b) => b[1].count - a[1].count)
                .slice(0, 12);
            const maxCount2 = Math.max(...topG.map(([,v]) => v.count), 1);
            const mediaGeralG = filmes.filter(f=>f.nota).reduce((s,f)=>s+f.nota,0) / (filmes.filter(f=>f.nota).length || 1);

            const header = `
                <div style="display:grid;grid-template-columns:130px 1fr 60px 55px 70px;gap:8px;padding:4px 0 8px;border-bottom:1px solid rgba(255,255,255,0.1);margin-bottom:4px;">
                    <span style="font-size:0.7rem;color:rgba(255,255,255,0.3);text-transform:uppercase;letter-spacing:0.08em;">Gênero</span>
                    <span style="font-size:0.7rem;color:rgba(255,255,255,0.3);text-transform:uppercase;letter-spacing:0.08em;">Qtd. assistidos</span>
                    <span style="font-size:0.7rem;color:rgba(255,255,255,0.3);text-align:right;text-transform:uppercase;letter-spacing:0.08em;">Filmes</span>
                    <span style="font-size:0.7rem;color:rgba(255,255,255,0.3);text-align:right;text-transform:uppercase;letter-spacing:0.08em;">Média</span>
                    <span style="font-size:0.7rem;color:rgba(255,255,255,0.3);text-align:right;text-transform:uppercase;letter-spacing:0.08em;">vs Geral</span>
                </div>`;

            const rows = topG.map(([g, v]) => {
                const media = parseFloat((v.sum / v.count).toFixed(1));
                const pct = Math.round((v.count / maxCount2) * 100);
                const diff = parseFloat((media - mediaGeralG).toFixed(1));
                const hue = Math.round(Math.max(0, Math.min(120, ((media - 5) / 5) * 120)));
                const diffStr = diff > 0 ? `<span style="color:#22c55e;">+${diff}</span>` : diff < 0 ? `<span style="color:#f87171;">${diff}</span>` : `<span style="color:rgba(255,255,255,0.3);">=${diff}</span>`;
                return `
                    <div style="display:grid;grid-template-columns:130px 1fr 60px 55px 70px;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.04);">
                        <span style="font-size:0.82rem;color:rgba(255,255,255,0.8);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${g}">${g}</span>
                        <div style="background:rgba(255,255,255,0.06);border-radius:3px;height:8px;overflow:hidden;">
                            <div style="width:${pct}%;height:100%;background:hsl(${hue},65%,50%);border-radius:3px;"></div>
                        </div>
                        <span style="font-size:0.78rem;color:rgba(255,255,255,0.5);text-align:right;">${v.count}</span>
                        <span style="font-size:0.82rem;font-weight:600;color:hsl(${hue},65%,62%);text-align:right;">${media}</span>
                        <span style="font-size:0.78rem;text-align:right;">${diffStr}</span>
                    </div>`;
            }).join('');

            heatmapEl.innerHTML = `
                <div style="padding:8px 0;">
                    <p style="font-size:0.75rem;color:rgba(255,255,255,0.3);margin-bottom:8px;">Média geral: <strong style="color:rgba(255,255,255,0.5);">${mediaGeralG.toFixed(1)}</strong> — coluna "vs Geral" mostra se você gosta mais ou menos deste gênero em relação à sua média.</p>
                    ${header}${rows}
                </div>`;
        }
    }
};