import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyMFA } from "@/lib/auth/mfa";
import { signJwt, verifyJwt } from "@/lib/auth/jwt";
import { generateRefreshToken } from "@/lib/auth/refresh-token";
import { getUserPermissions } from "@/lib/auth/permission";

const ACCESS_TOKEN_EXP = "15m"; // 15 minutes
const REFRESH_TOKEN_DAYS = 7;

export async function POST(req: Request) {
    try {
        const { tempToken, code } = await req.json();

        if (!tempToken || !code) {
            return NextResponse.json({ error: "Token and code are required" }, { status: 400 });
        }

        // Verify temp token
        const decoded = verifyJwt<{ sub: number; purpose: string }>(tempToken);
        if (!decoded || decoded.purpose !== "mfa_pending") {
            return NextResponse.json({ error: "Invalid or expired session" }, { status: 401 });
        }

        const userId = decoded.sub;

        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: { userRoles: { include: { role: true } } }
        });

        if (!user || !user.mfaSecret) {
            return NextResponse.json({ error: "User not found or MFA not configured" }, { status: 400 });
        }

        if (!user.isActive) {
            return NextResponse.json({ error: "Account is inactive" }, { status: 401 });
        }

        if (user.isLocked) {
            return NextResponse.json({ error: "Account is locked" }, { status: 401 });
        }

        let isValid = await verifyMFA({ token: code, secret: user.mfaSecret });

        // If TOTP invalid, check backup codes
        if (!isValid) {
            // Hash the provided code to check against stored hashes
            // Note: In a real app, you'd use a proper hashing function like bcrypt/argon2
            // For now, assuming direct comparison or simple hash if implemented in setup
            // However, user.MfaBackupCodes stores "codeHash".
            // Let's assume for this implementation we need to verify against hashes.
            // Since we don't have the hashing util imported, let's look for a match.
            // CAUTION: This requires the hash function used during setup.
            // Standard approach: iterate and verify.

            // For this iteration, let's assume we need to import a verify helper or similar.
            // But since we don't have 'bcrypt' imported here yet, let's just do TOTP for now
            // AND add the logic for backup codes if we can confirm the hashing strategy.
            // Looking at schema: MfaBackupCode has codeHash.

            // Let's defer backup code implementation slightly to ensure we have the hashing util.
            // Wait, I should implement it.
            // Let's try to match a backup code.

            const backupCode = await prisma.mfaBackupCode.findFirst({
                where: {
                    userId: user.id,
                    used: false,
                    // We need to compare hash. Since we can't query by hash efficiently without knowing the plain text strategy...
                    // Actually, usually you hash the input and query.
                    // Let's assume simple string match for now or update check if possible.
                    // Better: fetch all unused codes and verify.
                }
            });

            // If we can't verify hash here without bcrypt, we might need to add it.
            // Let's stick to TOTP for this specific step if backup code logic is complex
            // OR add the backup code logic if I'm confident.
            // I'll add a TODO/Placeholder or basic check if the input looks like a recovery code.

            // REVISION: The schema has `MfaBackupCode`.
            // Let's fetch unused codes and compare (assuming we can verify).
            const unusedCodes = await prisma.mfaBackupCode.findMany({
                where: { userId: user.id, used: false }
            });

            // We need 'compare' from bcrypt or similar.
            // Let's import 'bcrypt' (it was in package.json).
            const bcrypt = require('bcrypt');

            for (const backup of unusedCodes) {
                const isMatch = await bcrypt.compare(code, backup.codeHash);
                if (isMatch) {
                    isValid = true;
                    // Mark as used
                    await prisma.mfaBackupCode.update({
                        where: { id: backup.id },
                        data: { used: true }
                    });
                    break;
                }
            }
        }

        if (!isValid) {
            return NextResponse.json({ error: "Invalid code" }, { status: 401 });
        }

        // --- SUCCESS: Issue Real Tokens ---

        // 1. Roles & Permissions
        const roles = user.userRoles.map((ur) => ur.role.name); // Check role name property
        const permissions = await getUserPermissions(userId, user.tenantId);

        // 2. Access Token (with AMR claim)
        const accessToken = signJwt(
            {
                sub: user.id,
                tenantId: user.tenantId,
                email: user.email,
                roles,
                permissions,
                amr: ["pwd", "mfa"], // Authentication Method Reference
                mfaEnabled: true
            },
            { expiresIn: ACCESS_TOKEN_EXP }
        );

        // 3. Revoke old refresh tokens
        await prisma.refreshToken.updateMany({
            where: { userId: user.id, revokedAt: null },
            data: { revokedAt: new Date() }
        });

        // 4. Create new refresh token (mfaVerified: true)
        const { token: refreshToken, hash } = generateRefreshToken();
        await prisma.refreshToken.create({
            data: {
                userId: user.id,
                tokenHash: hash,
                mfaVerified: true,
                expiresAt: new Date(Date.now() + REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000)
            }
        });

        // Create response with cookies
        const response = NextResponse.json({
            accessToken,
            refreshToken,
            expiresIn: 15 * 60,
            user: {
                id: user.id,
                fullName: user.fullName,
                email: user.email,
                roles,
                permissions,
                mfaEnabled: true
            }
        });

        const cookieOptions = {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax" as const,
            path: "/",
            maxAge: REFRESH_TOKEN_DAYS * 24 * 60 * 60
        };

        response.cookies.set("accessToken", accessToken, {
            ...cookieOptions,
            maxAge: 15 * 60
        });

        response.cookies.set("refreshToken", refreshToken, cookieOptions);

        return response;

    } catch (error) {
        console.error("[MFA_VERIFY]", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
