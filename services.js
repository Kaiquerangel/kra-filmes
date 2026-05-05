import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";
import { collection, addDoc, getDocs, doc, updateDoc, deleteDoc, serverTimestamp, query, orderBy, where, setDoc, getDoc, limit, startAfter} from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";
import { auth, db, OMDB_API_KEY, YOUTUBE_API_KEY, TMDB_API_KEY } from './config.js';

const TMDB_BASE = 'https://api.themoviedb.org/3';

// Converte resultado do TMDB para o formato de sugestão que o app espera (igual ao OMDb ?s=)
function tmdbParaOmdbSugestao(filme) {
    return {
        Title: filme.title,
        Year: filme.release_date ? filme.release_date.slice(0, 4) : 'N/A',
        imdbID: filme.imdb_id || null,
        Poster: filme.poster_path
            ? `https://image.tmdb.org/t/p/w92${filme.poster_path}`
            : 'N/A',
        _tmdbId: filme.id,
        _popularity: filme.popularity || 0
    };
}

// Busca sugestões no TMDB (pt-BR) com imdbID resolvido em paralelo
async function searchTMDbSugestoes(titulo, ano = null) {
    try {
        const tmdbKey = window._TMDB_KEY || TMDB_API_KEY;
        if (!tmdbKey) return [];

        let url = `${TMDB_BASE}/search/movie?api_key=${tmdbKey}&query=${encodeURIComponent(titulo)}&language=pt-BR&include_adult=false`;
        if (ano) url += `&year=${ano}`;

        const res  = await fetch(url);
        const data = await res.json();
        if (!data.results?.length) return [];

        // Pega os 10 mais relevantes e busca imdbID em paralelo
        const top = data.results.slice(0, 10);
        const comImdb = await Promise.all(top.map(async (filme) => {
            try {
                const det     = await fetch(`${TMDB_BASE}/movie/${filme.id}?api_key=${tmdbKey}`);
                const detData = await det.json();
                return tmdbParaOmdbSugestao({ ...filme, imdb_id: detData.imdb_id });
            } catch {
                return tmdbParaOmdbSugestao(filme);
            }
        }));

        // Retorna apenas os que têm imdbID válido
        return comImdb.filter(f => f.imdbID && f.imdbID.startsWith('tt'));
    } catch (e) {
        console.warn('[TMDB] Falha na busca de sugestões:', e.message);
        return [];
    }
}

// Mescla resultados sem duplicatas: TMDB primeiro (melhor relevância + pt-BR), OMDb complementa
function mesclarSugestoes(tmdbResultados, omdbResultados) {
    const vistos = new Set(tmdbResultados.map(f => f.imdbID));
    const soDaOmdb = omdbResultados.filter(f => !vistos.has(f.imdbID));
    return [...tmdbResultados, ...soDaOmdb].slice(0, 8);
}

// Busca no TMDB por título e retorna dados completos via OMDb (usando imdbID)
async function searchTMDbDireto(titulo, ano = null) {
    try {
        const tmdbKey = window._TMDB_KEY || TMDB_API_KEY;
        if (!tmdbKey) throw new Error('Sem chave TMDB');

        let url = `${TMDB_BASE}/search/movie?api_key=${tmdbKey}&query=${encodeURIComponent(titulo)}&language=pt-BR&include_adult=false`;
        if (ano) url += `&year=${ano}`;

        const res      = await fetch(url);
        const data     = await res.json();
        const primeiro = data.results?.[0];
        if (!primeiro) throw new Error('Nao encontrado no TMDB');

        const detRes  = await fetch(`${TMDB_BASE}/movie/${primeiro.id}?api_key=${tmdbKey}`);
        const detData = await detRes.json();
        if (!detData.imdb_id) throw new Error('Filme sem imdbID no TMDB');

        const omdbRes  = await fetch(`https://www.omdbapi.com/?i=${detData.imdb_id}&apikey=${OMDB_API_KEY}`);
        const omdbData = await omdbRes.json();
        if (omdbData.Response === 'False') throw new Error('Nao encontrado na OMDb pelo imdbID');

        return omdbData;
    } catch (e) {
        console.warn('[TMDB->OMDb] Falha:', e.message);
        throw e;
    }
}

