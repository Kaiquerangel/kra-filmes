import { els, templates } from './elements.js';
import { getResizedUrl } from './helpers.js';

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
        containerUltimos.innerHTML = `<div class="d-flex align-items-center justify-content-center w-100 p-4 text-muted border rounded" style="background: rgba(0,0,0,0.05);"><i class="fas fa-history me-2"></i> Nenhum filme assistido.</div>`; 
    } else {
        const html = ultimos10.map((f, i) => `
            <div class="flex-shrink-0 mini-movie-card js-carousel-card" data-target-id="${f.id}" tabindex="0" style="animation: slideInRight 0.35s ease forwards; animation-delay: ${i * 70}ms; opacity: 0; cursor: pointer;" title="Ver ${f.titulo}">
                <div class="mini-poster-wrapper mb-2">
                    <img src="${getResizedUrl(f.posterUrl, 200)}" loading="lazy" decoding="async" class="movie-poster-img" width="110" height="165" style="object-fit:cover;" alt="${f.titulo}" onerror="this.style.display='none';">
                    <div class="mini-date-badge"><i class="fas fa-calendar-check me-1"></i>${templates.date(f.dataAssistido)}</div>
                </div>
                <div class="text-truncate text-center fw-medium px-1 text-muted" style="font-size: 0.8rem;">${f.titulo}</div>
            </div>`).join('');
            
        requestAnimationFrame(() => { containerUltimos.innerHTML = html; });
    }
};

export const renderRankings = (elId, data) => {
    const container = document.getElementById(elId); 
    if (!container) return;
    if (!data.length) { container.innerHTML = '<p class="text-muted small">N/A</p>'; return; }
    
    const max = Math.max(...data.map(d => d[1]));
    const html = data.map(([label, count]) => `
        <div class="ranking-bar-item mb-2">
            <span class="ranking-bar-label">${label}</span>
            <div class="ranking-bar-container">
                <div class="ranking-bar" style="width: ${(count/max)*100}%" title="${label}: ${count}"></div>
            </div>
            <span class="ranking-bar-count">${count}</span>
        </div>
    `).join('');
    
    container.innerHTML = html;
};

export const renderCharts = (filmes) => {
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
        
        chartsInstances[id] = new ChartJS(ctx, { 
            type, 
            data: { labels, datasets: [{ label: labelStr, data, backgroundColor: bgColors, borderColor: borderColor || (Array.isArray(bgColors)?bgColors[0]:bgColors), borderWidth: type.includes('line') ? 2 : 0, fill: true, tension: 0.3 }] }, 
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: true, labels: { color: colorText, boxWidth: 12 } } }, scales: opts.scales || {}, indexAxis: opts.indexAxis || 'x' } 
        });
    };
    
    const count = (k) => { const c={}; filmes.forEach(f => (Array.isArray(f[k])?f[k]:[f[k]]).forEach(i=>{if(i)c[i]=(c[i]||0)+1})); return Object.entries(c).sort((a,b)=>b[1]-a[1]).slice(0,5); };
    
    const gens = count('genero'); createChart('generosChart','doughnut',gens.map(x=>x[0]),gens.map(x=>x[1]),'Filmes',['#a855f7','#3b82f6','#ec4899','#f97316','#14b8a6']);
    const dirs = count('direcao'); createChart('diretoresChart','bar',dirs.map(x=>x[0]),dirs.map(x=>x[1]),'Qtd.','rgba(236,72,153,0.7)',null,{indexAxis:'y'});
    
    const origs={}; filmes.forEach(f=>{if(f.origem)origs[f.origem]=(origs[f.origem]||0)+1}); createChart('origemChart','pie',Object.keys(origs),Object.values(origs),'Origem',['#3b82f6','#14b8a6']);
    const anosC={}; filmes.forEach(f=>{if(f.ano)anosC[f.ano]=(anosC[f.ano]||0)+1}); const topAnos=Object.entries(anosC).sort((a,b)=>b[0]-a[0]).slice(0,10).reverse(); createChart('anosChart','bar',topAnos.map(x=>x[0]),topAnos.map(x=>x[1]),'Qtd.','rgba(59,130,246,0.7)',null,{indexAxis:'y'});
    const notasC={}; filmes.forEach(f=>{if(f.nota!=null){const n=Math.round(f.nota);notasC[n]=(notasC[n]||0)+1}}); const nLabels=Object.keys(notasC).sort((a,b)=>a-b); createChart('notasChart','line',nLabels,nLabels.map(l=>notasC[l]),'Qtd.','rgba(236,72,153,0.2)','#ec4899');
    
    const medAno={}; filmes.forEach(f=>{if(f.ano&&f.nota){if(!medAno[f.ano])medAno[f.ano]={s:0,c:0};medAno[f.ano].s+=f.nota;medAno[f.ano].c++}}); const anosM=Object.keys(medAno).sort(); createChart('mediaNotasAnoChart','line',anosM,anosM.map(a=>(medAno[a].s/medAno[a].c).toFixed(1)),'Média','rgba(249,115,22,0.2)','#f97316');
    
    const mLab=[]; const mapM={}; const hoje=new Date(); const cap = s => s.charAt(0).toUpperCase()+s.slice(1);
    for(let i=11;i>=0;i--){ const d=new Date(hoje.getFullYear(),hoje.getMonth()-i,1); const k=`${cap(d.toLocaleString('pt-BR',{month:'short'}).replace('.',''))}/${d.getFullYear().toString().slice(-2)}`; mLab.push(k); mapM[k]=0; }
    filmes.forEach(f=>{ if(f.assistido&&f.dataAssistido){ const d=new Date(f.dataAssistido); const k=`${cap(d.toLocaleString('pt-BR',{month:'short'}).replace('.',''))}/${d.getFullYear().toString().slice(-2)}`; if(mapM[k]!==undefined) mapM[k]++; } });
    createChart('assistidosMesChart','bar',mLab,mLab.map(k=>mapM[k]),'Assistidos','rgba(168,85,247,0.7)');
};