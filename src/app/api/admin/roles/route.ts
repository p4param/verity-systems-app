import { NextResponse } from "next/server"
// Force rebuild
import { requirePermission } from "@/lib/auth/permission-guard"
import { requireAuth } from "@/lib/auth/auth-guard"
import { prisma } from "@/lib/prisma"

export async function GET(req: Request) {
    try {
        const currentUser = await requirePermission(req, "ROLE_VIEW")

        const roles = await prisma.role.findMany({
            where: {
                tenantId: currentUser.tenantId
            },
            include: {
                rolePermissions: {
                    include: {
                        permission: true
                    }
                }
            }
        })

        const result = roles.map(role => ({
            id: role.id,
            name: role.name,
            isSystem: role.isSystem,
            permissions: role.rolePermissions.map(
                rp => rp.permission.code
            )
        }))

        // ✅ THIS IS CRITICAL
        return NextResponse.json(result)
    } catch (error) {
        // If the error is a Response (thrown by requireAuth/requirePermission), return it directly
        // Note: We need to check if it looks like a Response because "instanceof Response" might check the web standard Response class
        // and NextResponse extends it.
        if (error instanceof Response) {
            return error
        }

        // Also check for Next.js internal redirect error which implies a successful redirect
        // usually thrown by redirect()
        // But here we are just throwing Response for auth.

        return NextResponse.json(
            { message: error instanceof Error ? error.message : "Internal Server Error" },
            { status: 500 }
        )
    }
}

export async function POST(req: Request) {
    try {
        // We need the user to set tenantId
        const user = requireAuth(req)
        await requirePermission(req, "ROLE_CREATE")

        const { name, permissionIds } = await req.json()

        if (!name || !Array.isArray(permissionIds)) {
            return NextResponse.json(
                { message: "Invalid payload" },
                { status: 400 }
            )
        }

        const existingRole = await prisma.role.findFirst({
            where: {
                tenantId: user.tenantId,
                name: name
            }
        })

        if (existingRole) {
            return NextResponse.json(
                { message: "Role with this name already exists" },
                { status: 409 }
            )
        }

        const role = await prisma.role.create({
            data: {
                tenantId: user.tenantId,
                name: name,
                rolePermissions: {
                    createMany: {
                        data: permissionIds.map((id: number) => ({
                            permissionId: id
                        }))
                    }
                }
            }
        })

        return NextResponse.json(role)
    } catch (error) {
        if (error instanceof Response) return error
        return NextResponse.json(
            { message: error instanceof Error ? error.message : "Internal Server Error" },
            { status: 500 }
        )
    }
}
