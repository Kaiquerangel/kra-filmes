export const toast = (title, icon = 'success') => {
    const Toast = Swal.mixin({ 
        toast: true, 
        position: 'top-end', 
        showConfirmButton: false, 
        timer: 3000, 
        timerProgressBar: true, 
        didOpen: (t) => { 
            t.addEventListener('mouseenter', Swal.stopTimer); 
            t.addEventListener('mouseleave', Swal.resumeTimer); 
        } 
    });
    Toast.fire({ icon, title });
};

export const alert = (title, text, icon = 'info') => {
    return Swal.fire({ title, text, icon });
};

export const confirm = (title, text, confirmBtnText = 'Sim', cancelBtnText = 'Cancelar') => {
    return Swal.fire({ 
        title, text, icon: 'warning', showCancelButton: true, 
        confirmButtonColor: '#3085d6', cancelButtonColor: '#d33', 
        confirmButtonText: confirmBtnText, cancelButtonText: cancelBtnText 
    });
};