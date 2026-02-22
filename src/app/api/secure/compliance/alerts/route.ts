
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth/auth-guard";

export async function GET(req: Request) {
    try {
        const user = await requireAuth(req);

        // RBAC Check
        const hasPermission = user.permissions?.includes("COMPLIANCE_VIEW") ||
            user.permissions?.includes("SYSTEM_ADMIN");

        if (!hasPermission) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const { searchParams } = new URL(req.url);
        const resolved = searchParams.get("resolved") === "true";

        const alerts = await prisma.complianceAlert.findMany({
            where: {
                tenantId: user.tenantId,
                resolvedAt: resolved ? { not: null } : null
            },
            orderBy: { createdAt: "desc" }
        });

        return NextResponse.json({ success: true, data: alerts });

    } catch (error: any) {
        if (error instanceof Response) return error;
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
