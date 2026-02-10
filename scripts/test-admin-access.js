const fetch = require('node-fetch'); // Using native fetch in Node 18+

async function testAccess() {
    const baseUrl = 'http://localhost:3000';

    console.log('--- RBAC ACCESS TEST ---');

    // 1. Login as User
    console.log('\n[1] Testing as Regular User (test@example.com)');
    const userLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'test@example.com', password: 'password123' })
    });

    if (!userLoginRes.ok) {
        console.error('User login failed');
        process.exit(1);
    }

    const userData = await userLoginRes.json();
    const userAccessToken = userData.accessToken;
    const userCookies = userLoginRes.headers.get('set-cookie');

    console.log('✓ Logged in as User');

    // 1a. Attempt to access /admin (Middleware test)
    const userAdminRes = await fetch(`${baseUrl}/admin`, {
        headers: { 'Cookie': userCookies },
        redirect: 'manual'
    });

    if (userAdminRes.status === 302 || userAdminRes.status === 307) {
        const location = userAdminRes.headers.get('location');
        console.log(`✓ Access to /admin REDIRECTED to ${location} (Status: ${userAdminRes.status})`);
    } else {
        console.log(`✗ Access to /admin NOT redirected. Status: ${userAdminRes.status}`);
    }

    // 1b. Attempt to access Admin API (API Guard test)
    const userAdminApiRes = await fetch(`${baseUrl}/api/admin/roles`, {
        headers: { 'Authorization': `Bearer ${userAccessToken}` }
    });

    if (userAdminApiRes.status === 403) {
        console.log('✓ Access to Admin API REJECTED with 403');
    } else {
        console.log(`✗ Access to Admin API NOT rejected. Status: ${userAdminApiRes.status}`);
    }

    // 2. Login as Admin
    console.log('\n[2] Testing as Admin User (adin@dms.com)');
    const adminLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'adin@dms.com', password: 'password123' })
    });

    if (!adminLoginRes.ok) {
        console.error('Admin login failed');
        process.exit(1);
    }

    const adminData = await adminLoginRes.json();
    const adminAccessToken = adminData.accessToken;
    const adminCookies = adminLoginRes.headers.get('set-cookie');

    console.log('✓ Logged in as Admin');

    // 2a. Attempt to access /admin
    const adminRes = await fetch(`${baseUrl}/admin`, {
        headers: { 'Cookie': adminCookies },
        redirect: 'manual'
    });

    if (adminRes.status === 200 || adminRes.status === 304) {
        console.log(`✓ Access to /admin SUCCESSFUL (Status: ${adminRes.status})`);
    } else if (adminRes.status === 302 || adminRes.status === 307) {
        console.log(`✗ Access to /admin REDIRECTED to ${adminRes.headers.get('location')} (Status: ${adminRes.status})`);
    } else {
        console.log(`✗ Access to /admin FAILED. Status: ${adminRes.status}`);
    }

    // 2b. Attempt to access Admin API
    const adminApiRes = await fetch(`${baseUrl}/api/admin/roles`, {
        headers: { 'Authorization': `Bearer ${adminAccessToken}` }
    });

    if (adminApiRes.ok) {
        console.log('✓ Access to Admin API SUCCESSFUL');
    } else {
        console.log(`✗ Access to Admin API FAILED. Status: ${adminApiRes.status}`);
    }

    console.log('\n--- TEST COMPLETE ---');
}

testAccess().catch(console.error);
