export const QRManager = {
    setupShareButton: (profile) => {
        if (!profile) return;

        // btn-qr-code agora é estático no HTML — apenas conecta o listener
        const btn = document.getElementById('btn-qr-code');
        if (!btn || btn.dataset.listenerAttached) return;
        btn.dataset.listenerAttached = 'true';

        btn.addEventListener('click', () => {
            const url = `${window.location.origin}${window.location.pathname}?u=${profile.uid}`;
            
            
            Swal.fire({
                title: 'Seu Perfil Público',
                html: `
                    <div id="swal-qr-container" class="d-flex justify-content-center my-4 min-h-150px">
                        <div class="spinner-border text-info" role="status"></div>
                    </div>
                    <p class="small text-muted mb-0">Mostre este código para compartilhar sua coleção</p>
                `,
                showConfirmButton: true,
                confirmButtonText: 'Fechar',
                confirmButtonColor: '#3085d6',
                customClass: { popup: 'bg-dark text-white border border-secondary' },
                didOpen: async () => {
                    try {
                        await QRManager.loadLibrary();
                        const container = document.getElementById('swal-qr-container');
                        container.innerHTML = ''; 
                        
                        
                        const qrWrapper = document.createElement('div');
                        qrWrapper.className = 'bg-white p-3 rounded shadow';
                        container.appendChild(qrWrapper);

                        new window.QRCode(qrWrapper, { 
                            text: url, 
                            width: 180, 
                            height: 180, 
                            colorDark : "#000000", 
                            colorLight : "#ffffff" 
                        });
                    } catch (e) {
                        document.getElementById('swal-qr-container').innerHTML = '<span class="text-danger small">Erro ao carregar QRCode.js</span>';
                    }
                }
            });
        });
    },

    loadLibrary: () => {
        return new Promise((resolve, reject) => {
            if (window.QRCode) return resolve();
            
            const script = document.createElement('script');
            script.src = "https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js";
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }
};