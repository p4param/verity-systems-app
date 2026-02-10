import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/auth-guard";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
    try {
        const payload = requireAuth(req);
        const userId = payload.sub;
        const currentSid = payload.sid; // Read SID from token

        // Fetch active sessions
        const start = Date.now();
        const sessions = await prisma.refreshToken.findMany({
            where: {
                userId: userId,
                revokedAt: null,
                expiresAt: { gt: new Date() }
            },
            select: {
                id: true,
                deviceInfo: true,
                ipAddress: true,
                lastActiveAt: true,
                createdAt: true,
                expiresAt: true
            },
            orderBy: { lastActiveAt: 'desc' }
        });

        // Mark current session
        const sessionsWithCurrent = sessions.map(s => ({
            ...s,
            isCurrent: s.id === currentSid
        }));

        return NextResponse.json({ sessions: sessionsWithCurrent });
    } catch (error) {
        if (error instanceof Response) return error;
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
