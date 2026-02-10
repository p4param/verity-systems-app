import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/auth-guard";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
    try {
        const user = await requireAuth(req);

        await prisma.securityAlert.updateMany({
            where: {
                userId: user.sub,
                isRead: false,
                user: { tenantId: user.tenantId }
            },
            data: { isRead: true }
        });

        return NextResponse.json({ message: "All alerts marked as read" });

    } catch (error) {
        if (error instanceof Response) return error;
        console.error("Alerts Read-All Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
