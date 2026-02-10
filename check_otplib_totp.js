const { TOTP } = require('otplib');
console.log('TOTP exported:', !!TOTP);
if (TOTP) {
    const instance = new TOTP();
    console.log('TOTP instance methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(instance)));
    console.log('TOTP instance keys:', Object.keys(instance));

    // Check if keyuri exists
    if (instance.keyuri) console.log('keyuri exists on instance');
    else console.log('keyuri DOES NOT exist on instance');

    // Check generateSecret
    if (instance.generateSecret) console.log('generateSecret exists on instance');
    else console.log('generateSecret DOES NOT exist on instance');
}
