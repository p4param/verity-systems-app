import jwt, { SignOptions, VerifyOptions } from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "default-secret-key-change-in-prod";

const DEFAULT_OPTIONS = {
    expiresIn: "1h",
    issuer: "dms-api",
    audience: "dms-web",
} as const;

/**
 * Signs a payload to create a JWT.
 * @param payload The data to embed in the token.
 * @param options Additional sign options to override defaults.
 * @returns The signed JWT string.
 */
export function signJwt(payload: object, options?: SignOptions): string {
    return jwt.sign(payload, JWT_SECRET, { ...DEFAULT_OPTIONS, ...options });
}

/**
 * Verifies a JWT and returns the decoded payload.
 * @param token The JWT string to verify.
 * @returns The decoded payload if valid, or null if invalid.
 */
export function verifyJwt<T>(token: string): T | null {
    try {
        const verifyOptions: VerifyOptions = {
            issuer: DEFAULT_OPTIONS.issuer,
            audience: DEFAULT_OPTIONS.audience,
        };
        return jwt.verify(token, JWT_SECRET, verifyOptions) as T;
    } catch (error) {
        console.error("JWT Verification failed:", error);
        return null;
    }
}
