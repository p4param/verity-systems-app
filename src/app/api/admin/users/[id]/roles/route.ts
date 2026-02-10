import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requirePermission } from "@/lib/auth/permission-guard"
import { requireAuth } from "@/lib/auth/auth-guard"

export async function GET(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const user = requireAuth(req)
        await requirePermission(req, "ROLE_VIEW")

        const { id } = await params
        const userId = Number(id)

        if (isNaN(userId)) {
            return NextResponse.json(
                { message: "Invalid User ID" },
                { status: 400 }
            )
        }

        // Verify target user exists in admin's tenant
        const targetUser = await prisma.user.findFirst({
            where: {
                id: userId,
                tenantId: user.tenantId
            }
        })

        if (!targetUser) {
            return NextResponse.json(
                { message: "User not found in your tenant" },
                { status: 404 }
            )
        }

        const userRoles = await prisma.userRole.findMany({
            where: {
                userId,
                user: { tenantId: user.tenantId }  // Explicit tenant scoping
            },
            include: { role: true }
        })

        return NextResponse.json(userRoles.map(ur => ({
            id: ur.role.id,
            name: ur.role.name
        })))

    } catch (error) {
        if (error instanceof Response) return error
        return NextResponse.json(
            { message: error instanceof Error ? error.message : "Internal Server Error" },
            { status: 500 }
        )
    }
}

export async function PUT(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const admin = requireAuth(req)
        await requirePermission(req, "ROLE_ASSIGN")

        const { id } = await params
        const userId = Number(id)

        if (isNaN(userId)) {
            return NextResponse.json(
                { message: "Invalid User ID" },
                { status: 400 }
            )
        }

        // Verify target user exists in admin's tenant
        const targetUser = await prisma.user.findFirst({
            where: {
                id: userId,
                tenantId: admin.tenantId
            }
        })

        if (!targetUser) {
            return NextResponse.json(
                { message: "User not found in your tenant" },
                { status: 404 }
            )
        }

        const { roleIds } = await req.json()

        if (!Array.isArray(roleIds)) {
            return NextResponse.json(
                { message: "Invalid payload: roleIds must be an array" },
                { status: 400 }
            )
        }

        // Prevent self-lockout
        if (admin.sub === userId) {
            return NextResponse.json(
                { message: "Cannot modify your own roles" },
                { status: 400 }
            )
        }

        await prisma.$transaction([
            prisma.userRole.deleteMany({
                where: {
                    userId,
                    user: { tenantId: admin.tenantId }  // Explicit tenant scoping
                }
            }),
            prisma.userRole.createMany({
                data: roleIds.map((rid: number) => ({
                    userId,
                    roleId: rid
                }))
            })
        ])

        return NextResponse.json({ message: "Roles updated" })
    } catch (error) {
        if (error instanceof Response) return error
        return NextResponse.json(
            { message: error instanceof Error ? error.message : "Internal Server Error" },
            { status: 500 }
        )
    }
}
