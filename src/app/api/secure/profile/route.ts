import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth/auth-guard"
import { prisma } from "@/lib/prisma"
import { getUserPermissions } from "@/lib/auth/permission"

export async function GET(req: Request) {
  try {
    const payload = await requireAuth(req)

    const user = await prisma.user.findUnique({
      where: { id: payload.sub, tenantId: payload.tenantId },
      include: {
        userRoles: {
          include: { role: true }
        }
      }
    })

    if (!user) {
      return NextResponse.json({ message: "User not found" }, { status: 404 })
    }

    const roles = user.userRoles.map((ur) => ur.role.name)
    const roleIds = user.userRoles.map((ur) => ur.role.id)
    const { ids: permissionIds, codes: permissions } = await getUserPermissions(user.id, user.tenantId)

    return NextResponse.json({
      message: "You are authenticated",
      user: {
        id: user.id,
        sub: user.id,
        fullName: user.fullName,
        email: user.email,
        roles,
        roleIds,
        permissions,
        permissionIds,
        mfaEnabled: user.mfaEnabled
      }
    })
  } catch (error) {
    return NextResponse.json(
      { message: "Unauthorized" },
      { status: 401 }
    )
  }
}
