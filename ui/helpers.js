export const getResizedUrl = (url, width = 300) => {
    if (!url || url === 'N/A') return null;
    // Usa proxy wsrv.nl para evitar 404 de URLs expiradas do Amazon/IMDb
    // e também resolve CORS para uso no canvas
    return `https://wsrv.nl/?url=${encodeURIComponent(url)}&w=${width}&output=jpg&default=1`;
};

// Retorna a URL original do OMDb sem proxy (para salvar no Firestore)
export const getPosterOriginal = (url) => {
    if (!url || url === 'N/A') return '';
    return url;
};

export const initDragScroll = (el) => {
    if (!el || el.dataset.dragInit) return;
    el.dataset.dragInit = 'true';
    
    let isDown = false;
    let startX, scrollLeft;
    let animationFrameId; 
    
    el.addEventListener('mousedown', (e) => {
        isDown = true;
        el.classList.add('active'); 
        startX = e.pageX - el.offsetLeft;
        scrollLeft = el.scrollLeft;
        cancelAnimationFrame(animationFrameId); 
    });
    
    const stopDrag = () => {
        isDown = false;
        el.classList.remove('active');
        cancelAnimationFrame(animationFrameId);
    };
    
    el.addEventListener('mouseleave', stopDrag);
    el.addEventListener('mouseup', stopDrag);
    
    el.addEventListener('mousemove', (e) => {
        if (!isDown) return;
        e.preventDefault();
        cancelAnimationFrame(animationFrameId);
        animationFrameId = requestAnimationFrame(() => {
            const x = e.pageX - el.offsetLeft;
            const walk = (x - startX) * 2; 
            el.scrollLeft = scrollLeft - walk;
        });
    });
};