async function logout(){
    localStorage.removeItem('token');
    window.location.href = '/';
}

async function valid() {
    const token = localStorage.getItem('token');
    if (!token) {
        console.log('No token');
        alert('Session expired. Please log in again.');
        window.location.href = '/Login';
        return;
    }

    try {
        const response = await fetch('/valid', {
            method: 'POST',
            headers: { 'authorization': token },
        });

        if (!response.ok) {
            console.log('Session expired. Please log in again');
            alert('Session expired. Please log in again.');
            window.location.href = '/Login';
            return;
        }

        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error validating session:', error);
        alert('An error occurred. Please log in again.');
        window.location.href = '/Login';
    }
}

async function downloadFile(file) {
    const response = await fetch('getFile?file=' + file, {
        method: 'GET',
    });
    if(response.ok) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
    }
}