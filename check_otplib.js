const otplib = require('otplib');
console.log('Exports:', Object.keys(otplib));
if (otplib.authenticator) {
    console.log('authenticator type:', typeof otplib.authenticator);
} else {
    console.log('authenticator not found in exports');
}
try {
    const { authenticator } = require('otplib');
    console.log('Destructured authenticator:', typeof authenticator);
} catch (e) {
    console.log('Destructuring failed:', e.message);
}
