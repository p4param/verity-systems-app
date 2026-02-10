import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/auth-guard";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";
import { getUserPermissions } from "@/lib/auth/permission";

/**
 * POST /api/admin/users/[id]/mfa/reset
 * Admin-assisted MFA reset.
 * Revokes sessions, clears secrets, and forces re-setup.
 */
export async function POST(
    req: Request,
    { params }: { params: Promise<{ id: string }> } // params is now a Promise in Next.js 15+
) {
    try {
        const userPayload = requireAuth(req);
        const adminId = userPayload.sub;
        const tenantId = userPayload.tenantId;
        const { id: targetUserIdStr } = await params;
        const targetUserId = parseInt(targetUserIdStr);

        if (isNaN(targetUserId)) {
            return NextResponse.json({ error: "Invalid user ID" }, { status: 400 });
        }

        // 1. Permission Check
        // Need "users.manage" or similar. Since we don't have granular permissions fully enforced yet,
        // we'll rely on the role check or specific permissions if available.
        // For now, let's assume 'users.manage' is the standard.
        const permissions = await getUserPermissions(adminId, tenantId);

        // TODO: Replace with your actual permission constant
        const CAN_MANAGE_USERS = permissions.includes("users.manage");

        // Fallback: Check if admin has 'Admin' role if permissions aren't fully set up
        const adminUser = await prisma.user.findUnique({
            where: { id: adminId },
            include: { userRoles: { include: { role: true } } }
        });

        const isAdmin = adminUser?.userRoles.some(ur => ur.role.name === 'Admin' || ur.role.name === 'Super Admin');

        if (!CAN_MANAGE_USERS && !isAdmin) {
            return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
        }

        // 2. Fetch Target User
        const targetUser = await prisma.user.findFirst({
            where: { id: targetUserId, tenantId }
        });

        if (!targetUser) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        // 3. Safety: Don't allow resetting another Admin unless Super Admin (Self-protection)
        // Ignoring for now to keep logic simple, but good for production.

        // 4. Execute Reset (Transaction)
        await prisma.$transaction(async (tx) => {
            // A. Reset User MFA Flags
            await tx.user.update({
                where: { id: targetUserId },
                data: {
                    mfaEnabled: false,
                    mfaSecret: null,
                    mfaSetupRequired: true // Force setup on next login
                }
            });

            // B. Clear Backup Codes
            await tx.mfaBackupCode.deleteMany({
                where: { userId: targetUserId }
            });

            // C. Revoke All Sessions (Immediate Logout)
            await tx.refreshToken.updateMany({
                where: { userId: targetUserId, revokedAt: null },
                data: { revokedAt: new Date() }
            });

            // D. Audit Log
            await createAuditLog({
                tenantId: tenantId,
                actorUserId: adminId,
                targetUserId: targetUserId,
                action: "USER_MFA_RESET_BY_ADMIN",
                details: "MFA reset initiated. Sessions revoked. Force re-enrollment enabled.",
                ipAddress: req.headers.get("x-forwarded-for") || "unknown"
            }, tx);
        });

        return NextResponse.json({ message: "User MFA reset successfully. They will be required to re-enroll on next login." });

    } catch (error) {
        if (error instanceof Response) return error; // Internal redirects/errors
        console.error("[MFA_RESET_API]", error);
        return NextResponse.json({
            error: "Internal Server Error",
            details: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined
        }, { status: 500 });
    }
}