export const AuthService = {
    
    login: async (identifier, pass) => {
        let email = identifier;
        
        if (!identifier.includes('@')) {
            const normalizedNick = identifier.replace('@', '').toLowerCase().trim();

            let q = query(collection(db, "users"), where("nickname_lower", "==", normalizedNick));
            let snapshot = await getDocs(q);

            if (snapshot.empty) {
                q = query(collection(db, "users"), where("nickname", "==", identifier.replace('@', '').trim()));
                snapshot = await getDocs(q);
            }

            if (snapshot.empty) {
                throw { code: 'auth/user-not-found', message: 'Usuario nao encontrado.' };
            }
            
            email = snapshot.docs[0].data().email;
            
            if (!email) {
                throw { code: 'auth/invalid-email', message: 'E-mail nao vinculado a este perfil.' };
            }
        }
        
        return signInWithEmailAndPassword(auth, email, pass);
    },
    
    logout: () => signOut(auth),
    
    recoverPassword: (email) => sendPasswordResetEmail(auth, email),
    
    register: async (nome, nickname, email, password) => {
        const q = query(collection(db, "users"), where("nickname", "==", nickname));
        const snapshot = await getDocs(q);
        
        if (!snapshot.empty) throw new Error("Nickname ja esta em uso.");
        
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        
        await setDoc(doc(db, "users", cred.user.uid), {
            uid: cred.user.uid,
            nome: nome,
            nickname: nickname,
            nickname_lower: nickname.toLowerCase().trim(),
            email: email,
            publico: true,
            membroDesde: serverTimestamp()
        });
        
        return cred.user;
    },
    
    checkNickname: async (nickname) => {
        const normalizedNick = nickname.toLowerCase().trim();
        const q = query(collection(db, "users"), where("nickname_lower", "==", normalizedNick));
        const snapshot = await getDocs(q);
        return snapshot.empty;
    },
    
    getProfile: async (uid) => {
        const snap = await getDoc(doc(db, "users", uid));
        return snap.exists() ? snap.data() : null;
    },

    getProfileByNickname: async (nickname) => {
        const semArroba = nickname.replace('@', '').trim();
        const comArroba = '@' + semArroba;

        const tentativas = [
            semArroba,
            semArroba.toLowerCase(),
            comArroba,
            comArroba.toLowerCase(),
        ].filter((v, i, arr) => arr.indexOf(v) === i);

        for (const nick of tentativas) {
            const q = query(collection(db, "users"), where("nickname", "==", nick));
            const snap = await getDocs(q);
            if (!snap.empty) return snap.docs[0].data();
        }

        return null;
    }

};

