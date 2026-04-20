import { els } from './elements.js';

export const toggleAuthView = (isLoggedIn, userProfile = null) => {
    els.appContent.style.display = isLoggedIn ? 'block' : 'none';
    els.logoutContainer.style.display = isLoggedIn ? 'block' : 'none';
    els.authContainer.style.display = isLoggedIn ? 'none' : 'block';
    
    els.navLinks.forEach(link => { 
        link.style.display = isLoggedIn ? 'block' : 'none'; 
    });

    if (isLoggedIn && userProfile) {
        els.welcomeMsg.textContent = `Olá, ${userProfile.nickname}!`; 
        els.welcomeMsg.style.display = 'block';
    } else {
        els.welcomeMsg.style.display = 'none';
        const lCard = document.getElementById('login-card'); 
        const rCard = document.getElementById('register-card');
        if (lCard) lCard.style.display = 'block'; 
        if (rCard) rCard.style.display = 'none';
    }
};

const THEMES = ['dark', 'light', 'midnight', 'cinema', 'forest', 'ocean'];
const THEME_ICONS = {
    dark:     '<i class="fas fa-moon" aria-hidden="true"></i>',
    light:    '<i class="fas fa-sun" aria-hidden="true"></i>',
    midnight: '<i class="fas fa-star" aria-hidden="true"></i>',
    cinema:   '<i class="fas fa-film" aria-hidden="true"></i>',
    forest:   '<i class="fas fa-leaf" aria-hidden="true"></i>',
    ocean:    '<i class="fas fa-water" aria-hidden="true"></i>',
};

export const applyTheme = (theme) => {
    THEMES.forEach(t => els.body.classList.remove(`theme-${t}`, 'dark-mode'));
    els.body.classList.add(`theme-${theme}`);
    if (theme !== 'light') els.body.classList.add('dark-mode');
    if (els.themeBtn) els.themeBtn.innerHTML = THEME_ICONS[theme] || THEME_ICONS.dark;
};

export const toggleTheme = () => {
    const current = localStorage.getItem('theme') || 'dark';
    const idx = THEMES.indexOf(current);
    const next = THEMES[(idx + 1) % THEMES.length];
    applyTheme(next);
    return next;
};

export const setTheme = (theme) => {
    applyTheme(theme);
};

export const openThemePicker = () => {
    const labels = { dark:'Escuro', light:'Claro', midnight:'Meia-Noite', cinema:'Cinema', forest:'Floresta', ocean:'Oceano' };
    const current = localStorage.getItem('theme') || 'dark';
    Swal.fire({
        title: 'Escolha o Tema',
        html: `<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;padding:8px 0;">
            ${THEMES.map(t => `
                <button onclick="document.dispatchEvent(new CustomEvent('set-theme',{detail:'${t}'}))" 
                    style="padding:12px 8px;border-radius:10px;border:2px solid ${t===current?'#3b82f6':'rgba(255,255,255,0.1)'};
                           background:${t===current?'rgba(59,130,246,0.15)':'transparent'};
                           color:white;cursor:pointer;font-size:0.85rem;transition:all 0.15s;
                           display:flex;flex-direction:column;align-items:center;gap:6px;">
                    ${THEME_ICONS[t].replace('aria-hidden="true"','')}
                    <span>${labels[t]}</span>
                </button>`).join('')}
        </div>`,
        showConfirmButton: false,
        showCloseButton: true,
        customClass: { popup: 'bg-dark text-white border border-secondary' }
    });
};

export const enableReadOnlyMode = (profile) => {
    els.body.classList.add('read-only');
    if (els.authContainer) els.authContainer.style.display = 'none';
    if (els.appContent) els.appContent.style.display = 'block';
    
    els.navLinks.forEach(link => { 
        const href = link.querySelector('a')?.getAttribute('href'); 
        if (href === '#cadastro-section' || link.querySelector('a')?.id === 'nav-sugerir-btn') { 
            link.style.display = 'none'; 
        } else { 
            link.style.display = 'block'; 
        } 
    });
    
    if (els.welcomeMsg && profile) { 
        els.welcomeMsg.textContent = `Visualizando perfil de @${profile.nickname}`; 
        els.welcomeMsg.style.display = 'block'; 
    }
    
    if (els.logoutContainer) { 
        els.logoutContainer.innerHTML = `<a href="?" class="btn btn-primary btn-sm"><i class="fas fa-home me-1"></i> Criar meu Perfil</a>`; 
        els.logoutContainer.style.display = 'block'; 
    }
    
    const banner = document.getElementById('visitor-banner');
    if (banner && profile) { 
        banner.textContent = `Modo Visitante: Você está visualizando a lista de @${profile.nickname}`; 
        banner.style.display = 'block'; 
    }
};