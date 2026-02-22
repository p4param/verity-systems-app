
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth/auth-guard";
import { createAuditLog } from "@/lib/audit";

export async function GET(req: Request) {
    try {
        const user = await requireAuth(req);

        // RBAC Check
        const hasPermission = user.permissions?.includes("COMPLIANCE_VIEW") ||
            user.permissions?.includes("SYSTEM_ADMIN");

        if (!hasPermission) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const latestSnapshot = await prisma.complianceSnapshot.findFirst({
            where: { tenantId: user.tenantId },
            orderBy: { snapshotDate: "desc" }
        });

        await createAuditLog({
            tenantId: user.tenantId,
            actorUserId: Number(user.sub),
            entityType: "SYSTEM",
            entityId: "COMPLIANCE_DASHBOARD",
            action: "SYSTEM.COMPLIANCE_SUMMARY_VIEWED",
            details: "Viewed compliance dashboard summary."
        });

        return NextResponse.json({ success: true, data: latestSnapshot });

    } catch (error: any) {
        if (error instanceof Response) return error;
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
