import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/auth-guard";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
    try {
        const user = await requireAuth(req);

        // Parse pagination
        const { searchParams } = new URL(req.url);
        const page = parseInt(searchParams.get("page") || "1");
        const limit = parseInt(searchParams.get("limit") || "10");
        const skip = (page - 1) * limit;

        const [alerts, total] = await prisma.$transaction([
            prisma.securityAlert.findMany({
                where: {
                    userId: user.sub,
                    user: { tenantId: user.tenantId }
                },
                orderBy: { createdAt: 'desc' },
                take: limit,
                skip: skip
            }),
            prisma.securityAlert.count({
                where: {
                    userId: user.sub,
                    user: { tenantId: user.tenantId }
                }
            })
        ]);

        // Count unread
        const unreadCount = await prisma.securityAlert.count({
            where: {
                userId: user.sub,
                isRead: false,
                user: { tenantId: user.tenantId }
            }
        });

        return NextResponse.json({
            alerts,
            meta: {
                page,
                limit,
                total,
                unreadCount,
                totalPages: Math.ceil(total / limit)
            }
        });

    } catch (error) {
        if (error instanceof Response) return error;
        console.error("Alerts GET Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
