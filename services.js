import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";
import { collection, addDoc, getDocs, doc, updateDoc, deleteDoc, serverTimestamp, query, orderBy, where, setDoc, getDoc, limit, startAfter} from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";
import { auth, db, OMDB_API_KEY, YOUTUBE_API_KEY } from './config.js';

export const AuthService = {
    login: (email, pass) => signInWithEmailAndPassword(auth, email, pass),
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
            membroDesde: serverTimestamp()
        });
        
        return cred.user;
    },
    
    checkNickname: async (nickname) => {
        const q = query(collection(db, "users"), where("nickname", "==", nickname));
        const snapshot = await getDocs(q);
        return snapshot.empty;
    },
    
    getProfile: async (uid) => {
        const snap = await getDoc(doc(db, "users", uid));
        return snap.exists() ? snap.data() : null;
    },

    getProfileByNickname: async (nickname) => {
        const q = query(collection(db, "users"), where("nickname", "==", nickname));
        const snapshot = await getDocs(q);
        return snapshot.empty ? null : snapshot.docs[0].data();
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
        let url = `https://www.omdbapi.com/?t=${encodeURIComponent(titulo)}&apikey=${OMDB_API_KEY}`;
        if (ano) url += `&y=${ano}`;
        
        const res = await fetch(url);
        const data = await res.json();
        if (data.Response === "False") throw new Error("Filme não encontrado na API.");
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
        
        if (id) {
            await updateDoc(doc(col, id), filmeData);
        } else {
            const q = query(col, where("titulo", "==", filmeData.titulo), where("ano", "==", filmeData.ano));
            const snapshot = await getDocs(q);
            if (!snapshot.empty) throw new Error("Você já cadastrou este filme (neste ano).");
            
            await addDoc(col, { ...filmeData, cadastradoEm: serverTimestamp() });
        }
    },

    delete: (uid, id) => deleteDoc(doc(db, "users", uid, "filmes", id)),
    
    toggleAssistido: (uid, id, status) => {
        return updateDoc(doc(db, "users", uid, "filmes", id), {
            assistido: status, 
            dataAssistido: status ? new Date().toISOString().slice(0, 10) : null 
        });
    }
};