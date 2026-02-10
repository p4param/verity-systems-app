import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requirePermission } from "@/lib/auth/permission-guard"
import { createAuditLog } from "@/lib/audit"

export async function POST(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        // 1. Require admin authentication
        const admin = await requirePermission(req, "USER_UPDATE")

        // 2. Get user ID from params
        const { id } = await params
        const userId = parseInt(id)

        if (isNaN(userId)) {
            return NextResponse.json(
                { message: "Invalid user ID" },
                { status: 400 }
            )
        }

        // 3. Parse optional reason from request body
        const body = await req.json().catch(() => ({}))
        const reason = body.reason || null

        // 4. Verify user exists and belongs to admin's tenant
        // 4. Verify user exists and belongs to admin's tenant
        const user = await prisma.user.findFirst({
            where: {
                id: userId,
                tenantId: admin.tenantId
            }
        })

        if (!user) {
            return NextResponse.json(
                { message: "User not found in your tenant" },
                { status: 404 }
            )
        }

        // 5. Prevent self-deactivation
        if (admin.sub === userId) {
            return NextResponse.json(
                { message: "Cannot deactivate your own account" },
                { status: 400 }
            )
        }

        // 6. Check if user is already disabled
        if (user.isActive === false) {
            return NextResponse.json(
                { message: "User is already deactivated" },
                { status: 400 }
            )
        }

        // 7. Deactivate user and revoke sessions in transaction
        await prisma.$transaction(async (tx) => {
            // Set user status to DISABLED (Update isActive)
            await tx.user.update({
                where: { id: userId },
                data: {
                    isActive: false,
                    updatedAt: new Date(),
                    updatedBy: admin.sub
                }
            })

            // Revoke all active sessions for the user
            await tx.refreshToken.updateMany({
                where: {
                    userId: userId,
                    revokedAt: null
                },
                data: {
                    revokedAt: new Date(),
                    revokedByIp: req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown"
                }
            })

            // Log audit event
            await createAuditLog({
                tenantId: admin.tenantId,
                actorUserId: admin.sub,
                targetUserId: userId,
                action: "USER.DEACTIVATE",
                details: JSON.stringify({
                    email: user.email,
                    fullName: user.fullName,
                    reason: reason,
                    previousStatus: user.isActive ? 'ACTIVE' : 'DISABLED',
                    sessionsRevoked: true
                }),
                ipAddress: req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown"
            }, tx)
        })

        // 8. Return success response
        return NextResponse.json({
            message: "User deactivated successfully",
            user: {
                id: user.id,
                email: user.email,
                fullName: user.fullName,
                status: "DISABLED"
            }
        })

    } catch (error) {
        if (error instanceof Response) return error

        console.error("[USER_DEACTIVATE_ERROR]", error)

        return NextResponse.json(
            { message: error instanceof Error ? error.message : "Internal Server Error" },
            { status: 500 }
        )
    }
}
