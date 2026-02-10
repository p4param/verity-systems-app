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

        await prisma.securityAlert.update({
            where: {
                id: alertId,
                userId: user.sub,
                user: { tenantId: user.tenantId }
            },
            data: { isRead: true }
        });

        return NextResponse.json({ message: "Alert marked as read" });

    } catch (error) {
        if (error instanceof Response) return error;
        console.error("Alert Read Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
