
const API_URL = "http://localhost:3000/api/auth/forgot-password";
const EMAIL = "admin@dms.com";

async function testForgot() {
    console.log(`Testing Forgot Password for ${EMAIL}...`);
    try {
        const res = await fetch(API_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: EMAIL })
        });

        console.log(`Status: ${res.status}`);
        const text = await res.text();
        console.log(`Body: ${text}`);
    } catch (e) {
        console.error("Fetch failed:", e);
    }
}

testForgot();
