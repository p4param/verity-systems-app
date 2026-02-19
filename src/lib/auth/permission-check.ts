
import { AuthUser } from "./auth-types";
import { getUserPermissions } from "./permission";

/**
 * Checks if a user has a specific permission.
 * 
 * @param params Object containing user and permission to check
 * @returns boolean
 */
export async function hasPermission(params: {
    user: AuthUser;
    permission: number | string;
    context?: any;
}): Promise<boolean> {
    const { user, permission } = params;

    // Admin override (if applicable in your system, usually admins have all permissions or specific role)
    // For now, checking explicit permission.

    const { ids, codes } = await getUserPermissions(user.sub, user.tenantId);

    if (typeof permission === 'number') {
        return ids.includes(permission);
    }
    return codes.includes(permission);
}
