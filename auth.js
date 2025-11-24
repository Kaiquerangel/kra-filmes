/* ==========================================================================
   AUTH.JS - Gerencia Login, Cadastro e Sessão
   ========================================================================== */

import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";
import { serverTimestamp } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";
import { auth, db } from './config.js';
import { AuthService } from './services.js';
import { UI } from './ui.js';

let nicknameCheckTimer = null;
let lastCheckedNickname = '';

// --- HTML DO FORMULÁRIO EMBUTIDO (Sem necessidade de arquivo externo) ---
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
        
        // 1. Injeta o HTML na página
        const container = document.getElementById('auth-container');
        if (container) container.innerHTML = LOGIN_TEMPLATE;

        // 2. Configura os Listeners
        setupAuthFormListeners();

        // 3. Monitora Estado
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
                    console.error("Erro Auth:", error);
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
    // Login
    document.getElementById('login-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('login-identifier').value;
        const pass = document.getElementById('login-password').value;
        try {
            await AuthService.login(id, pass);
        } catch (error) {
            let msg = 'Erro desconhecido.';
            if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential') msg = 'Usuário ou senha incorretos.';
            else if (error.code === 'auth/wrong-password') msg = 'Senha incorreta.';
            else if (error.code === 'auth/too-many-requests') msg = 'Muitas tentativas. Aguarde um momento.';
            else if (error.code === 'auth/invalid-email') msg = 'E-mail inválido.';
            UI.alert('Atenção', msg, 'warning');
        }
    });

    // Cadastro
    document.getElementById('register-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const nome = document.getElementById('register-name').value;
        const nick = document.getElementById('register-nickname').value;
        const email = document.getElementById('register-email').value;
        const pass = document.getElementById('register-password').value;

        const isAvailable = await AuthService.checkNickname(nick);
        if (!isAvailable && nick !== lastCheckedNickname) {
            return UI.alert('Erro', 'Nickname em uso.', 'warning');
        }

        try {
            await AuthService.register(nome, nick, email, pass);
            UI.toast('Bem-vindo(a)!');
        } catch (error) {
            let msg = error.message;
            if(error.code === 'auth/email-already-in-use') msg = 'E-mail já cadastrado.';
            else if(error.code === 'auth/weak-password') msg = 'Senha fraca (mín 6 caracteres).';
            UI.alert('Erro no Cadastro', msg, 'error');
        }
    });

    // Navegação
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

    // Recuperar Senha
    document.getElementById('perfil-trocar-senha-btn')?.addEventListener('click', async () => {
        const u = auth.currentUser;
        if(!u?.email) return;
        try {
            await AuthService.recoverPassword(u.email);
            UI.alert('E-mail Enviado', `Link enviado para ${u.email}`, 'success');
        } catch(e) { UI.alert('Erro', e.message, 'error'); }
    });

    // Logout
    document.getElementById('logout-btn')?.addEventListener('click', () => AuthService.logout());

    // Validação Nickname
    const nickInput = document.getElementById('register-nickname');
    if (nickInput) {
        nickInput.addEventListener('input', () => {
            clearTimeout(nicknameCheckTimer);
            const val = nickInput.value.trim().toLowerCase();
            const load = document.getElementById('nickname-loading');
            const ok = document.getElementById('nickname-success');
            const err = document.getElementById('nickname-error');
            
            if(load) load.style.display = 'none';
            if(ok) ok.style.display = 'none';
            if(err) err.style.display = 'none';
            nickInput.classList.remove('is-valid', 'is-invalid');

            if (val.length < 4) { if(val.length>0) nickInput.classList.add('is-invalid'); return; }
            
            if(load) load.style.display = 'block';
            nicknameCheckTimer = setTimeout(async () => {
                lastCheckedNickname = val;
                try {
                    const av = await AuthService.checkNickname(val);
                    if(load) load.style.display = 'none';
                    if (av) { if(ok) ok.style.display = 'block'; nickInput.classList.add('is-valid'); }
                    else { if(err) err.style.display = 'block'; nickInput.classList.add('is-invalid'); }
                } catch(e) {}
            }, 800);
        });
    }
}

async function handleCompleteProfile(user) {
    const { value: f } = await Swal.fire({
        title: 'Complete seu Perfil',
        html: `<input id="swal-nome" class="swal2-input" placeholder="Nome"><input id="swal-nick" class="swal2-input" placeholder="Nickname">`,
        focusConfirm: false, allowOutsideClick: false,
        preConfirm: () => [document.getElementById('swal-nome').value, document.getElementById('swal-nick').value]
    });
    if (f) {
        try {
            const { setDoc, doc } = await import("https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js");
            await setDoc(doc(db, "users", user.uid), { uid: user.uid, nome: f[0], nickname: f[1], membroDesde: serverTimestamp() });
            window.location.reload();
        } catch(e) { UI.alert('Erro', 'Falha ao salvar.', 'error'); }
    }
}