export const MovieService = {
    getCollection: (uid) => collection(db, "users", uid, "filmes"),

    getPaginated: async (uid, ultimoDocVisivel = null, tamanhoPagina = 24) => {
        const col = collection(db, "users", uid, "filmes");
        let q = query(col, orderBy("cadastradoEm", "asc"), limit(tamanhoPagina));

        if (ultimoDocVisivel) {
            q = query(q, startAfter(ultimoDocVisivel));
        }

        return await getDocs(q);
    },
    
    searchOMDb: async (titulo, ano = null) => {
        // Detecta se e URL/ID do IMDb e busca direto por ID
        const imdbMatch = titulo.match(/tt\d{7,8}/);
        if (imdbMatch) {
            const res  = await fetch(`https://www.omdbapi.com/?i=${imdbMatch[0]}&apikey=${OMDB_API_KEY}`);
            const data = await res.json();
            if (data.Response === "False") throw new Error("Filme nao encontrado na API.");
            return data;
        }

        // Tenta OMDb primeiro com o titulo como digitado
        try {
            const url  = `https://www.omdbapi.com/?t=${encodeURIComponent(titulo)}&apikey=${OMDB_API_KEY}${ano ? `&y=${ano}` : ''}`;
            const res  = await fetch(url);
            const data = await res.json();
            if (data.Response !== "False") return data;
        } catch { /* segue para fallback */ }

        // Fallback: TMDB (suporta titulo em portugues) -> busca imdbID -> OMDb
        return await searchTMDbDireto(titulo, ano);
    },

    // Busca lista de sugestoes (ate 8 resultados)
    // TMDB e OMDb em paralelo -> mescla priorizando TMDB (relevancia superior + multilíngue)
    searchOMDbSugestoes: async (titulo, ano = null) => {
        const [tmdbRes, omdbRes] = await Promise.allSettled([
            searchTMDbSugestoes(titulo, ano),
            (async () => {
                let url = `https://www.omdbapi.com/?s=${encodeURIComponent(titulo)}&type=movie&apikey=${OMDB_API_KEY}`;
                if (ano) url += `&y=${ano}`;
                const res  = await fetch(url);
                const data = await res.json();
                return data.Response !== 'False' ? (data.Search || []).slice(0, 8) : [];
            })()
        ]);

        const tmdb = tmdbRes.status === 'fulfilled' ? tmdbRes.value : [];
        const omdb = omdbRes.status === 'fulfilled' ? omdbRes.value : [];

        // TMDB primeiro (melhor relevancia + pt-BR), OMDb complementa sem duplicatas
        return mesclarSugestoes(tmdb, omdb);
    },

    // Busca detalhes completos por imdbID
    getOMDbById: async (imdbId) => {
        const res  = await fetch(`https://www.omdbapi.com/?i=${imdbId}&apikey=${OMDB_API_KEY}`);
        const data = await res.json();
        if (data.Response === "False") throw new Error("Filme nao encontrado.");
        return data;
    },

    getTrailer: async (titulo, ano) => {
        if (!YOUTUBE_API_KEY || YOUTUBE_API_KEY.includes('COLE_AQUI')) return null;
        
        const q = encodeURIComponent(`${titulo} ${ano || ''} trailer oficial`);
        const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=1&q=${q}&type=video&key=${YOUTUBE_API_KEY}`;
        
        try {
            const res = await fetch(url);
            const data = await res.json();
            return data.items?.length > 0 ? data.items[0].id.videoId : null;
        } catch (error) {
            console.error("Erro YouTube API:", error);
            return null;
        }
    },

    save: async (uid, filmeData, id = null) => {
        const col = collection(db, "users", uid, "filmes");
        
        const q = query(col, where("titulo", "==", filmeData.titulo), where("ano", "==", filmeData.ano));
        const snapshot = await getDocs(q);
        
        const isDuplicate = snapshot.docs.some(doc => doc.id !== id);
        
        if (isDuplicate) {
            throw new Error("Voce ja cadastrou este filme (neste ano).");
        }

        if (id) {
            await updateDoc(doc(col, id), filmeData);
        } else {
            await addDoc(col, { ...filmeData, cadastradoEm: serverTimestamp() });
        }
    },

    delete: (uid, id) => deleteDoc(doc(db, "users", uid, "filmes", id)),

    updateCampos: (uid, id, campos) =>
        updateDoc(doc(db, "users", uid, "filmes", id), campos),

    reavaliarFilme: async (uid, id, novaNota, filmeAtual) => {
        const historico = filmeAtual.historicoNotas || [];
        if (filmeAtual.nota && filmeAtual.nota !== novaNota) {
            historico.push({
                nota: filmeAtual.nota,
                data: new Date().toISOString().slice(0, 10),
                versao: historico.length + 1
            });
        }
        return updateDoc(doc(db, "users", uid, "filmes", id), {
            nota: novaNota,
            historicoNotas: historico,
            ultimaReavaliacao: new Date().toISOString().slice(0, 10)
        });
    },
    
    toggleAssistido: (uid, id, status) => {
        return updateDoc(doc(db, "users", uid, "filmes", id), {
            assistido: status, 
            dataAssistido: status ? new Date().toISOString().slice(0, 10) : null 
        });
    }
};