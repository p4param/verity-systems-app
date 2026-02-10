import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/auth-guard";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";

export async function POST(req: Request) {
    try {
        const payload = requireAuth(req);
        const userId = payload.sub;
        const tenantId = payload.tenantId;
        const ip = req.headers.get("x-forwarded-for") || "unknown";

        await prisma.$transaction(async (tx) => {
            // 1. Bulk Revoke
            const result = await tx.refreshToken.updateMany({
                where: {
                    userId: userId,
                    revokedAt: null
                },
                data: {
                    revokedAt: new Date(),
                    revokedByIp: ip
                }
            });

            // 2. Audit
            if (result.count > 0) {
                await createAuditLog({
                    tenantId: tenantId,
                    actorUserId: userId,
                    targetUserId: userId,
                    action: "ALL_SESSIONS_REVOKED",
                    details: `Global logout initiated. ${result.count} sessions revoked.`,
                    ipAddress: ip
                }, tx);
            }
        });

        return NextResponse.json({ message: "All sessions revoked" });

    } catch (error) {
        if (error instanceof Response) return error;
        console.error(error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
