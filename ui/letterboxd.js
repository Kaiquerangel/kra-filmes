/**
 * letterboxd.js
 * Importa filmes via CSV exportado pelo Letterboxd.
 * Exportar em: letterboxd.com → Import & Export → Export Your Data
 */

import { UI } from '../ui.js';

// Campos do CSV do Letterboxd:
// Date,Name,Year,Letterboxd URI,Rating,Rewatch,Tags,Watched Date,Review
export async function importarLetterboxd(arquivo, onImportar) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = async (e) => {
            try {
                const text  = e.target.result;
                const linhas = text.split('\n').map(l => l.trim()).filter(Boolean);

                if (!linhas.length) throw new Error('Arquivo vazio.');

                // Detecta o cabeçalho
                const header = linhas[0].toLowerCase();
                if (!header.includes('name') || !header.includes('year')) {
                    throw new Error('Formato inválido. Exporte o CSV correto do Letterboxd.');
                }

                const cols = linhas[0].split(',').map(c => c.trim().toLowerCase().replace(/"/g,''));
                const idxNome  = cols.indexOf('name');
                const idxAno   = cols.indexOf('year');
                const idxNota  = cols.indexOf('rating');
                const idxData  = cols.indexOf('watched date');
                const idxTags  = cols.indexOf('tags');

                const filmes = [];
                for (let i = 1; i < linhas.length; i++) {
                    const row = parseCSVRow(linhas[i]);
                    if (!row[idxNome]) continue;

                    const notaLetter = parseFloat(row[idxNota]);
                    // Letterboxd usa escala de 0.5 a 5 (meias estrelas)
                    // Convertemos para 0-10 multiplicando por 2
                    const nota = !isNaN(notaLetter) ? parseFloat((notaLetter * 2).toFixed(1)) : 0;

                    filmes.push({
                        titulo:       row[idxNome]?.replace(/"/g,'').trim() || '',
                        ano:          parseInt(row[idxAno]) || null,
                        nota:         0, // Pendentes não têm nota ainda
                        assistido:    false, // Importando apenas watchlist (pendentes)
                        dataAssistido:null,
                        tags:         row[idxTags] ? row[idxTags].split('|').map(t=>t.trim()).filter(Boolean) : [],
                        origem:       'Internacional',
                        // Campos a serem preenchidos pelo OMDb após importação
                        genero:       [],
                        direcao:      [],
                        atores:       [],
                        posterUrl:    '',
                        sinopse:      '',
                        imdbId:       '',
                    });
                }

                if (!filmes.length) throw new Error('Nenhum filme encontrado no arquivo.');

                resolve(filmes);
            } catch(err) {
                reject(err);
            }
        };
        reader.onerror = () => reject(new Error('Erro ao ler o arquivo.'));
        reader.readAsText(arquivo, 'UTF-8');
    });
}

function parseCSVRow(row) {
    const result = [];
    let current = '', inQuotes = false;
    for (let i = 0; i < row.length; i++) {
        const ch = row[i];
        if (ch === '"') {
            if (inQuotes && row[i+1] === '"') { current += '"'; i++; }
            else inQuotes = !inQuotes;
        } else if (ch === ',' && !inQuotes) {
            result.push(current); current = '';
        } else {
            current += ch;
        }
    }
    result.push(current);
    return result;
}

