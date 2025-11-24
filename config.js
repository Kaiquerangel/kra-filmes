import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";

const firebaseConfig = {
     apiKey: "AIzaSyBnd-aZz1JIIHsgaBUZRlM38xwz3BjKhyI",
     authDomain: "meus-filmes-app.firebaseapp.com",
     projectId: "meus-filmes-app",
     storageBucket: "meus-filmes-app.appspot.com",
     messagingSenderId: "857152940365",
     appId: "1:857152940365:web:3b239a77ff87aded822f04"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const OMDB_API_KEY = '5e553669';