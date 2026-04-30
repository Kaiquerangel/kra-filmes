/**
 * filters.worker.js
 * Executa filtros, ordenação e cálculo de stats fora da thread principal.
 */

self.onmessage = (e) => {
    const { tipo, payload } = e.data;
    switch (tipo) {
        case 'filtrar': {
            const { filmes, filtros, sortBy, sortDir } = payload;
            const resultado = aplicarFiltros(filmes, filtros);
            const ordenado  = ordenar(resultado, sortBy, sortDir);
            self.postMessage({ tipo: 'filtrado', filmes: ordenado });
            break;
        }
        case 'stats': {
            const stats = calcularStats(payload.filmes);
            self.postMessage({ tipo: 'stats', ...stats });
            break;
        }
    }
};

function aplicarFiltros(filmes, f) {
    return filmes.filter(filme => {
        if (f.titulo && !filme.titulo?.toLowerCase().includes(f.titulo.toLowerCase())) return false;
        if (f.genero && f.genero !== 'todos' && !filme.genero?.includes(f.genero)) return false;
        if (f.tag && !filme.tags?.includes(f.tag)) return false;
        if (f.direcao && !filme.direcao?.some(d => d.toLowerCase().includes(f.direcao.toLowerCase()))) return false;
        if (f.artista && !filme.atores?.some(a => a.toLowerCase().includes(f.artista.toLowerCase()))) return false;
        if (f.origem && f.origem !== 'todos' && filme.origem !== f.origem) return false;
        if (f.status === 'assistido' && !filme.assistido) return false;
        if (f.status === 'pendente' && filme.assistido) return false;
        if (f.notaMin != null && (filme.nota || 0) < f.notaMin) return false;
        if (f.notaMax != null && (filme.nota || 0) > f.notaMax) return false;
        if (f.anoLanc && filme.ano !== parseInt(f.anoLanc)) return false;
        if (f.dataIni && filme.dataAssistido && filme.dataAssistido < f.dataIni) return false;
        if (f.dataFim && filme.dataAssistido && filme.dataAssistido > f.dataFim) return false;
        return true;
    });
}

function ordenar(filmes, sortBy, dir) {
    const asc = dir === 'asc';
    return [...filmes].sort((a, b) => {
        let va = a[sortBy], vb = b[sortBy];
        if (sortBy === 'titulo') {
            return asc
                ? (va||'').toLowerCase().localeCompare((vb||'').toLowerCase())
                : (vb||'').toLowerCase().localeCompare((va||'').toLowerCase());
        }
        va = va ?? (asc ? Infinity : -Infinity);
        vb = vb ?? (asc ? Infinity : -Infinity);
        return asc ? va - vb : vb - va;
    });
}

function calcularStats(filmes) {
    const assistidos = filmes.filter(f => f.assistido && f.nota);
    if (!assistidos.length) return { media: 0, mediana: 0, melhor: null, pior: null, streak: 0 };

    const notas   = assistidos.map(f => f.nota).sort((a,b) => a - b);
    const mid     = Math.floor(notas.length / 2);
    const mediana = notas.length % 2 === 0 ? (notas[mid-1]+notas[mid])/2 : notas[mid];
    const media   = notas.reduce((s,n) => s+n, 0) / notas.length;

    const sorted = [...assistidos].sort((a,b) => (b.nota||0)-(a.nota||0));

    const dias = new Set(assistidos.filter(f=>f.dataAssistido).map(f=>f.dataAssistido.slice(0,10)));
    let streak = 0;
    const hoje = new Date();
    const toStr = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    let check = new Date(hoje);
    if (!dias.has(toStr(check))) check.setDate(check.getDate()-1);
    while (dias.has(toStr(check))) { streak++; check.setDate(check.getDate()-1); }

    return {
        media: parseFloat(media.toFixed(1)),
        mediana: parseFloat(mediana.toFixed(1)),
        melhor: sorted[0],
        pior: sorted[sorted.length-1],
        streak
    };
}