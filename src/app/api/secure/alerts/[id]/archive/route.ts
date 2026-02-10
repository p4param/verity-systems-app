import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/auth-guard";
import { prisma } from "@/lib/prisma";

export async function POST(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const user = await requireAuth(req);
        const { id } = await params;
        const alertId = parseInt(id);

        if (isNaN(alertId)) {
            return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
        }

        const count = await prisma.securityAlert.count({
            where: {
                id: alertId,
                userId: user.sub,
                user: { tenantId: user.tenantId }
            }
        });

        if (count === 0) {
            return NextResponse.json({ error: "Alert not found" }, { status: 404 });
        }

        // Hard delete for now, could be soft delete if we added deletedAt
        await prisma.securityAlert.delete({
            where: {
                id: alertId,
                userId: user.sub,
                user: { tenantId: user.tenantId }
            }
        });

        return NextResponse.json({ message: "Alert archived" });

    } catch (error) {
        if (error instanceof Response) return error;
        console.error("Alert Archive Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
