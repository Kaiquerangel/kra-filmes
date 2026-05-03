import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";
import { collection, addDoc, getDocs, doc, updateDoc, deleteDoc, serverTimestamp, query, orderBy, where, setDoc, getDoc, limit, startAfter} from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";
import { auth, db, OMDB_API_KEY, YOUTUBE_API_KEY } from './config.js';

export const AuthService = {
    
    login: async (identifier, pass) => {
        let email = identifier;
        
        if (!identifier.includes('@')) {
            const normalizedNick = identifier.replace('@', '').toLowerCase().trim();

            // Tenta nickname_lower primeiro
            let q = query(collection(db, "users"), where("nickname_lower", "==", normalizedNick));
            let snapshot = await getDocs(q);

            // Fallback: nickname original
            if (snapshot.empty) {
                q = query(collection(db, "users"), where("nickname", "==", identifier.replace('@', '').trim()));
                snapshot = await getDocs(q);
            }

            if (snapshot.empty) {
                throw { code: 'auth/user-not-found', message: 'Usuário não encontrado.' };
            }
            
            email = snapshot.docs[0].data().email;
            
            if (!email) {
                throw { code: 'auth/invalid-email', message: 'E-mail não vinculado a este perfil.' };
            }
        }
        
        return signInWithEmailAndPassword(auth, email, pass);
    },
    
    logout: () => signOut(auth),
    
    recoverPassword: (email) => sendPasswordResetEmail(auth, email),
    
    register: async (nome, nickname, email, password) => {
        const q = query(collection(db, "users"), where("nickname", "==", nickname));
        const snapshot = await getDocs(q);
        
        if (!snapshot.empty) throw new Error("Nickname já está em uso.");
        
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
        const normalizedNick = nickname.replace('@', '').toLowerCase().trim();

        // Tenta primeiro pelo campo nickname_lower (usuários novos)
        const q1 = query(collection(db, "users"), where("nickname_lower", "==", normalizedNick));
        const snap1 = await getDocs(q1);
        if (!snap1.empty) {
            const data = snap1.docs[0].data();
            // Migra o campo nickname_lower se ainda não existe
            if (!data.nickname_lower) {
                try {
                    const { updateDoc } = await import("https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js");
                    await updateDoc(doc(db, "users", snap1.docs[0].id), {
                        nickname_lower: data.nickname.toLowerCase().trim(),
                        publico: data.publico ?? true
                    });
                } catch(e) {}
            }
            return data;
        }

        // Fallback: busca pelo nickname original (usuários cadastrados antes da migração)
        const q2 = query(collection(db, "users"), where("nickname", "==", nickname.replace('@', '').trim()));
        const snap2 = await getDocs(q2);
        if (!snap2.empty) {
            const data = snap2.docs[0].data();
            // Migra automaticamente o campo nickname_lower no perfil encontrado
            try {
                const { updateDoc } = await import("https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js");
                await updateDoc(doc(db, "users", snap2.docs[0].id), {
                    nickname_lower: data.nickname.toLowerCase().trim(),
                    publico: data.publico ?? true
                });
            } catch(e) {}
            return data;
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
        // Detecta se é URL/ID do IMDb e busca direto por ID
        const imdbMatch = titulo.match(/tt\d{7,8}/);
        let url;
        if (imdbMatch) {
            url = `https://www.omdbapi.com/?i=${imdbMatch[0]}&apikey=${OMDB_API_KEY}`;
        } else {
            url = `https://www.omdbapi.com/?t=${encodeURIComponent(titulo)}&apikey=${OMDB_API_KEY}`;
            if (ano) url += `&y=${ano}`;
        }
        const res = await fetch(url);
        const data = await res.json();
        if (data.Response === "False") throw new Error("Filme não encontrado na API.");
        return data;
    },

    // Busca lista de sugestões (até 10 resultados) pelo ?s= da OMDb
    searchOMDbSugestoes: async (titulo, ano = null) => {
        let url = `https://www.omdbapi.com/?s=${encodeURIComponent(titulo)}&type=movie&apikey=${OMDB_API_KEY}`;
        if (ano) url += `&y=${ano}`;
        const res  = await fetch(url);
        const data = await res.json();
        if (data.Response === "False") return [];
        return (data.Search || []).slice(0, 8);
    },

    // Busca detalhes completos por imdbID
    getOMDbById: async (imdbId) => {
        const res  = await fetch(`https://www.omdbapi.com/?i=${imdbId}&apikey=${OMDB_API_KEY}`);
        const data = await res.json();
        if (data.Response === "False") throw new Error("Filme não encontrado.");
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
        
        // CORREÇÃO: Validação de duplicata agora cobre edição
        const q = query(col, where("titulo", "==", filmeData.titulo), where("ano", "==", filmeData.ano));
        const snapshot = await getDocs(q);
        
        // Verifica se há duplicata, ignorando o próprio documento se estivermos a editar
        const isDuplicate = snapshot.docs.some(doc => doc.id !== id);
        
        if (isDuplicate) {
            throw new Error("Você já cadastrou este filme (neste ano).");
        }

        if (id) {
            await updateDoc(doc(col, id), filmeData);
        } else {
            await addDoc(col, { ...filmeData, cadastradoEm: serverTimestamp() });
        }
    },

    delete: (uid, id) => deleteDoc(doc(db, "users", uid, "filmes", id)),

    // Atualiza campos específicos sem reescrever o documento inteiro
    updateCampos: (uid, id, campos) =>
        updateDoc(doc(db, "users", uid, "filmes", id), campos),

    // Salva reavaliação mantendo histórico de notas anteriores
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