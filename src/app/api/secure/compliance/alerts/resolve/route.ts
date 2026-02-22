
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth/auth-guard";
import { createAuditLog } from "@/lib/audit";

export async function POST(req: Request) {
    try {
        const user = await requireAuth(req);

        // RBAC Check
        const hasPermission = user.permissions?.includes("COMPLIANCE_VIEW") ||
            user.permissions?.includes("SYSTEM_ADMIN");

        if (!hasPermission) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const { alertId } = await req.json();
        if (!alertId) {
            return NextResponse.json({ error: "Alert ID is required" }, { status: 400 });
        }

        // Ensure alert belongs to this tenant
        const alert = await prisma.complianceAlert.findUnique({
            where: { id: alertId }
        });

        if (!alert || alert.tenantId !== user.tenantId) {
            return NextResponse.json({ error: "Alert not found" }, { status: 404 });
        }

        const updatedAlert = await prisma.complianceAlert.update({
            where: { id: alertId },
            data: { resolvedAt: new Date() }
        });

        await createAuditLog({
            tenantId: user.tenantId,
            actorUserId: Number(user.sub),
            entityType: "SYSTEM",
            entityId: alertId,
            action: "SYSTEM.COMPLIANCE_ALERT_RESOLVED",
            details: `Resolved compliance alert: ${alert.type}`,
            metadata: { alertType: alert.type }
        });

        return NextResponse.json({ success: true, data: updatedAlert });

    } catch (error: any) {
        if (error instanceof Response) return error;
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
