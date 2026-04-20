export const getResizedUrl = (url, width = 300) => {
    if (!url || url === 'N/A') return null;
    if (url.includes('_SX')) return url.replace(/_SX[0-9]+/, `_SX${width}`);
    else if (url.includes('media-amazon.com') || url.includes('omdbapi.com')) return url.replace(/\.(jpg|jpeg|png)$/i, `_SX${width}.$1`);
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