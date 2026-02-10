import { requireAuth } from "./auth-guard"
import { getUserPermissions } from "./permission"

export async function requirePermission(
    req: Request,
    permission: string
) {
    const user = requireAuth(req)
    const permissions = await getUserPermissions(user.sub, user.tenantId)

    if (!permissions.includes(permission)) {
        throw new Response(
            JSON.stringify({ message: "Forbidden" }),
            { status: 403 }
        )
    }

    return user
}
