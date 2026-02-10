import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/auth/auth-guard"
import { requirePermission } from "@/lib/auth/permission-guard"
import { NextResponse } from "next/server"

// ... imports

export async function GET(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        await requirePermission(req, "ROLE_VIEW")

        const { id } = await params
        const role = await prisma.role.findUnique({
            where: { id: Number(id) },
            include: {
                rolePermissions: {
                    include: { permission: true }
                }
            }
        })

        if (!role) {
            return NextResponse.json({ message: "Role not found" }, { status: 404 })
        }

        return NextResponse.json({
            id: role.id,
            name: role.name,
            permissions: role.rolePermissions.map(rp => rp.permission.code)
        })

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
        requireAuth(req)
        await requirePermission(req, "ROLE_CREATE") // Re-use create permission or update if distinct

        const { name, permissionIds } = await req.json()

        if (!name || !Array.isArray(permissionIds)) {
            return NextResponse.json(
                { message: "Invalid payload" },
                { status: 400 }
            )
        }

        const { id: paramsId } = await params
        const id = Number(paramsId)

        // Transaction to update role and permissions
        const updatedRole = await prisma.$transaction(async (tx) => {
            // 1. Update name
            await tx.role.update({
                where: { id },
                data: { name }
            })

            // 2. Delete existing permissions
            await tx.rolePermission.deleteMany({
                where: { roleId: id }
            })

            // 3. Add new permissions
            await tx.rolePermission.createMany({
                data: permissionIds.map((pid: number) => ({
                    roleId: id,
                    permissionId: pid
                }))
            })

            return tx.role.findUnique({ where: { id } })
        })

        return NextResponse.json(updatedRole)

    } catch (error) {
        if (error instanceof Response) return error
        return NextResponse.json(
            { message: error instanceof Error ? error.message : "Internal Server Error" },
            { status: 500 }
        )
    }
}

export async function DELETE(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        await requirePermission(req, "ROLE_DELETE")

        const { id } = await params
        const role = await prisma.role.findUnique({
            where: { id: Number(id) }
        })

        if (!role) {
            return NextResponse.json({ message: "Role not found" }, { status: 404 })
        }

        // @ts-ignore
        if (role.isSystem) {
            return NextResponse.json(
                { message: "System roles cannot be deleted" },
                { status: 403 }
            )
        }

        await prisma.role.delete({
            where: { id: role.id }
        })

        return NextResponse.json({ message: "Role deleted" })
    } catch (error) {
        if (error instanceof Response) return error
        return NextResponse.json(
            { message: error instanceof Error ? error.message : "Internal Server Error" },
            { status: 500 }
        )
    }
}
