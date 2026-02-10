import bcrypt from "bcrypt";

const SALT_ROUNDS = 12;

/**
 * Hashes a plain text password using bcrypt.
 * @param password The plain text password to hash.
 * @returns The hashed password string.
 */
export async function hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Verifies a plain text password against a hash.
 * @param password The plain text password.
 * @param hash The stored hash to verify against.
 * @returns True if the password matches the hash, false otherwise.
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
}
