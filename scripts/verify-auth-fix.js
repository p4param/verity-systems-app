const fs = require('fs');
const jwt = require('jsonwebtoken');
const path = require('path');

const BASE_URL = "http://localhost:3000/api/secure/profile";

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

const DEFAULT_OPTIONS = {
    expiresIn: "1h",
    issuer: "dms-api",
    audience: "dms-web",
};

async function testAuth() {
    console.log("Starting Auth Verification (Valid Token)...");
    console.log("Using Secret:", JWT_SECRET ? "Loaded form env" : "Using Default");

    // Generate Valid Token
    const payload = {
        sub: 1,
        email: "test@example.com",
        tenantId: 1,
        roles: ["USER"]
    };

    const token = jwt.sign(payload, JWT_SECRET, DEFAULT_OPTIONS);
    console.log("Generated Token:", token);

    // Test 3: Valid Token
    console.log("\nTest 3: Check Valid Token");
    try {
        const res = await fetch(BASE_URL, {
            headers: {
                "Authorization": `Bearer ${token}`
            }
        });

        console.log(`Status: ${res.status}`);
        const data = await res.json();
        console.log("Response:", JSON.stringify(data, null, 2));

        if (res.status === 200) {
            console.log("PASS: Accepted valid token.");
        } else {
            console.error("FAIL: Should have returned 200.");
        }
    } catch (e) {
        console.error("Error connecting:", e.message);
    }
}

testAuth();

