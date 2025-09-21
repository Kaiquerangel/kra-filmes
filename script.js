document.addEventListener('DOMContentLoaded', function () {
    // --- CONFIGURAÇÃO FIREBASE (com 'where' adicionado) ---
    const { db, collection, addDoc, getDocs, doc, updateDoc, deleteDoc, serverTimestamp, query, orderBy, where } = window.db;

    // --- ESTADO DA APLICAÇÃO ---
    let filmes = [];
    let filmeEmEdicao = null;
    let charts = {};
    let sortBy = 'cadastradoEm';
    let sortDirection = 'asc';

    // --- CACHE DE ELEMENTOS DO DOM ---
    const body = document.body;
    const themeToggleBtn = document.getElementById('theme-toggle');
    const dataAssistidoGroup = document.getElementById('data-assistido-group');

    const formElements = {
        form: document.getElementById('filme-form'),
        titulo: document.getElementById('titulo'),
        ano: document.getElementById('ano'),
        nota: document.getElementById('nota'),
        direcao: document.getElementById('direcao'),
        atores: document.getElementById('atores'),
        genero: document.getElementById('genero'),
        origem: document.getElementById('origem'),
        assistido: document.getElementById('assistido'),
        dataAssistido: document.getElementById('data-assistido'),
    };

    const filterElements = {
        container: document.getElementById('filtros-container'),
        busca: document.getElementById('filtro-busca'),
        genero: document.getElementById('filtro-genero'),
        diretor: document.getElementById('filtro-diretor'),
        ator: document.getElementById('filtro-ator'),
        ano: document.getElementById('filtro-ano'),
        origem: document.getElementById('filtro-origem'),
        assistido: document.getElementById('filtro-assistido'),
        limparBtn: document.getElementById('limpar-filtros'),
    };

    // --- FUNÇÕES AUXILIARES ---

    // NOVA FUNÇÃO AUXILIAR PARA EXIBIR TOASTS DE SUCESSO
    const showToast = (title) => {
        const Toast = Swal.mixin({
            toast: true,
            position: 'top-end',
            showConfirmButton: false,
            timer: 3000,
            timerProgressBar: true,
            didOpen: (toast) => {
                toast.addEventListener('mouseenter', Swal.stopTimer);
                toast.addEventListener('mouseleave', Swal.resumeTimer);
            }
        });
        Toast.fire({
            icon: 'success',
            title: title
        });
    };

    const parseCSV = (string) => string.split(',').map(s => s.trim()).filter(Boolean);

    const popularSelect = (selectElement, items, label) => {
        selectElement.innerHTML = `<option value="todos">${label}</option>`;
        [...new Set(items)].sort().forEach(item => {
            if (item) {
                selectElement.add(new Option(item, item));
            }
        });
    };

    const criarRanking = (listaDeFilmes, campo) => {
        const contagem = listaDeFilmes.flatMap(f => f[campo] || []).reduce((acc, item) => {
            if (item) acc[item] = (acc[item] || 0) + 1;
            return acc;
        }, {});
        return Object.entries(contagem).sort(([, a], [, b]) => b - a).slice(0, 10);
    };

    const renderizarRanking = (elementId, ranking) => {
        const ul = document.getElementById(elementId);
        ul.innerHTML = ranking.length > 0
            ? ranking.map(([nome, qtd]) => `
                <li class="list-group-item">
                    ${nome}
                    <span class="ranking-count">${qtd}</span>
                </li>
            `).join('')
            : '<li class="list-group-item">N/A</li>';
    };

    // --- LÓGICA PRINCIPAL ---
    const atualizarUI = (listaDeFilmes = filmes) => {
        const filmesFiltrados = aplicarFiltrosEordenacao(listaDeFilmes);
        const filmesAssistidosParaTabela = filmesFiltrados.filter(filme => filme.assistido);
        const filmesNaoAssistidosParaTabela = filmesFiltrados.filter(filme => !filme.assistido);
        renderizarTabela(filmesFiltrados, 'tabela-todos-container');
        renderizarTabela(filmesAssistidosParaTabela, 'tabela-assistidos-container');
        renderizarTabela(filmesNaoAssistidosParaTabela, 'tabela-nao-assistidos-container');
        const filmesParaEstasticasEgraficos = filmesFiltrados.filter(filme => filme.assistido);
        atualizarEstatisticas(filmesParaEstasticasEgraficos);
        renderizarGraficos(filmesParaEstasticasEgraficos);
    };

    const popularFiltros = (listaDeFilmes) => {
        const todosAnos = listaDeFilmes.map(filme => filme.ano).filter(Boolean);
        popularSelect(filterElements.ano, todosAnos.sort((a,b) => b-a), "Todos os Anos");
    };

    const aplicarFiltrosEordenacao = (listaDeFilmes) => {
        let filmesProcessados = [...listaDeFilmes];
        const filtros = {
            busca: filterElements.busca.value.toLowerCase(),
            genero: filterElements.genero.value.toLowerCase(),
            diretor: filterElements.diretor.value.toLowerCase(),
            ator: filterElements.ator.value.toLowerCase(),
            ano: filterElements.ano.value,
            origem: filterElements.origem.value,
            assistido: filterElements.assistido.value,
        };
        if (filtros.busca) filmesProcessados = filmesProcessados.filter(f => f.titulo.toLowerCase().includes(filtros.busca));
        if (filtros.genero) filmesProcessados = filmesProcessados.filter(f => f.genero?.some(g => g.toLowerCase().includes(filtros.genero)));
        if (filtros.diretor) filmesProcessados = filmesProcessados.filter(f => f.direcao?.some(d => d.toLowerCase().includes(filtros.diretor)));
        if (filtros.ator) filmesProcessados = filmesProcessados.filter(f => f.atores?.some(a => a.toLowerCase().includes(filtros.ator)));
        if (filtros.ano && filtros.ano !== 'todos') filmesProcessados = filmesProcessados.filter(f => f.ano.toString() === filtros.ano);
        if (filtros.origem !== 'todos') filmesProcessados = filmesProcessados.filter(f => f.origem === filtros.origem);
        if (filtros.assistido !== 'todos') filmesProcessados = filmesProcessados.filter(f => f.assistido === (filtros.assistido === 'sim'));
        return filmesProcessados.sort((a, b) => {
            if (!a.hasOwnProperty(sortBy) || a[sortBy] === null) return 1;
            if (!b.hasOwnProperty(sortBy) || b[sortBy] === null) return -1;
            const valA = a[sortBy];
            const valB = b[sortBy];
            let comparison = 0;
            if (typeof valA === 'string') {
                comparison = valA.localeCompare(valB);
            } else {
                comparison = valA - valB;
            }
            return sortDirection === 'asc' ? comparison : -comparison;
        });
    };

    // --- FUNÇÕES CRUD ---
    const carregarFilmes = async () => {
        try {
            const q = query(collection(db, "filmes"), orderBy("cadastradoEm", "asc"));
            const querySnapshot = await getDocs(q);
            filmes = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                cadastradoEm: doc.data().cadastradoEm?.toDate() || new Date(0),
            }));
            popularFiltros(filmes);
            atualizarUI();
        } catch (error) {
            console.error("Erro ao carregar filmes:", error);
            Swal.fire({ icon: 'error', title: 'Oops...', text: 'Não foi possível carregar os filmes.' });
        }
    };

    const salvarFilme = async (event) => {
        event.preventDefault();
        const tituloValue = formElements.titulo.value.trim();
        if (!tituloValue) {
            Swal.fire({ icon: 'warning', title: 'Atenção', text: 'O campo "Título" é obrigatório.' });
            formElements.titulo.focus();
            return;
        }
        if (!filmeEmEdicao) {
            try {
                const q = query(collection(db, "filmes"), where("titulo", "==", tituloValue));
                const querySnapshot = await getDocs(q);
                if (!querySnapshot.empty) {
                    Swal.fire({ icon: 'error', title: 'Filme Duplicado', text: 'Um filme com este título já foi cadastrado.' });
                    formElements.titulo.focus();
                    return;
                }
            } catch (error) {
                console.error("Erro ao verificar duplicidade de filme:", error);
                Swal.fire({ icon: 'error', title: 'Oops...', text: 'Ocorreu um erro ao verificar se o filme já existe. Tente novamente.' });
                return;
            }
        }
        const isAssistido = formElements.assistido.value === 'sim';
        const filmeData = {
            titulo: tituloValue,
            ano: parseInt(formElements.ano.value, 10),
            nota: parseFloat(formElements.nota.value),
            direcao: parseCSV(formElements.direcao.value),
            atores: parseCSV(formElements.atores.value),
            genero: parseCSV(formElements.genero.value),
            origem: formElements.origem.value,
            assistido: isAssistido,
            dataAssistido: isAssistido ? formElements.dataAssistido.value : null,
        };
        try {
            if (filmeEmEdicao) {
                const docRef = doc(db, "filmes", filmeEmEdicao);
                await updateDoc(docRef, filmeData);
                const index = filmes.findIndex(f => f.id === filmeEmEdicao);
                if (index > -1) filmes[index] = { ...filmes[index], ...filmeData };
                showToast('Filme atualizado com sucesso!');
            } else {
                filmeData.cadastradoEm = serverTimestamp();
                const docRef = await addDoc(collection(db, "filmes"), filmeData);
                filmes.push({ id: docRef.id, ...filmeData, cadastradoEm: new Date() });
                showToast('Filme salvo com sucesso!');
            }
            formElements.form.reset();
            filmeEmEdicao = null;
            dataAssistidoGroup.style.display = 'none';
            popularFiltros(filmes);
            atualizarUI();
        } catch (error) {
            console.error("Erro ao salvar filme:", error);
            Swal.fire({ icon: 'error', title: 'Oops...', text: 'Ocorreu um erro ao salvar o filme.' });
        }
    };

    const prepararEdicao = (id) => {
        const filme = filmes.find(f => f.id === id);
        if (!filme) return;
        filmeEmEdicao = id;
        formElements.titulo.value = filme.titulo;
        formElements.ano.value = filme.ano;
        formElements.nota.value = filme.nota;
        formElements.direcao.value = filme.direcao?.join(', ') || '';
        formElements.atores.value = filme.atores?.join(', ') || '';
        formElements.genero.value = filme.genero?.join(', ') || '';
        formElements.origem.value = filme.origem;
        formElements.assistido.value = filme.assistido ? 'sim' : 'nao';
        formElements.assistido.dispatchEvent(new Event('change'));
        if (filme.assistido) {
            formElements.dataAssistido.value = filme.dataAssistido;
        }
        window.scrollTo({ top: 0, behavior: 'smooth' });
        formElements.titulo.focus();
    };

    const deletarFilme = async (id) => {
        Swal.fire({
            title: 'Tem certeza?',
            text: "Você não poderá reverter esta ação!",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#3085d6',
            cancelButtonColor: '#d33',
            confirmButtonText: 'Sim, excluir!',
            cancelButtonText: 'Cancelar'
        }).then(async (result) => {
            if (result.isConfirmed) {
                try {
                    await deleteDoc(doc(db, "filmes", id));
                    filmes = filmes.filter(f => f.id !== id);
                    showToast('Filme excluído com sucesso!');
                    atualizarUI();
                } catch (error) {
                    console.error("Erro ao excluir filme:", error);
                    Swal.fire({ icon: 'error', title: 'Oops...', text: 'Ocorreu um erro ao excluir o filme.' });
                }
            }
        });
    };

    // --- FUNÇÕES DE RENDERIZAÇÃO ---
    function renderizarTabela(listaDeFilmes, containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;
        if (listaDeFilmes.length === 0) {
            container.innerHTML = '<p class="text-center text-muted pt-3">Nenhum filme encontrado.</p>';
            return;
        }
        const getSortIndicator = (column) => {
            if (sortBy === column) return sortDirection === 'asc' ? ' <i class="fas fa-sort-up"></i>' : ' <i class="fas fa-sort-down"></i>';
            return '';
        };
        const rows = listaDeFilmes.map((filme, index) => `
            <tr data-id="${filme.id}">
                <td class="col-num">${index + 1}</td>
                <td class="col-titulo">${filme.titulo || 'N/A'}</td>
                <td class="col-nota">⭐ ${(filme.nota || 0).toFixed(1)}</td>
                <td class="col-ano">${filme.ano || '-'}</td>
                <td class="col-direcao">${filme.direcao?.join(', ') || ''}</td>
                <td class="col-atores">${filme.atores?.join(', ') || ''}</td>
                <td class="col-genero">${filme.genero?.join(', ') || ''}</td>
                <td class="col-assistido">${filme.assistido ? 'Sim' : 'Não'}</td>
                <td class="col-data">${filme.assistido && filme.dataAssistido ? new Date(filme.dataAssistido.replace(/-/g, '/')).toLocaleDateString('pt-BR') : '-'}</td>
                <td class="col-origem">${filme.origem || '-'}</td>
                <td class="col-acoes">
                    <div class="action-buttons">
                        <button class="btn btn-sm btn-info btn-edit">Editar</button>
                        <button class="btn btn-sm btn-danger btn-delete">Excluir</button>
                    </div>
                </td>
            </tr>`).join('');
        container.innerHTML = `
            <table class="table table-dark table-striped table-hover table-sm tabela-filmes">
                <thead>
                    <tr>
                        <th class="col-num">#</th>
                        <th class="col-titulo sortable" data-sort="titulo">Título${getSortIndicator('titulo')}</th>
                        <th class="col-nota sortable" data-sort="nota">Nota${getSortIndicator('nota')}</th>
                        <th class="col-ano sortable" data-sort="ano">Ano${getSortIndicator('ano')}</th>
                        <th>Direção</th><th>Atores</th><th>Gênero</th>
                        <th>Assistido?</th><th>Data</th><th>Origem</th><th>Ações</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>`;
    }
    
    function atualizarEstatisticas(listaDeFilmes) {
        const statTitleH2 = document.querySelector('#estatisticas-section h2');
        const totalGlobalAssistidos = filmes.filter(f => f.assistido).length;
        const totalFiltrado = listaDeFilmes.length;
        const isFiltered = totalGlobalAssistidos !== totalFiltrado || (filterElements.busca.value || filterElements.genero.value || filterElements.diretor.value || filterElements.ator.value || filterElements.ano.value !== 'todos' || filterElements.origem.value !== 'todos' || filterElements.assistido.value !== 'todos');
        if (isFiltered) {
            statTitleH2.innerHTML = `<i class="fas fa-filter me-2"></i> Estatísticas do Filtro (${totalFiltrado} de ${totalGlobalAssistidos} filmes assistidos)`;
        } else {
            statTitleH2.innerHTML = `<i class="fas fa-chart-bar me-2"></i> Estatísticas dos Filmes Assistidos`;
        }
        const totalFilmes = listaDeFilmes.length;
        if (totalFilmes === 0) {
            document.getElementById('stat-total-filmes').innerText = 0;
            document.getElementById('stat-media-notas').innerText = '0.0';
            document.getElementById('stat-melhor-filme').innerText = '-';
            document.getElementById('stat-pior-filme').innerText = '-';
            document.getElementById('stat-decada-popular').innerText = '-';
            document.getElementById('stat-ator-frequente').innerText = '-';
            document.getElementById('stat-pct-nacionais').innerText = '0%';
            document.getElementById('stat-pct-internacionais').innerText = '0%';
            renderizarRanking('ranking-generos', []);
            renderizarRanking('ranking-atores', []);
            renderizarRanking('ranking-diretores', []);
            renderizarRanking('ranking-anos', []);
            return;
        }
        const nacionais = listaDeFilmes.filter(f => f.origem === 'Nacional');
        const internacionais = listaDeFilmes.filter(f => f.origem === 'Internacional');
        document.getElementById('stat-total-filmes').innerText = totalFilmes;
        document.querySelector('#stat-total-filmes').previousElementSibling.innerText = 'Total de Filmes (Filtro)';
        const mediaNotas = (listaDeFilmes.reduce((acc, f) => acc + (f.nota || 0), 0) / totalFilmes).toFixed(1);
        document.getElementById('stat-media-notas').innerText = mediaNotas;
        const mediaNotasGraficoEl = document.getElementById('stat-media-notas-grafico');
        if (mediaNotasGraficoEl) {
            mediaNotasGraficoEl.innerText = mediaNotas;
        }
        const melhorFilme = listaDeFilmes.reduce((prev, current) => ((prev.nota || 0) > (current.nota || 0)) ? prev : current);
        document.getElementById('stat-melhor-filme').innerText = melhorFilme.titulo;
        const piorFilme = listaDeFilmes.reduce((prev, current) => ((prev.nota || 10) < (current.nota || 10)) ? prev : current);
        document.getElementById('stat-pior-filme').innerText = piorFilme.titulo;
        document.getElementById('stat-pct-nacionais').innerText = `${Math.round((nacionais.length / totalFilmes) * 100)}%`;
        document.getElementById('stat-pct-internacionais').innerText = `${Math.round((internacionais.length / totalFilmes) * 100)}%`;
        const contagemDecadas = listaDeFilmes.reduce((acc, filme) => {
            if (filme.ano) {
                const decada = Math.floor(filme.ano / 10) * 10;
                acc[decada] = (acc[decada] || 0) + 1;
            }
            return acc;
        }, {});
        const decadaPopular = Object.keys(contagemDecadas).length > 0
            ? Object.entries(contagemDecadas).sort(([, a], [, b]) => b - a)[0][0]
            : '-';
        document.getElementById('stat-decada-popular').innerText = decadaPopular !== '-' ? `Anos ${decadaPopular}` : '-';
        const rankingAtores = criarRanking(listaDeFilmes, 'atores');
        const atorMaisFrequente = rankingAtores.length > 0 ? rankingAtores[0][0] : '-';
        document.getElementById('stat-ator-frequente').innerText = atorMaisFrequente;
        renderizarRanking('ranking-generos', criarRanking(listaDeFilmes, 'genero'));
        renderizarRanking('ranking-atores', rankingAtores);
        renderizarRanking('ranking-diretores', criarRanking(listaDeFilmes, 'direcao'));
        const contagemAnos = listaDeFilmes.reduce((acc, f) => { acc[f.ano] = (acc[f.ano] || 0) + 1; return acc; }, {});
        const rankingAnos = Object.entries(contagemAnos).sort(([, a], [, b]) => b - a).slice(0, 10);
        renderizarRanking('ranking-anos', rankingAnos);
    }
    
    function renderizarGraficos(listaDeFilmes) {
        Object.values(charts).forEach(chart => {
            if(chart) chart.destroy();
        });
        const isDarkMode = body.classList.contains('dark-mode');
        Chart.defaults.color = isDarkMode ? 'rgba(226, 232, 240, 0.8)' : 'rgba(0, 0, 0, 0.7)';
        Chart.defaults.borderColor = isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';
        if (listaDeFilmes.length === 0) return;
        renderizarGraficoGeneros(listaDeFilmes);
        renderizarGraficoAnos(listaDeFilmes);
        renderizarGraficoNotas(listaDeFilmes);
        renderizarGraficoOrigem(listaDeFilmes);
        renderizarGraficoMediaNotasPorAno(listaDeFilmes);
        renderizarGraficoAssistidosPorMes(listaDeFilmes);
        renderizarGraficoDiretores(listaDeFilmes);
    }

    function renderizarGraficoGeneros(listaDeFilmes) {
        const ctx = document.getElementById('generosChart').getContext('2d');
        const topGeneros = criarRanking(listaDeFilmes, 'genero').slice(0, 5);
        if (topGeneros.length > 0) {
            charts.generos = new Chart(ctx, {
                type: 'doughnut',
                data: { labels: topGeneros.map(item => item[0]), datasets: [{ label: 'Filmes', data: topGeneros.map(item => item[1]), backgroundColor: ['#a855f7', '#3b82f6', '#ec4899', '#f97316', '#14b8a6'], borderWidth: 0 }] },
                options: { responsive: true, maintainAspectRatio: false }
            });
        }
    }

    function renderizarGraficoAnos(listaDeFilmes) {
        const ctx = document.getElementById('anosChart').getContext('2d');
        const contagemAnos = listaDeFilmes.reduce((acc, f) => { acc[f.ano] = (acc[f.ano] || 0) + 1; return acc; }, {});
        const top10Anos = Object.entries(contagemAnos).sort(([a], [b]) => b - a).slice(0, 10).reverse();
        if (top10Anos.length > 0) {
            charts.anos = new Chart(ctx, {
                type: 'bar',
                data: { labels: top10Anos.map(item => item[0]), datasets: [{ label: 'Qtd. de Filmes', data: top10Anos.map(item => item[1]), backgroundColor: 'rgba(59, 130, 246, 0.7)' }] },
                options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false }
            });
        }
    }

    function renderizarGraficoNotas(listaDeFilmes) {
        const ctx = document.getElementById('notasChart').getContext('2d');
        const contagemNotas = listaDeFilmes.reduce((acc, f) => { const nota = Math.round(f.nota); acc[nota] = (acc[nota] || 0) + 1; return acc; }, {});
        const notasLabels = Object.keys(contagemNotas).sort((a,b) => a-b);
        const notasData = notasLabels.map(label => contagemNotas[label]);
        if (notasLabels.length > 0) {
            charts.notas = new Chart(ctx, {
                type: 'line',
                data: { 
                    labels: notasLabels, 
                    datasets: [{ 
                        label: 'Distribuição de Notas', 
                        data: notasData, 
                        borderColor: '#ec4899', 
                        tension: 0.3, 
                        fill: true, 
                        backgroundColor: 'rgba(236, 72, 153, 0.2)' 
                    }] 
                },
                options: { 
                    responsive: true, 
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                        y: { title: { display: true, text: 'Quantidade de Filmes' } },
                        x: { title: { display: true, text: 'Nota' } }
                    }
                }
            });
        }
    }

    function renderizarGraficoOrigem(listaDeFilmes) {
        const ctx = document.getElementById('origemChart').getContext('2d');
        const contagemOrigem = listaDeFilmes.reduce((acc, filme) => {
            if (filme.origem) acc[filme.origem] = (acc[filme.origem] || 0) + 1;
            return acc;
        }, {});
        charts.origem = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: Object.keys(contagemOrigem),
                datasets: [{ label: 'Origem', data: Object.values(contagemOrigem), backgroundColor: ['#3b82f6', '#14b8a6'], borderWidth: 0 }]
            },
            options: { responsive: true, maintainAspectRatio: false }
        });
    }

    function renderizarGraficoMediaNotasPorAno(listaDeFilmes) {
        const ctx = document.getElementById('mediaNotasAnoChart').getContext('2d');
        const notasPorAno = listaDeFilmes.reduce((acc, filme) => {
            if (filme.ano && filme.nota) {
                if (!acc[filme.ano]) acc[filme.ano] = { total: 0, count: 0 };
                acc[filme.ano].total += filme.nota;
                acc[filme.ano].count++;
            }
            return acc;
        }, {});
        const labels = Object.keys(notasPorAno).sort((a, b) => a - b);
        const data = labels.map(ano => (notasPorAno[ano].total / notasPorAno[ano].count).toFixed(1));
        charts.mediaNotasAno = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{ label: 'Média de Notas', data: data, borderColor: '#f97316', backgroundColor: 'rgba(249, 115, 22, 0.2)', fill: true, tension: 0.3 }]
            },
            options: { responsive: true, maintainAspectRatio: false }
        });
    }

    function renderizarGraficoAssistidosPorMes(listaDeFilmes) {
        const ctx = document.getElementById('assistidosMesChart').getContext('2d');
        const contagemMes = {};
        const meses = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
        const hoje = new Date();
        for (let i = 11; i >= 0; i--) {
            let d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
            let chave = `${meses[d.getMonth()]}/${d.getFullYear()}`;
            contagemMes[chave] = 0;
        }
        listaDeFilmes.forEach(filme => {
            if (filme.assistido && filme.dataAssistido) {
                const dataAssistido = new Date(filme.dataAssistido);
                const chave = `${meses[dataAssistido.getMonth()]}/${dataAssistido.getFullYear()}`;
                if (contagemMes.hasOwnProperty(chave)) contagemMes[chave]++;
            }
        });
        charts.assistidosMes = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: Object.keys(contagemMes),
                datasets: [{ label: 'Qtd. de Filmes Assistidos', data: Object.values(contagemMes), backgroundColor: 'rgba(168, 85, 247, 0.7)' }]
            },
            options: { responsive: true, maintainAspectRatio: false }
        });
    }

    function renderizarGraficoDiretores(listaDeFilmes) {
        const ctx = document.getElementById('diretoresChart').getContext('2d');
        const top5Diretores = criarRanking(listaDeFilmes, 'direcao').slice(0, 5);
        charts.diretores = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: top5Diretores.map(item => item[0]),
                datasets: [{ label: 'Qtd. de Filmes', data: top5Diretores.map(item => item[1]), backgroundColor: 'rgba(236, 72, 153, 0.7)' }]
            },
            options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false }
        });
    }


    // --- EVENT LISTENERS ---
    const setupEventListeners = () => {
        const temaSalvo = localStorage.getItem('theme') || 'dark';
        body.classList.toggle('dark-mode', temaSalvo === 'dark');
        themeToggleBtn.innerHTML = temaSalvo === 'dark' ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
        themeToggleBtn.addEventListener('click', () => {
            const isDark = body.classList.toggle('dark-mode');
            localStorage.setItem('theme', isDark ? 'dark' : 'light');
            themeToggleBtn.innerHTML = isDark ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
            atualizarUI();
        });
        formElements.form.addEventListener('submit', salvarFilme);
        formElements.assistido.addEventListener('change', () => {
            dataAssistidoGroup.style.display = formElements.assistido.value === 'sim' ? 'block' : 'none';
        });
        filterElements.container.addEventListener('input', () => atualizarUI());
        filterElements.limparBtn.addEventListener('click', () => {
            filterElements.busca.value = '';
            filterElements.genero.value = '';
            filterElements.diretor.value = '';
            filterElements.ator.value = '';
            filterElements.ano.value = 'todos';
            filterElements.origem.value = 'todos';
            filterElements.assistido.value = 'todos';
            atualizarUI();
        });
        const tabelaClickContainer = document.getElementById('filmesTabContent');
        tabelaClickContainer.addEventListener('click', (event) => {
            const target = event.target;
            const header = target.closest('th.sortable');
            const editButton = target.closest('.btn-edit');
            const deleteButton = target.closest('.btn-delete');
            if (header) {
                const column = header.dataset.sort;
                if (sortBy === column) {
                    sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
                } else {
                    sortBy = column;
                    sortDirection = 'asc';
                }
                atualizarUI();
            } else if (editButton) {
                const id = editButton.closest('tr').dataset.id;
                prepararEdicao(id);
            } else if (deleteButton) {
                const id = deleteButton.closest('tr').dataset.id;
                deletarFilme(id);
            }
        });
    };

    // --- INICIALIZAÇÃO ---
    const init = () => {
        setupEventListeners();
        carregarFilmes();
    };

    init();
});