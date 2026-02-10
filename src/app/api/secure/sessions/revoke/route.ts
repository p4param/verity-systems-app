import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/auth-guard";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";

export async function POST(req: Request) {
    try {
        const payload = requireAuth(req);
        const userId = payload.sub;
        const tenantId = payload.tenantId; // Assuming in token
        const ip = req.headers.get("x-forwarded-for") || "unknown";

        const { sessionId } = await req.json();

        if (!sessionId) {
            return NextResponse.json({ error: "Session ID required" }, { status: 400 });
        }

        // 1. Verify Ownership & Existence (Atomic Check)
        const session = await prisma.refreshToken.findFirst({
            where: {
                id: sessionId,
                userId: userId
            }
        });

        if (!session) {
            // Return success even if not found to prevent enumeration/leaks implies 404
            // But for own sessions 404 is fine.
            return NextResponse.json({ error: "Session not found" }, { status: 404 });
        }

        // 2. Revoke
        if (!session.revokedAt) {
            await prisma.$transaction(async (tx) => {
                await tx.refreshToken.update({
                    where: { id: sessionId },
                    data: {
                        revokedAt: new Date(),
                        revokedByIp: ip
                    }
                });

                await createAuditLog({
                    tenantId: tenantId,
                    actorUserId: userId,
                    targetUserId: userId,
                    action: "SESSION_REVOKED",
                    details: `Session ${sessionId} revoked by user`,
                    ipAddress: ip
                }, tx);
            });
        }

        return NextResponse.json({ message: "Session revoked" });

    } catch (error) {
        if (error instanceof Response) return error;
        console.error(error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
