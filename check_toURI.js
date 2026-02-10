const { TOTP } = require('otplib');
const t = new TOTP({
    // Default options usually fine, but let's see.
});
console.log('toURI length:', t.toURI.length);
// Try calling it. Old keyuri was (user, issuer, secret).
// toURI might be different. Let's try guessing signature based on typical library changes.
// maybe (secret, label, issuer)?
try {
    const uri = t.toURI('MYSECRET', 'user@example.com', 'MyIssuer');
    console.log('toURI(s, u, i):', uri);
} catch (e) {
    console.log('Error 1:', e.message);
}

// Try object?
try {
    const uri = t.toURI({ secret: 'MYSECRET', label: 'user@example.com', issuer: 'MyIssuer' });
    console.log('toURI(obj):', uri);
} catch (e) {
    console.log('Error 2:', e.message);
}
