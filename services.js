/* ==========================================================================
   SERVICES.JS - Camada de Serviços (Firebase Auth, Firestore, OMDb API)
   ========================================================================== */

import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";
import { collection, addDoc, getDocs, doc, updateDoc, deleteDoc, serverTimestamp, query, orderBy, where, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";
import { auth, db, OMDB_API_KEY } from './config.js';

export const AuthService = {
    login: (email, pass) => signInWithEmailAndPassword(auth, email, pass),
    logout: () => signOut(auth),
    recoverPassword: (email) => sendPasswordResetEmail(auth, email),
    register: async (nome, nickname, email, password) => {
        // Verifica unicidade do nickname
        const q = query(collection(db, "users"), where("nickname", "==", nickname));
        const snapshot = await getDocs(q);
        if (!snapshot.empty) throw new Error("Nickname já está em uso.");
        
        // Cria conta no Auth (O e-mail fica salvo seguro AQUI)
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        
        // Cria perfil no Firestore (Dados Públicos APENAS)
        await setDoc(doc(db, "users", cred.user.uid), {
            uid: cred.user.uid,
            nome: nome,
            nickname: nickname,
            // email: email,  <--- REMOVIDO! Não salve isso no documento público.
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
    }
};

export const MovieService = {
    getCollection: (uid) => collection(db, "users", uid, "filmes"),
    
    // ATUALIZADO: Aceita ano opcional para filtrar remakes
    searchOMDb: async (titulo, ano = null) => {
        let url = `https://www.omdbapi.com/?t=${encodeURIComponent(titulo)}&apikey=${OMDB_API_KEY}`;
        if (ano) url += `&y=${ano}`; // Adiciona filtro de ano se informado
        
        const res = await fetch(url);
        const data = await res.json();
        if (data.Response === "False") throw new Error("Filme não encontrado na API.");
        return data;
    },

    save: async (uid, filmeData, id = null) => {
        const col = collection(db, "users", uid, "filmes");
        
        if (id) {
            await updateDoc(doc(col, id), filmeData);
        } else {
            // ATUALIZADO: Verifica duplicidade considerando Título E Ano
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
            dataAssistido: status ? new Date().toISOString().slice(0,10) : null 
        });
    }
};