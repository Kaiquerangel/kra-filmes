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

const LOGIN_TEMPLATE = `
<div class="row justify-content-center" style="padding-top: 5rem;">
    <div class="col-lg-5 col-md-7">
        <div class="card glass-card" id="login-card">
            <div class="card-body p-4 p-md-5">
                <h2 class="card-title mb-4 text-center">Login</h2>
                <form id="login-form" novalidate>
                    <div class="mb-3">
                        <label for="login-identifier" class="form-label">Email ou Nickname</label>
                        <input type="text" class="form-control" id="login-identifier" required autocomplete="username">
                    </div>
                    <div class="mb-3">
                        <label for="login-password" class="form-label">Senha</label>
                        <input type="password" class="form-control" id="login-password" required autocomplete="current-password">
                    </div>
                    <button type="submit" class="btn btn-gradient w-100 mt-3">Entrar</button>
                    <p class="text-center mt-4 mb-0">Não tem uma conta? <a href="#" id="show-register-link" class="fw-bold">Cadastre-se</a></p>
                </form>
            </div>
        </div>

        <div class="card glass-card" id="register-card" style="display: none;">
            <div class="card-body p-4 p-md-5">
                <h2 class="card-title mb-4 text-center">Cadastro</h2>
                <form id="register-form" novalidate>
                    <div class="mb-3">
                        <label for="register-name" class="form-label">Nome</label>
                        <input type="text" class="form-control" id="register-name" required autocomplete="name">
                    </div>
                    <div class="mb-3 position-relative">
                        <label for="register-nickname" class="form-label">Nickname</label>
                        <input type="text" class="form-control" id="register-nickname" minlength="4" required autocomplete="username">
                        
                        <div id="nickname-validation-icon" class="nickname-validator">
                            <div id="nickname-loading" class="spinner-border spinner-border-sm" role="status" style="display: none;"></div>
                            <i id="nickname-success" class="fas fa-check-circle text-success" style="display: none;"></i>
                            <i id="nickname-error" class="fas fa-times-circle text-danger" style="display: none;"></i>
                        </div>
                        <div class="invalid-feedback" id="nickname-invalid-feedback">Nickname deve ter pelo menos 4 caracteres.</div>
                    </div>
                    <div class="mb-3">
                        <label for="register-email" class="form-label">Email</label>
                        <input type="email" class="form-control" id="register-email" required autocomplete="email">
                    </div>
                    <div class="mb-3">
                        <label for="register-password" class="form-label">Senha (mín. 6 caracteres)</label>
                        <input type="password" class="form-control" id="register-password" minlength="6" required autocomplete="new-password">
                    </div>
                    <button type="submit" class="btn btn-gradient w-100 mt-3">Criar Conta</button>
                    <p class="text-center mt-4 mb-0">Já tem uma conta? <a href="#" id="show-login-link" class="fw-bold">Faça o login</a></p>
                </form>
            </div>
        </div>
    </div>
</div>
`;

export const Auth = {
    init: (onLoginSuccess, onLogoutSuccess) => {
        const container = document.getElementById('auth-container');
        if (container) container.innerHTML = LOGIN_TEMPLATE;

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
        if (!isAvailable && nick !== lastCheckedNickname) {
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
                        nickInput.classList.add('is-valid'); 
                    } else { 
                        if (err) err.style.display = 'block'; 
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
            <input id="swal-nome" class="swal2-input" placeholder="Nome">
            <input id="swal-nick" class="swal2-input" placeholder="Nickname">
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
            const { setDoc, doc } = await import("https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js");
            await setDoc(doc(db, "users", user.uid), { 
                uid: user.uid, 
                nome: formValues[0], 
                nickname: formValues[1], 
                membroDesde: serverTimestamp() 
            });
            window.location.reload();
        } catch(e) { 
            UI.alert('Erro', 'Falha ao salvar dados.', 'error'); 
        }
    }
}