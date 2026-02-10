import { NextResponse } from "next/server";
import crypto from "crypto";
import bcrypt from "bcrypt";
import { requireAuth } from "@/lib/auth/auth-guard";
import { prisma } from "@/lib/prisma";
import { verifyMFA } from "@/lib/auth/mfa";

import { createAuditLog } from "@/lib/audit";

export async function POST(req: Request) {
    try {
        // Rebuild trigger
        const user = requireAuth(req);
        const { secret, code } = await req.json();

        if (!secret || !code) {
            return NextResponse.json({ error: "Secret and code are required" }, { status: 400 });
        }

        const isValid = await verifyMFA({ token: code, secret });

        if (!isValid) {
            return NextResponse.json({ error: "Invalid code" }, { status: 400 });
        }

        // Generate 10 Backup Codes
        const backupCodes = Array.from({ length: 10 }, () => crypto.randomBytes(4).toString("hex")); // e.g., "a1b2c3d4"
        const hashedCodes = await Promise.all(backupCodes.map(code => bcrypt.hash(code, 10)));

        // Save to DB in transaction (Tenant-Safe)
        await prisma.$transaction(async (tx) => {
            await tx.user.update({
                where: {
                    tenantId_email: {
                        tenantId: user.tenantId,
                        email: user.email
                    }
                },
                data: {
                    mfaEnabled: true,
                    mfaSecret: secret,
                    mfaSetupRequired: false,
                    // Nested writes ensure tenant context is maintained for relations
                    MfaBackupCodes: {
                        deleteMany: {}, // Deletes all existing codes for this user
                        create: hashedCodes.map(hash => ({
                            codeHash: hash,
                            used: false
                        }))
                    }
                }
            });

            // Audit (using the same transaction)
            await createAuditLog({
                tenantId: user.tenantId,
                actorUserId: user.sub,
                targetUserId: user.sub,
                action: "MFA_ENABLED",
                details: "MFA setup/re-enrollment completed.",
                ipAddress: req.headers.get("x-forwarded-for") || "unknown"
            }, tx);
        });

        return NextResponse.json({
            message: "MFA enabled successfully",
            backupCodes
        });
    } catch (error) {
        if (error instanceof Response) return error;
        console.error("[MFA_CONFIRM]", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
