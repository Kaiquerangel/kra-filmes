export const Filters = {
    val: (id) => {
        const el = document.getElementById(id);
        return el ? el.value.toLowerCase().trim() : ''; 
    },

    aplicar: (lista) => {
        const termo = Filters.val('filtro-busca');
        const genero = Filters.val('filtro-genero');
        const tagFiltro = Filters.val('filtro-tag');
        const diretor = Filters.val('filtro-diretor');
        const ator = Filters.val('filtro-ator');
        
        const ano = document.getElementById('filtro-ano')?.value || 'todos';
        const origem = document.getElementById('filtro-origem')?.value || 'todos';
        const status = document.getElementById('filtro-assistido')?.value || 'todos';
        const anoAssist = document.getElementById('filtro-ano-assistido')?.value || 'todos';
        
        const dtIni = document.getElementById('filtro-data-inicio')?.value;
        const dtFim = document.getElementById('filtro-data-fim')?.value;

        // NOVO: Valores de Range da Nota
        const notaMin = parseFloat(document.getElementById('filtro-nota-min')?.value);
        const notaMax = parseFloat(document.getElementById('filtro-nota-max')?.value);

        return lista.filter(f => {
            if (termo && !f.titulo.toLowerCase().includes(termo)) return false;
            if (genero && !f.genero?.some(g => g.toLowerCase().includes(genero))) return false;
            if (tagFiltro && !f.tags?.some(t => t.toLowerCase().includes(tagFiltro))) return false;
            if (diretor && !f.direcao?.some(d => d.toLowerCase().includes(diretor))) return false;
            if (ator && !f.atores?.some(a => a.toLowerCase().includes(ator))) return false;
            if (ano !== 'todos' && f.ano.toString() !== ano) return false;
            if (origem !== 'todos' && f.origem !== origem) return false;
            
            if (status !== 'todos') {
                const isAssistido = status === 'sim';
                if (f.assistido !== isAssistido) return false;
            }
            
            if (anoAssist !== 'todos') {
                if (!f.assistido || !f.dataAssistido || !f.dataAssistido.startsWith(anoAssist)) return false;
            }
            
            if (dtIni || dtFim) {
                if (!f.dataAssistido) return false;
                if (dtIni && f.dataAssistido < dtIni) return false;
                if (dtFim && f.dataAssistido > dtFim) return false;
            }

            // NOVO: Filtro por faixa de nota
            if (!isNaN(notaMin) && (f.nota || 0) < notaMin) return false;
            if (!isNaN(notaMax) && (f.nota || 0) > notaMax) return false;
            
            return true;
        });
    },

    ordenar: (lista, sortBy, sortDirection) => {
        return [...lista].sort((a, b) => {
            let valorA = a[sortBy];
            let valorB = b[sortBy];

            if (valorA == null) valorA = '';
            if (valorB == null) valorB = '';

            let comparacao = 0;

            if (sortBy === 'cadastradoEm' || sortBy === 'dataAssistido') {
                const timeA = valorA ? new Date(valorA).getTime() : 0;
                const timeB = valorB ? new Date(valorB).getTime() : 0;
                comparacao = (isNaN(timeA) ? 0 : timeA) - (isNaN(timeB) ? 0 : timeB);
            } 
            else if (typeof valorA === 'number' && typeof valorB === 'number') {
                comparacao = valorA - valorB;
            } 
            else {
                comparacao = String(valorA).localeCompare(String(valorB));
            }
            
            return sortDirection === 'asc' ? comparacao : -comparacao;
        });
    },

    atualizarExtras: (filmes) => {
        const anos = [...new Set(filmes.map(f => f.ano).filter(Boolean))].sort((a, b) => b - a);
        Filters.updateSelect('filtro-ano', anos, 'Ano Lanç.');
        
        const anosAssistidos = [...new Set(filmes.filter(f => f.assistido && f.dataAssistido).map(f => f.dataAssistido.slice(0, 4)))].sort((a, b) => b - a);
        Filters.updateSelect('filtro-ano-assistido', anosAssistidos, 'Ano Assist.');
    },

    updateSelect: (id, values, defaultText) => {
        const selectEl = document.getElementById(id);
        if (!selectEl) return;
        
        const valorAtual = selectEl.value;
        
        selectEl.innerHTML = `<option value="todos">${defaultText}</option>` + 
            values.map(v => `<option value="${v}">${v}</option>`).join('');
        
        if (values.includes(Number(valorAtual)) || values.includes(valorAtual)) {
            selectEl.value = valorAtual;
        }
    }
};