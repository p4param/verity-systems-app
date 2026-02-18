
import { prisma } from "@/lib/prisma";
import { AuthUser } from "@/lib/auth/auth-types";
import { FolderPermissionType } from "@prisma/client";

export class PermissionService {
    /**
     * Checks if a user has the required permission on a folder.
     * Logic:
     * 1. Check if any FolderPermission exists for the user's roles on this folder.
     * 2. If yes, check if the required permission is granted (or a higher one).
     * 3. If no FolderPermission exists, fallback to Global RBAC check if code provided.
     * 
     * Hierarchy: WRITE > REVIEW > READ
     */
    static async checkFolderAccess(
        user: AuthUser,
        folderId: string,
        requiredPermission: FolderPermissionType,
        globalPermissionCode?: string
    ): Promise<boolean> {
        // 1. Get User's Roles from AuthUser if available, or fetch
        // Assuming user.roles contains role names, but we need IDs for FolderPermission
        // We'll fetch role IDs from DB to be safe.
        const userRoles = await prisma.userRole.findMany({
            where: { userId: user.sub },
            select: { roleId: true }
        });

        const roleIds = userRoles.map(r => r.roleId);

        if (roleIds.length === 0) {
            // No roles assigned -> No Folder Permissions possible -> check global
            return PermissionService.checkGlobal(user, globalPermissionCode);
        }

        // 2. Check Folder Permissions
        const folderPermissions = await prisma.folderPermission.findMany({
            where: {
                folderId,
                roleId: { in: roleIds },
                tenantId: user.tenantId
            }
        });

        if (folderPermissions.length > 0) {
            // ACLs exist. Check if any grants access.
            const hasPermission = folderPermissions.some(fp => {
                if (fp.permission === requiredPermission) return true;

                // Hierarchy: WRITE implies REVIEW implies READ
                if (requiredPermission === "READ") {
                    return fp.permission === "WRITE" || fp.permission === "REVIEW";
                }
                if (requiredPermission === "REVIEW") {
                    return fp.permission === "WRITE";
                }
                return false;
            });

            return hasPermission;
        }

        // 3. Fallback to Global RBAC
        return PermissionService.checkGlobal(user, globalPermissionCode);
    }

    private static checkGlobal(user: AuthUser, permissionCode?: string): boolean {
        if (!permissionCode) return true;
        return user.permissions?.includes(permissionCode) || false;
    }

    /**
     * getEffectivePermissions
     * 
     * Calculates the effective permissions for a user on a specific document/folder.
     * Considers:
     * 1. Folder-specific ACLs (if folderId is provided and ACLs exist)
     * 2. Global RBAC permissions (fallback)
     */
    static async getEffectivePermissions(user: AuthUser, folderId: string | null): Promise<string[]> {
        // 1. If no folder, return global permissions
        if (!folderId) {
            return user.permissions || [];
        }

        // 2. Get User's Role IDs
        const userRoles = await prisma.userRole.findMany({
            where: { userId: user.sub },
            select: { roleId: true }
        });
        const roleIds = userRoles.map(r => r.roleId);

        if (roleIds.length === 0) {
            return user.permissions || [];
        }

        // 3. Check for Folder Permissions
        const folderPermissions = await prisma.folderPermission.findMany({
            where: {
                folderId,
                roleId: { in: roleIds },
                tenantId: user.tenantId
            }
        });

        // 4. If explicit permissions exist, use them.
        if (folderPermissions.length > 0) {
            // Determine highest permission level granted
            const levels = new Set(folderPermissions.map(fp => fp.permission));

            let effectiveParams: string[] = [];

            // Map Levels to Specific Permissions
            // WRITE grants everything
            if (levels.has("WRITE")) {
                effectiveParams = [
                    "DMS_DOCUMENT_CREATE",
                    "DMS_DOCUMENT_READ",
                    "DMS_DOCUMENT_EDIT",
                    "DMS_DOCUMENT_DELETE",
                    "DMS_DOCUMENT_SUBMIT",
                    "DMS_DOCUMENT_ARCHIVE",
                    "DMS_DOCUMENT_OBSOLETE",
                    "DMS_FOLDER_EDIT",
                    "DMS_DOCUMENT_APPROVE",
                    "DMS_DOCUMENT_REJECT",
                    "DMS_DOCUMENT_WITHDRAW"
                ];

            } else if (levels.has("REVIEW")) {
                effectiveParams = [
                    "DMS_DOCUMENT_READ",
                    "DMS_DOCUMENT_REVIEW",
                    "DMS_DOCUMENT_APPROVE",
                    "DMS_DOCUMENT_REJECT"
                ];
            } else if (levels.has("READ")) {
                effectiveParams = [
                    "DMS_DOCUMENT_READ"
                ];
            }

            return effectiveParams;
        }

        // 5. Fallback to Global Permissions
        return user.permissions || [];
    }
}
