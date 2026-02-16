import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/permission-guard";
import { handleApiError } from "@/lib/dms/api-error-handler";
import { AuditService } from "@/services/dms/audit-service";
import * as z from "zod";

/**
 * GET /api/secure/dms/audit
 * 
 * Fetches global DMS audit logs for the tenant.
 * Requires DMS_AUDIT_READ permission (mapped to ADMIN_ACCESS for V1).
 */
export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);

        // 1. Authenticate & Authorize
        // "Rule: requirePermission('DMS_AUDIT_READ')"
        // Since DMS_AUDIT_READ is not yet in DB, we map it to ADMIN_ACCESS for V1 safety.
        // This ensures only admins can see the global view.
        const user = await requirePermission(req, "ADMIN_ACCESS");

        // 2. Parse Query Params
        const page = parseInt(searchParams.get("page") || "1");
        const limit = parseInt(searchParams.get("limit") || "20");

        const filters = {
            startDate: searchParams.get("startDate") ? new Date(searchParams.get("startDate")!) : undefined,
            endDate: searchParams.get("endDate") ? new Date(searchParams.get("endDate")!) : undefined,
            action: searchParams.get("action") || undefined,
            userId: searchParams.get("userId") ? parseInt(searchParams.get("userId")!) : undefined,
            entityType: searchParams.get("entityType") || undefined,
        };

        const sortBy = searchParams.get("sortBy") as 'createdAt' | 'action' | 'entityType' | 'actorUserId' || 'createdAt';
        const sortOrder = searchParams.get("sortOrder") as 'asc' | 'desc' || 'desc';

        // 3. Service Call
        const auditLogs = await AuditService.getDmsAuditLogs({
            tenantId: user.tenantId,
            page,
            limit,
            filters,
            sortBy,
            sortOrder
        });

        return NextResponse.json(auditLogs);
    } catch (error: any) {
        return handleApiError(error);
    }
}
