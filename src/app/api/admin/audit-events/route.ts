import { NextResponse } from "next/server"
import { requirePermission } from "@/lib/auth/permission-guard"
import { prisma } from "@/lib/prisma"

export async function GET(req: Request) {
    try {
        const currentUser = await requirePermission(req, "AUDIT_VIEW")

        const { searchParams } = new URL(req.url)
        const page = parseInt(searchParams.get("page") || "1")
        const limit = parseInt(searchParams.get("limit") || "50")
        const action = searchParams.get("action")
        const actorEmail = searchParams.get("actorEmail")
        const dateFrom = searchParams.get("dateFrom")
        const dateTo = searchParams.get("dateTo")

        // Build where clause
        const where: any = {
            tenantId: currentUser.tenantId
        }

        if (action) {
            where.action = action
        }

        if (actorEmail) {
            where.actor = {
                email: actorEmail
            }
        }

        if (dateFrom || dateTo) {
            where.createdAt = {}
            if (dateFrom) {
                where.createdAt.gte = new Date(dateFrom)
            }
            if (dateTo) {
                where.createdAt.lte = new Date(dateTo)
            }
        }

        // Fetch events with pagination
        const skip = (page - 1) * limit

        const [events, total] = await Promise.all([
            prisma.auditLog.findMany({
                where,
                include: {
                    actor: {
                        select: {
                            email: true
                        }
                    }
                },
                orderBy: {
                    createdAt: "desc"
                },
                skip,
                take: limit
            }),
            prisma.auditLog.count({ where })
        ])

        // Transform to match expected format
        const transformedEvents = events.map(event => ({
            id: event.id.toString(),
            action: event.action,
            actorUserId: event.actorUserId,
            actorEmail: event.actor?.email || null,
            actorType: event.actorUserId ? "USER" : "SYSTEM",
            targetType: event.targetUserId ? "USER" : null,
            targetId: event.targetUserId,
            ipAddress: event.ipAddress || "Unknown",
            correlationId: null, // Add if you have this field
            details: event.details,
            createdAt: event.createdAt.toISOString()
        }))

        return NextResponse.json({
            events: transformedEvents,
            hasMore: skip + events.length < total,
            total
        })
    } catch (error) {
        if (error instanceof Response) {
            return error
        }

        return NextResponse.json(
            { message: error instanceof Error ? error.message : "Internal Server Error" },
            { status: 500 }
        )
    }
}
