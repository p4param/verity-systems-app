import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requirePermission } from "@/lib/auth/permission-guard"

export async function GET(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    console.log('[USER_DETAIL_API] Starting GET request')
    try {
        console.log('[USER_DETAIL_API] Checking permissions')
        const currentUser = await requirePermission(req, "USER_VIEW")
        const { id } = await params
        const userId = parseInt(id)

        if (isNaN(userId)) {
            return NextResponse.json(
                { error: "Invalid user ID" },
                { status: 400 }
            )
        }

        console.log('[USER_DETAIL_API] Querying user:', userId, 'for tenant:', currentUser.tenantId)


        const user = await prisma.user.findFirst({
            where: {
                id: userId,
                tenantId: currentUser.tenantId
            },
            select: {
                id: true,
                email: true,
                fullName: true,
                isActive: true,
                mfaEnabled: true,
                lastLoginAt: true,
                createdAt: true,
                passwordHash: true, // Needed for deriving status
                userRoles: {
                    include: { role: true }
                }
            }
        })

        console.log('[USER_DETAIL_API] User found:', user ? 'YES' : 'NO')

        if (!user) {
            return NextResponse.json(
                { error: "User not found" },
                { status: 404 }
            )
        }

        // Map response to match expected UI shape and derived status
        const mappedUser = {
            id: user.id,
            email: user.email,
            fullName: user.fullName,
            isActive: user.isActive,
            mfaEnabled: user.mfaEnabled,
            lastLoginAt: user.lastLoginAt,
            createdAt: user.createdAt,
            status: !user.passwordHash ? "PENDING" : (user.isActive ? "ACTIVE" : "DISABLED"),
            userRoles: user.userRoles
        }

        return NextResponse.json(mappedUser)
    } catch (error) {
        console.error("Error fetching user:", error)
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Failed to fetch user" },
            { status: error instanceof Error && error.message.includes("UNAUTHORIZED") ? 401 : 500 }
        )
    }
}