export async function mostrarModalLetterboxd(onImportar) {
    const { value: arquivo } = await Swal.fire({
        title: '<span style="font-size:1rem;">📥 Importar do Letterboxd</span>',
        width: 'min(520px, 95vw)',
        html: `
            <div style="text-align:left;">
                <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);
                            border-radius:10px;padding:14px;margin-bottom:16px;">
                    <p style="font-size:0.82rem;color:rgba(255,255,255,0.5);margin:0 0 8px;font-weight:600;">
                        Como exportar do Letterboxd:
                    </p>
                    <ol style="font-size:0.78rem;color:rgba(255,255,255,0.35);margin:0;padding-left:16px;line-height:1.8;">
                        <li>Acesse <strong style="color:rgba(255,255,255,0.5);">letterboxd.com</strong></li>
                        <li>Vá em seu perfil → <strong style="color:rgba(255,255,255,0.5);">Settings</strong></li>
                        <li>Clique em <strong style="color:rgba(255,255,255,0.5);">Import & Export</strong></li>
                        <li>Clique em <strong style="color:rgba(255,255,255,0.5);">Export Your Data</strong></li>
                        <li>Baixe e selecione o arquivo <strong style="color:rgba(255,255,255,0.5);">watchlist.csv</strong></li>
                    </ol>
                </div>
                <label style="display:block;cursor:pointer;">
                    <div id="letter-drop-zone"
                         style="border:2px dashed rgba(59,130,246,0.3);border-radius:10px;
                                padding:24px;text-align:center;transition:all 0.2s;cursor:pointer;"
                         ondragover="event.preventDefault();this.style.borderColor='rgba(59,130,246,0.7)';this.style.background='rgba(59,130,246,0.08)'"
                         ondragleave="this.style.borderColor='rgba(59,130,246,0.3)';this.style.background=''"
                         ondrop="event.preventDefault();document.getElementById('letter-file-input').files=event.dataTransfer.files;document.getElementById('letter-file-label').textContent=event.dataTransfer.files[0]?.name||'';this.style.borderColor='rgba(34,197,94,0.5)';this.style.background='rgba(34,197,94,0.05)';">
                        <i class="fas fa-file-csv" style="font-size:2rem;color:rgba(59,130,246,0.5);display:block;margin-bottom:8px;"></i>
                        <p style="font-size:0.82rem;color:rgba(255,255,255,0.4);margin:0;">
                            Arraste o arquivo aqui ou <span style="color:#60a5fa;">clique para selecionar</span>
                        </p>
                        <p id="letter-file-label" style="font-size:0.75rem;color:#22c55e;margin:6px 0 0;"></p>
                    </div>
                    <input id="letter-file-input" type="file" accept=".csv" style="display:none;"
                           onchange="document.getElementById('letter-file-label').textContent=this.files[0]?.name||'';
                                     document.getElementById('letter-drop-zone').style.borderColor='rgba(34,197,94,0.5)';
                                     document.getElementById('letter-drop-zone').style.background='rgba(34,197,94,0.05)';">
                </label>
                <p style="font-size:0.72rem;color:rgba(255,255,255,0.25);margin-top:12px;text-align:center;">
                    Filmes serão importados como <strong>Não Assistidos</strong> (sua watchlist). Use o arquivo <strong>watchlist.csv</strong>.
                    Dados como pôster, sinopse e elenco serão buscados automaticamente.
                </p>
            </div>`,
        showCancelButton: true,
        confirmButtonText: 'Importar',
        cancelButtonText: 'Cancelar',
        customClass: { popup: 'suggestion-swal-popup' },
        preConfirm: () => {
            const f = document.getElementById('letter-file-input').files[0];
            if (!f) { Swal.showValidationMessage('Selecione o arquivo watched.csv'); return false; }
            return f;
        }
    });

    if (!arquivo) return;

    try {
        const filmes = await importarLetterboxd(arquivo);

        // Preview antes de confirmar
        const { isConfirmed } = await Swal.fire({
            title: `<span style="font-size:1rem;">Encontrados ${filmes.length} filmes</span>`,
            width: 'min(520px, 95vw)',
            html: `
                <p style="font-size:0.82rem;color:rgba(255,255,255,0.4);margin-bottom:12px;">
                    Prévia dos primeiros filmes a serem importados:
                </p>
                <div style="max-height:240px;overflow-y:auto;border:1px solid rgba(255,255,255,0.07);border-radius:8px;">
                    ${filmes.slice(0,8).map(f => `
                        <div style="display:flex;justify-content:space-between;align-items:center;
                                    padding:8px 12px;border-bottom:1px solid rgba(255,255,255,0.05);">
                            <span style="font-size:0.82rem;color:rgba(255,255,255,0.7);">${f.titulo} ${f.ano ? `<span style="opacity:0.4;">(${f.ano})</span>` : ''}</span>
                            ${f.nota ? `<span style="font-size:0.78rem;color:#fbbf24;">★ ${f.nota}</span>` : '<span style="font-size:0.72rem;color:rgba(255,255,255,0.25);">Sem nota</span>'}
                        </div>`).join('')}
                    ${filmes.length > 8 ? `<div style="padding:8px 12px;font-size:0.75rem;color:rgba(255,255,255,0.3);">... e mais ${filmes.length - 8} filmes</div>` : ''}
                </div>
                <p style="font-size:0.75rem;color:rgba(255,255,255,0.25);margin-top:12px;">
                    ⚠️ Filmes duplicados (mesmo título e ano) serão ignorados automaticamente.
                </p>`,
            showCancelButton: true,
            confirmButtonText: `Importar ${filmes.length} filmes`,
            cancelButtonText: 'Cancelar',
            customClass: { popup: 'suggestion-swal-popup' }
        });

        if (isConfirmed) onImportar(filmes);

    } catch(err) {
        Swal.fire({ title: 'Erro', text: err.message, icon: 'error', customClass: { popup: 'suggestion-swal-popup' } });
    }
}
