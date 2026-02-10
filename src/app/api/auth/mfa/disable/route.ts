import { NextResponse } from "next/server";
import bcrypt from "bcrypt";
import { requireAuth } from "@/lib/auth/auth-guard";
import { prisma } from "@/lib/prisma";
import { verifyMFA } from "@/lib/auth/mfa";
import { createAuditLog } from "@/lib/audit";

export async function POST(req: Request) {
    try {
        const userPayload = requireAuth(req);
        const { password, mfaCode } = await req.json();

        if (!password || !mfaCode) {
            return NextResponse.json({ error: "Password and MFA code are required" }, { status: 400 });
        }

        const user = await prisma.user.findUnique({
            where: { id: userPayload.sub }
        });

        if (!user || !user.passwordHash) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        // 1. Verify Password
        const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
        if (!isPasswordValid) {
            return NextResponse.json({ error: "Invalid password" }, { status: 401 });
        }

        // 2. Verify MFA Code (TOTP or Backup)
        let isMfaValid = false;

        if (user.mfaSecret) {
            isMfaValid = await verifyMFA({ token: mfaCode, secret: user.mfaSecret });
        }

        // If TOTP invalid, check backup codes
        if (!isMfaValid) {
            const unusedCodes = await prisma.mfaBackupCode.findMany({
                where: { userId: user.id, used: false }
            });

            for (const backup of unusedCodes) {
                const isMatch = await bcrypt.compare(mfaCode, backup.codeHash);
                if (isMatch) {
                    isMfaValid = true;
                    // Note: We don't mark as used here because we are about to delete them all anyway
                    break;
                }
            }
        }

        if (!isMfaValid) {
            return NextResponse.json({ error: "Invalid MFA code" }, { status: 401 });
        }

        // 3. Disable MFA & Revoke Sessions
        await prisma.$transaction(async (tx) => {
            // Disable MFA
            await tx.user.update({
                where: { id: user.id },
                data: {
                    mfaEnabled: false,
                    mfaSecret: null
                }
            });

            // Delete Backup Codes
            await tx.mfaBackupCode.deleteMany({
                where: { userId: user.id }
            });

            // Revoke All Refresh Tokens (Force Logout)
            await tx.refreshToken.updateMany({
                where: { userId: user.id, revokedAt: null },
                data: { revokedAt: new Date() }
            });

            // Audit
            await createAuditLog({
                tenantId: user.tenantId,
                actorUserId: user.id,
                targetUserId: user.id,
                action: "MFA_DISABLED",
                details: "MFA disabled by user",
                ipAddress: req.headers.get("x-forwarded-for") || "unknown"
            }, tx);
        });

        return NextResponse.json({ message: "MFA disabled successfully" });

    } catch (error) {
        if (error instanceof Response) return error;
        console.error("[MFA_DISABLE]", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
