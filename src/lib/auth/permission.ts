import { prisma } from "@/lib/prisma"

export async function getUserPermissions(userId: number, tenantId: number) {
    const roles = await prisma.userRole.findMany({
        where: {
            userId,
            user: { tenantId: tenantId }  // Explicit tenant scoping
        },
        include: {
            role: {
                include: {
                    rolePermissions: {
                        include: { permission: true }
                    }
                }
            }
        }
    })

    return Array.from(
        new Set(
            roles.flatMap(r =>
                r.role.rolePermissions.map(
                    rp => rp.permission.code
                )
            )
        )
    )
}
