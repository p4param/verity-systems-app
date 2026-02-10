async function testLogin() {
    const email = 'test@example.com';
    const password = 'password123';

    console.log('Testing login API...');
    try {
        const response = await fetch('http://localhost:3000/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
        });

        if (!response.ok) {
            console.error('Login failed with status:', response.status);
            const text = await response.text();
            console.error('Response:', text);
            return;
        }

        const data = await response.json();
        console.log('Login successful!');
        console.log('User:', data.user.email);
        console.log('Has Access Token:', !!data.accessToken);
        console.log('Has Refresh Token:', !!data.refreshToken);

    } catch (error) {
        console.error('Error fetching login API:', error);
    }
}

testLogin();
