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

        // 3. Verify user exists and belongs to admin's tenant
        // 3. Verify user exists and belongs to admin's tenant
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

        // 4. Check if user is pending (needs activation, not reactivation)
        // Logic: No password hash implies pending activation
        if (!user.passwordHash) {
            return NextResponse.json(
                { message: "User has not completed activation. Use resend-invite instead." },
                { status: 400 }
            )
        }

        // 5. Check if user is already active
        if (user.isActive === true) {
            return NextResponse.json(
                { message: "User is already active" },
                { status: 400 }
            )
        }

        // 6. Reactivate user in transaction
        await prisma.$transaction(async (tx) => {
            // Set user status to ACTIVE (isActive: true)
            await tx.user.update({
                where: { id: userId },
                data: {
                    isActive: true,
                    updatedAt: new Date(),
                    updatedBy: admin.sub
                }
            })

            // Log audit event
            await createAuditLog({
                tenantId: admin.tenantId,
                actorUserId: admin.sub,
                targetUserId: userId,
                action: "USER.REACTIVATE",
                details: JSON.stringify({
                    email: user.email,
                    fullName: user.fullName,
                    previousStatus: user.isActive ? 'ACTIVE' : 'DISABLED'
                }),
                ipAddress: req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown"
            }, tx)
        })

        // 7. Return success response
        return NextResponse.json({
            message: "User reactivated successfully. User must log in again.",
            user: {
                id: user.id,
                email: user.email,
                fullName: user.fullName,
                status: "ACTIVE"
            }
        })

    } catch (error) {
        if (error instanceof Response) return error

        console.error("[USER_REACTIVATE_ERROR]", error)

        return NextResponse.json(
            { message: error instanceof Error ? error.message : "Internal Server Error" },
            { status: 500 }
        )
    }
}
