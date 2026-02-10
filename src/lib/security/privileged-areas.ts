export interface PrivilegedArea {
    path: string;
    requiredRoles?: string[];
    requiredPermissions?: string[];
    alertCode: string;
}

export const PRIVILEGED_AREAS: Record<string, PrivilegedArea> = {
    ADMIN: {
        path: '/admin',
        requiredRoles: ['Admin'],
        alertCode: 'UNAUTHORIZED_ADMIN_ACCESS_ATTEMPT',
    },
    BILLING: {
        path: '/billing',
        requiredPermissions: ['billing:read'],
        alertCode: 'UNAUTHORIZED_BILLING_ACCESS_ATTEMPT',
    },
    COMPLIANCE: {
        path: '/compliance',
        requiredPermissions: ['compliance:read'],
        alertCode: 'UNAUTHORIZED_COMPLIANCE_ACCESS_ATTEMPT',
    },
    EXPORTS: {
        path: '/exports',
        requiredPermissions: ['data:export'],
        alertCode: 'UNAUTHORIZED_EXPORT_ACCESS_ATTEMPT',
    },
};
