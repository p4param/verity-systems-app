
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth/auth-guard";
import { subDays } from "date-fns";

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
        const range = searchParams.get("range") || "30d";
        const days = range === "90d" ? 90 : range === "60d" ? 60 : 30;

        const startDate = subDays(new Date(), days);

        const history = await prisma.complianceSnapshot.findMany({
            where: {
                tenantId: user.tenantId,
                snapshotDate: { gte: startDate }
            },
            orderBy: { snapshotDate: "asc" }
        });

        return NextResponse.json({ success: true, data: history });

    } catch (error: any) {
        if (error instanceof Response) return error;
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
