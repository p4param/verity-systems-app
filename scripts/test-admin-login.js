async function testAdminLogin() {
    const email = 'admin@dms.com';
    const password = 'Admin@123';

    console.log(`Testing Login for ${email}...`);
    try {
        const response = await fetch('http://localhost:3000/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
        });

        if (!response.ok) {
            console.error('Login failed:', response.status);
            console.error(await response.text());
            return;
        }

        const data = await response.json();
        console.log('Login successful');
        console.log('User:', data.user.email);
        console.log('Roles in response:', data.user.roles);

        // Check Payload (decode JWT)
        const token = data.accessToken;
        const payload = JSON.parse(atob(token.split('.')[1]));
        console.log('Token Payload Roles:', payload.roles);

        // Test Admin Endpoint
        console.log('Testing Admin Endpoint...');
        const adminRes = await fetch('http://localhost:3000/api/secure/admin-only', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (adminRes.ok) {
            console.log('Admin Access: GRANTED');
            const adminData = await adminRes.json();
            console.log('Admin Message:', adminData.message);
        } else {
            console.error('Admin Access: DENIED', adminRes.status);
        }
    } catch (error) {
        console.error('Error:', error);
    }
}

testAdminLogin();
