import { TOTP, NobleCryptoPlugin, ScureBase32Plugin } from "otplib";

/**
 * Shared TOTP authenticator instance configured with:
 * - NobleCryptoPlugin (platform-agnostic crypto)
 * - ScureBase32Plugin (Base32 decoding)
 * - Standard defaults (SHA1, 6 digits, 30s period)
 */
export const authenticator = new TOTP({
    period: 30,
    digits: 6,
    algorithm: "sha1",
    crypto: new NobleCryptoPlugin(),
    base32: new ScureBase32Plugin(),
});

/**
 * Helper to verify a token against a secret.
 * Handles the async nature and return object of otplib v13.
 */
export async function verifyMFA({ token, secret }: { token: string; secret: string }): Promise<boolean> {
    try {
        const result = await authenticator.verify(token, {
            secret,
            epochTolerance: 1 // Allow 1 step tolerance (±30s)
        });
        return result.valid;
    } catch (error) {
        console.error("MFA Verify Error:", error);
        return false;
    }
}
