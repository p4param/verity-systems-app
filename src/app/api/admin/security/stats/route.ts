import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requirePermission } from "@/lib/auth/permission-guard"

export async function GET(req: Request) {
    try {
        // Require permission to view security audit data
        const admin = await requirePermission(req, "AUDIT_VIEW")
        const tenantId = admin.tenantId

        // Time window for recent events (24 hours)
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)

        // Execute queries in parallel for performance
        const [
            totalUsers,
            mfaEnabledUsers,
            failedLogins,
            activeIncidents
        ] = await Promise.all([
            // 1. Total Active Users
            prisma.user.count({
                where: {
                    tenantId,
                    status: "ACTIVE" // Only count active users for adoption rate
                }
            }),
            // 2. Users with MFA Enabled
            prisma.user.count({
                where: {
                    tenantId,
                    mfaEnabled: true,
                    status: "ACTIVE"
                }
            }),
            // 3. Failed Logins in last 24h
            prisma.auditLog.count({
                where: {
                    tenantId,
                    action: "USER.LOGIN_FAILED",
                    createdAt: { gt: oneDayAgo }
                }
            }),
            // 4. Active Incidents (High/Critical + Unread)
            prisma.securityAlert.count({
                where: {
                    user: { tenantId }, // Filter via user relation
                    isRead: false,
                    severity: { in: ["CRITICAL", "HIGH"] }
                }
            })
        ])

        const mfaRate = totalUsers > 0 ? Math.round((mfaEnabledUsers / totalUsers) * 100) : 0

        return NextResponse.json({
            mfaAdoption: {
                enabled: mfaEnabledUsers,
                total: totalUsers,
                rate: mfaRate
            },
            failedLogins24h: failedLogins,
            activeIncidents: activeIncidents
        })

    } catch (error) {
        console.error("[SecurityAPI] Stats error:", error)
        if (error instanceof Response) return error
        return NextResponse.json(
            { message: "Internal Server Error" },
            { status: 500 }
        )
    }
}
