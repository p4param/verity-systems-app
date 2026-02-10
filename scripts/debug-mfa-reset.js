const fs = require('fs');
const jwt = require('jsonwebtoken');
const path = require('path');

// Manually load env
let JWT_SECRET = "default-secret-key-change-in-prod";
try {
    const envPath = path.resolve(process.cwd(), '.env.local');
    const envFile = fs.readFileSync(envPath, 'utf8');
    const match = envFile.match(/JWT_SECRET=(.*)/);
    if (match && match[1]) {
        JWT_SECRET = match[1].trim();
    }
} catch (e) {
    console.log("Could not load .env.local, using default");
}

const API_URL = "http://localhost:3000/api";

function generateToken() {
    return jwt.sign(
        {
            sub: 1, // Admin User ID
            email: "admin@dms.com",
            tenantId: 1,
            roles: ["Admin"],
            // Note: The API fetches permissions from DB, it doesn't trust this claim for the crucial check.
            // But we include standard claims.
        },
        JWT_SECRET,
        { expiresIn: "10m", issuer: "dms-api", audience: "dms-web" }
    );
}

async function testReset() {
    const token = generateToken();
    const userIdToReset = 1; // Testing on self (Admin)

    console.log(`Testing Reset for User ${userIdToReset}...`);
    console.log(`Using Token: ${token.substring(0, 20)}...`);

    try {
        const res = await fetch(`${API_URL}/admin/users/${userIdToReset}/mfa/reset`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            }
        });

        const status = res.status;
        const text = await res.text();

        console.log(`Status: ${status}`);
        console.log(`Body: ${text}`);

    } catch (e) {
        console.error("Fetch failed:", e);
    }
}

testReset();
