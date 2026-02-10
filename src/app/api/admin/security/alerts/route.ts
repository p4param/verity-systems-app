import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requirePermission } from "@/lib/auth/permission-guard"

export async function GET(req: Request) {
    try {
        const admin = await requirePermission(req, "AUDIT_VIEW")
        const tenantId = admin.tenantId

        const { searchParams } = new URL(req.url)
        const page = parseInt(searchParams.get("page") || "1")
        const limit = parseInt(searchParams.get("limit") || "10")
        const severity = searchParams.get("severity") // Optional filter

        const skip = (page - 1) * limit

        const whereClause: any = {
            user: {
                tenantId // Ensure relation consistency
            }
        }

        if (severity) {
            whereClause.severity = severity
        }

        const [alerts, total] = await Promise.all([
            prisma.securityAlert.findMany({
                where: whereClause,
                take: limit,
                skip,
                orderBy: {
                    createdAt: "desc"
                },
                include: {
                    user: {
                        select: {
                            id: true,
                            email: true,
                            fullName: true
                        }
                    }
                }
            }),
            prisma.securityAlert.count({
                where: whereClause
            })
        ])

        return NextResponse.json({
            data: alerts,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        })

    } catch (error) {
        console.error("[SecurityAPI] Alerts error:", error)
        if (error instanceof Response) return error
        return NextResponse.json(
            { message: "Internal Server Error" },
            { status: 500 }
        )
    }
}
