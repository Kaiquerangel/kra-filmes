import { onAuthStateChanged, GoogleAuthProvider, signInWithPopup, browserLocalPersistence, browserSessionPersistence, setPersistence } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";
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

    // ── Tabs ─────────────────────────────────────────────────────────────────
    const btnTabLogin    = document.getElementById('tab-btn-login');
    const btnTabRegister = document.getElementById('tab-btn-register');

    function showAuthTab(tab) {
        const isLogin = tab === 'login';
        const cardLogin    = document.getElementById('login-card');
        const cardRegister = document.getElementById('register-card');

        cardLogin.style.display    = isLogin ? 'block' : 'none';
        cardRegister.style.display = isLogin ? 'none'  : 'block';
        btnTabLogin?.classList.toggle('active',  isLogin);
        btnTabRegister?.classList.toggle('active', !isLogin);
        btnTabLogin?.setAttribute('aria-selected',    String(isLogin));
        btnTabRegister?.setAttribute('aria-selected', String(!isLogin));
    }

    btnTabLogin?.addEventListener('click',    () => showAuthTab('login'));
    btnTabRegister?.addEventListener('click', () => showAuthTab('register'));

    // ── Patch: views.js seta display:'block', mas o container precisa de 'flex' ─
    const authContainer = document.getElementById('auth-container');
    if (authContainer) {
        new MutationObserver(() => {
            if (authContainer.style.display === 'block') {
                authContainer.style.display = 'flex';
            }
        }).observe(authContainer, { attributes: true, attributeFilter: ['style'] });
    }

    // ── Login com Google ──────────────────────────────────────────────────────
    document.getElementById('btn-google-login')?.addEventListener('click', async () => {
        const btn     = document.getElementById('btn-google-login');
        const spinner = btn?.querySelector('.auth-google-spinner');
        
        if (btn) btn.disabled = true;
        if (spinner) spinner.style.display = 'inline-block';

        try {
            const provider = new GoogleAuthProvider();
            provider.setCustomParameters({ prompt: 'select_account' });
            await signInWithPopup(auth, provider);
            // onAuthStateChanged em Auth.init cuida do resto
        } catch (error) {
            if (error.code !== 'auth/popup-closed-by-user' && error.code !== 'auth/cancelled-popup-request') {
                UI.alert('Erro', getErrorMessage(error), 'error');
            }
        } finally {
            if (btn) btn.disabled = false;
            if (spinner) spinner.style.display = 'none';
        }
    });

    // ── Mostrar / ocultar senha ───────────────────────────────────────────────
    document.querySelectorAll('[data-eye-toggle]').forEach(btn => {
        btn.addEventListener('click', () => {
            const inputId = btn.dataset.eyeToggle;
            const inp  = document.getElementById(inputId);
            const icon = btn.querySelector('i');
            if (!inp) return;
            if (inp.type === 'password') {
                inp.type = 'text';
                icon?.classList.replace('fa-eye', 'fa-eye-slash');
            } else {
                inp.type = 'password';
                icon?.classList.replace('fa-eye-slash', 'fa-eye');
            }
        });
    });

    // ── Barra de força da senha ───────────────────────────────────────────────
    document.querySelector('[data-strength-input]')?.addEventListener('input', function () {
        const value = this.value;
        const bar   = document.getElementById('auth-strength-bar');
        const label = document.getElementById('auth-strength-label');
        if (!bar) return;

        if (!value) { bar.style.display = 'none'; return; }
        bar.style.display = 'flex';

        let score = 0;
        if (value.length >= 6)  score++;
        if (value.length >= 10) score++;
        if (/[A-Z]/.test(value) && /[0-9]/.test(value)) score++;
        if (/[^A-Za-z0-9]/.test(value)) score++;

        const colors = ['#f87171', '#f59e0b', '#60a5fa', '#34d399'];
        const labels = ['Fraca', 'Regular', 'Boa', 'Forte'];
        for (let i = 1; i <= 4; i++) {
            const seg = document.getElementById('auth-s' + i);
            if (seg) seg.style.background = i <= score ? colors[score - 1] : 'rgba(255,255,255,0.1)';
        }
        if (label) {
            label.textContent = labels[score - 1] || 'Fraca';
            label.style.color = colors[score - 1] || '#f87171';
        }
    });

    // ── Checkbox "Lembrar de mim" ─────────────────────────────────────────────
    document.getElementById('login-remember')?.addEventListener('change', function () {
        const icon = this.nextElementSibling?.querySelector('i');
        if (icon) icon.style.display = this.checked ? 'inline' : 'none';
    });

    // ── "Esqueci a senha" ─────────────────────────────────────────────────────
    document.getElementById('forgot-password-link')?.addEventListener('click', async (e) => {
        e.preventDefault();
        const id = document.getElementById('login-identifier')?.value?.trim();
        if (!id) {
            return UI.alert('Atenção', 'Preencha o campo Email ou Nickname primeiro.', 'warning');
        }
        if (!id.includes('@')) {
            return UI.alert('Atenção', 'Digite seu e-mail para recuperar a senha.', 'warning');
        }
        try {
            await AuthService.recoverPassword(id);
            UI.alert('E-mail Enviado', `Link enviado para ${id}`, 'success');
        } catch (err) {
            UI.alert('Erro', err.message, 'error');
        }
    });

    // ── Submit: Login ─────────────────────────────────────────────────────────
    document.getElementById('login-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id        = document.getElementById('login-identifier').value;
        const pass      = document.getElementById('login-password').value;
        const lembrar   = document.getElementById('login-remember')?.checked ?? true;
        const btn       = e.target.querySelector('.auth-submit-btn');

        setAuthLoading(btn, true);
        try {
            // Persistência: LOCAL = permanece após fechar o browser; SESSION = apenas na aba atual
            await setPersistence(auth, lembrar ? browserLocalPersistence : browserSessionPersistence);
            await AuthService.login(id, pass);
        } catch (error) {
            UI.alert('Atenção', getErrorMessage(error), 'warning');
        } finally {
            setAuthLoading(btn, false);
        }
    });

    // ── Submit: Cadastro ──────────────────────────────────────────────────────
    document.getElementById('register-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const nome  = document.getElementById('register-name').value;
        const nick  = document.getElementById('register-nickname').value;
        const email = document.getElementById('register-email').value;
        const pass  = document.getElementById('register-password').value;
        const btn   = e.target.querySelector('.auth-submit-btn');

        const isAvailable = await AuthService.checkNickname(nick);
        if (!isAvailable) {
            return UI.alert('Erro', 'Nickname já está em uso.', 'warning');
        }

        setAuthLoading(btn, true);
        try {
            await AuthService.register(nome, nick, email, pass);
            UI.toast('Bem-vindo(a)!');
        } catch (error) {
            UI.alert('Erro no Cadastro', getErrorMessage(error), 'error');
        } finally {
            setAuthLoading(btn, false);
        }
    });

    // ── Cliques globais (logout, trocar senha) ────────────────────────────────
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

    // ── Verificação de nickname em tempo real ─────────────────────────────────
    const nickInput = document.getElementById('register-nickname');
    if (nickInput) {
        nickInput.addEventListener('input', () => {
            clearTimeout(nicknameCheckTimer);
            const val  = nickInput.value.trim().toLowerCase();
            const load = document.getElementById('nickname-loading');
            const ok   = document.getElementById('nickname-success');
            const err  = document.getElementById('nickname-error');

            if (load) load.style.display = 'none';
            if (ok)   ok.style.display   = 'none';
            if (err)  err.style.display  = 'none';
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

    // ── Fade-in das capas dos pôsteres ao carregar ────────────────────────────
    document.querySelectorAll('.auth-poster-img').forEach(img => {
        if (img.complete && img.naturalWidth > 0) {
            img.classList.add('loaded');
        } else {
            img.addEventListener('load',  () => img.classList.add('loaded'));
            img.addEventListener('error', () => img.style.display = 'none');
        }
    });

                const bgVideo = document.getElementById('auth-bg-video');
                    if (bgVideo) {
                        bgVideo.addEventListener('error', () => {
                            const errorContext = {
                                module: 'AuthUI',
                                element: 'auth-bg-video',
                                networkState: bgVideo.networkState,
                                errorCode: bgVideo.error?.code,
                                errorMessage: bgVideo.error?.message || 'Falha no carregamento do arquivo de mídia'
                            };
                            // Log estruturado com contexto para debugar em produção
                            console.warn('[AuthUI] Vídeo indisponível. Mantendo fundo padrão escuro.', errorContext);
                            bgVideo.style.display = 'none';
        });
    }
}

// ── Helper: loading state no botão de submit ──────────────────────────────────
function setAuthLoading(btn, loading) {
    if (!btn) return;
    const text    = btn.querySelector('.auth-btn-text');
    const spinner = btn.querySelector('.auth-btn-spinner');
    btn.disabled = loading;
    if (text)    text.style.opacity        = loading ? '0' : '1';
    if (spinner) spinner.style.display     = loading ? 'inline-block' : 'none';
}

async function handleCompleteProfile(user, tentativa = 1) {
    const MAX_TENTATIVAS = 5;
    if (tentativa > MAX_TENTATIVAS) {
        await UI.alert('Erro', 'Muitas tentativas. Tente um nickname diferente mais tarde.', 'error');
        AuthService.logout();
        return;
    }
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
                return handleCompleteProfile(user, tentativa + 1); // Reapresenta com contador
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