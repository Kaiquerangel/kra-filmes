import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";
import { serverTimestamp } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";
import { auth, db } from './config.js';
import { AuthService } from './services.js';
import { UI } from './ui.js';

let nicknameCheckTimer = null;
let lastCheckedNickname = '';

const AUTH_ERRORS = {
    'auth/user-not-found': 'Usuário ou senha incorretos.',
    'auth/invalid-credential': 'Usuário ou senha incorretos.',
    'auth/wrong-password': 'Senha incorreta.',
    'auth/too-many-requests': 'Muitas tentativas. Aguarde.',
    'auth/invalid-email': 'E-mail inválido.',
    'auth/email-already-in-use': 'E-mail já cadastrado.',
    'auth/weak-password': 'Senha fraca (mín 6 caracteres).'
};

const getErrorMessage = (error) => AUTH_ERRORS[error.code] || error.message || 'Erro desconhecido.';

export const Auth = {
    init: (onLoginSuccess, onLogoutSuccess) => {
        
        setupAuthFormListeners();

        onAuthStateChanged(auth, async (user) => {
            if (user) {
                try {
                    const profile = await AuthService.getProfile(user.uid);
                    if (profile) {
                        UI.toggleAuthView(true, profile);
                        if (onLoginSuccess) onLoginSuccess(user);
                    } else {
                        await handleCompleteProfile(user);
                    }
                } catch (error) {
                    console.error("Auth Error:", error);
                    UI.toast('Erro ao carregar perfil.', 'error');
                    AuthService.logout();
                }
            } else {
                UI.toggleAuthView(false);
                if (onLogoutSuccess) onLogoutSuccess();
            }
        });
    }
};

function setupAuthFormListeners() {
    document.getElementById('login-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('login-identifier').value;
        const pass = document.getElementById('login-password').value;
        
        try {
            await AuthService.login(id, pass);
        } catch (error) {
            UI.alert('Atenção', getErrorMessage(error), 'warning');
        }
    });

    document.getElementById('register-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const nome = document.getElementById('register-name').value;
        const nick = document.getElementById('register-nickname').value;
        const email = document.getElementById('register-email').value;
        const pass = document.getElementById('register-password').value;

        const isAvailable = await AuthService.checkNickname(nick);
        if (!isAvailable) {
            return UI.alert('Erro', 'Nickname já está em uso.', 'warning');
        }

        try {
            await AuthService.register(nome, nick, email, pass);
            UI.toast('Bem-vindo(a)!');
        } catch (error) {
            UI.alert('Erro no Cadastro', getErrorMessage(error), 'error');
        }
    });

    document.getElementById('show-register-link')?.addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('login-card').style.display = 'none';
        document.getElementById('register-card').style.display = 'block';
    });

    document.getElementById('show-login-link')?.addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('login-card').style.display = 'block';
        document.getElementById('register-card').style.display = 'none';
    });

    document.addEventListener('click', (e) => {
        if (e.target.closest('#logout-btn')) {
            e.preventDefault();
            AuthService.logout();
        }
        
        if (e.target.closest('#perfil-trocar-senha-btn')) {
            e.preventDefault();
            const currentUser = auth.currentUser;
            if (currentUser?.email) {
                AuthService.recoverPassword(currentUser.email)
                    .then(() => UI.alert('E-mail Enviado', `Link enviado para ${currentUser.email}`, 'success'))
                    .catch(err => UI.alert('Erro', err.message, 'error'));
            }
        }
    });

    const nickInput = document.getElementById('register-nickname');
    if (nickInput) {
        nickInput.addEventListener('input', () => {
            clearTimeout(nicknameCheckTimer);
            const val = nickInput.value.trim().toLowerCase();
            
            const load = document.getElementById('nickname-loading');
            const ok = document.getElementById('nickname-success');
            const err = document.getElementById('nickname-error');
            
            if (load) load.style.display = 'none';
            if (ok) ok.style.display = 'none';
            if (err) err.style.display = 'none';
            nickInput.classList.remove('is-valid', 'is-invalid');

            if (val.length < 4) { 
                if (val.length > 0) nickInput.classList.add('is-invalid'); 
                return; 
            }
            
            if (load) load.style.display = 'block';
            
            nicknameCheckTimer = setTimeout(async () => {
                lastCheckedNickname = val;
                try {
                    const isAvailable = await AuthService.checkNickname(val);
                    if (load) load.style.display = 'none';
                    
                    if (isAvailable) { 
                        if (ok) ok.style.display = 'block'; 
                        nickInput.classList.remove('is-invalid');
                        nickInput.classList.add('is-valid'); 
                    } else { 
                        if (err) err.style.display = 'block'; 
                        nickInput.classList.remove('is-valid');
                        nickInput.classList.add('is-invalid'); 
                    }
                } catch (e) {
                    console.error('Erro ao verificar nickname', e);
                }
            }, 800);
        });
    }
}

async function handleCompleteProfile(user) {
    const { value: formValues } = await Swal.fire({
        title: 'Complete seu Perfil',
        html: `
            <input id="swal-nome" class="swal2-input" placeholder="Nome" required>
            <input id="swal-nick" class="swal2-input" placeholder="Nickname" required>
        `,
        focusConfirm: false, 
        allowOutsideClick: false,
        preConfirm: () => [
            document.getElementById('swal-nome').value, 
            document.getElementById('swal-nick').value
        ]
    });

    if (formValues) {
        try {
            const nicknameFormatado = formValues[1].trim().toLowerCase();
            
            // CORREÇÃO CRÍTICA: Validação do nickname no fluxo secundário (Logins Sociais)
            const isAvailable = await AuthService.checkNickname(nicknameFormatado);
            if (!isAvailable) {
                await UI.alert('Atenção', 'Este Nickname já está em uso. Tente novamente.', 'warning');
                return handleCompleteProfile(user); // Reapresenta o modal de forma recursiva
            }

            const { setDoc, doc } = await import("https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js");
            await setDoc(doc(db, "users", user.uid), { 
                uid: user.uid, 
                nome: formValues[0].trim(), 
                nickname: nicknameFormatado, 
                email: user.email || '',
                membroDesde: serverTimestamp() 
            });
            window.location.reload();
        } catch(e) { 
            UI.alert('Erro', 'Falha ao salvar dados.', 'error'); 
        }
    }
}