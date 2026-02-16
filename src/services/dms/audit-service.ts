import { prisma } from "@/lib/prisma";
import { AuthUser } from "@/lib/auth/auth-types";
import { formatAuditMetadata } from "@/lib/dms/audit-formatter";

interface GetDocumentAuditLogsParams {
    tenantId: number;
    documentId: string;
    page?: number;
    limit?: number;
    user: AuthUser; // For permission verification context if needed later
}

export class AuditService {
    /**
     * getDocumentAuditLogs
     * 
     * Fetches audit logs specifically for a document.
     * Enforces tenant isolation.
     * Uses the new entityType/entityId fields for optimized lookup.
     */
    static async getDocumentAuditLogs({
        tenantId,
        documentId,
        page = 1,
        limit = 20,
        user
    }: GetDocumentAuditLogsParams) {
        const skip = (page - 1) * limit;

        // Fetch Total Count
        const total = await prisma.auditLog.count({
            where: {
                tenantId,
                entityType: "DOCUMENT",
                entityId: documentId
            }
        });

        // Fetch Logs
        const logs = await prisma.auditLog.findMany({
            where: {
                tenantId,
                entityType: "DOCUMENT",
                entityId: documentId
            },
            include: {
                actor: {
                    select: {
                        id: true,
                        fullName: true,
                        email: true
                    }
                }
            },
            orderBy: {
                createdAt: 'desc'
            },
            skip,
            take: limit
        });

        return {
            items: logs.map(log => ({
                id: log.id,
                action: log.action,
                details: log.details,
                // STRICT: Sanitize metadata using allow-list
                metadata: formatAuditMetadata(log.action, log.metadata),
                actorName: log.actor?.fullName || "System/Unknown",
                actorEmail: log.actor?.email,
                createdAt: log.createdAt,
                ipAddress: log.ipAddress
            })),
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit)
        };
    }

    /**
     * cleanupOldLogs
     * 
     * Deletes audit logs older than the specified retention period.
     * Enforces tenant isolation.
     * 
     * @param tenantId The tenant to cleanup.
     * @param retentionMonths Number of months to retain (default: 24).
     * @returns Summary of deleted logs.
     */
    static async cleanupOldLogs({
        tenantId,
        retentionMonths = 24
    }: {
        tenantId: number;
        retentionMonths?: number;
    }) {
        // Calculate the cutoff date
        const olderThan = new Date();
        olderThan.setMonth(olderThan.getMonth() - retentionMonths);

        // Safety Check: Prevent accidental deletion of recent logs
        if (retentionMonths < 1) {
            throw new Error("Minimum retention period is 1 month.");
        }

        // 1. Count logs to be deleted (for reporting)
        const count = await prisma.auditLog.count({
            where: {
                tenantId,
                createdAt: {
                    lt: olderThan
                }
            }
        });

        if (count === 0) {
            return {
                deletedCount: 0,
                retentionMonths,
                olderThan,
                message: "No logs found exceeding retention period."
            };
        }

        // 2. Perform Deletion
        // FUTURE: Move this to a background job (BullMQ/Cron) for large datasets.
        // For V1, direct deletion is acceptable but should be monitored.
        const result = await prisma.auditLog.deleteMany({
            where: {
                tenantId,
                createdAt: {
                    lt: olderThan
                }
            }
        });

        return {
            deletedCount: result.count,
            retentionMonths,
            olderThan,
            message: `Successfully deleted ${result.count} audit logs older than ${retentionMonths} months.`
        };
    }

    /**
     * getDmsAuditLogs
     * 
     * Fetches global DMS audit logs for the tenant.
     * Supports filtering by date, action, user, and entity type.
     */
    static async getDmsAuditLogs({
        tenantId,
        page = 1,
        limit = 20,
        filters,
        sortBy = 'createdAt',
        sortOrder = 'desc'
    }: {
        tenantId: number;
        page?: number;
        limit?: number;
        filters?: {
            startDate?: Date;
            endDate?: Date;
            action?: string;
            userId?: number;
            entityType?: string;
        };
        sortBy?: 'createdAt' | 'action' | 'entityType' | 'actorUserId';
        sortOrder?: 'asc' | 'desc';
    }) {
        const skip = (page - 1) * limit;
        const where: any = {
            tenantId,
            // Filter strictly for DMS module or DMS entity types if module not populated yet
            OR: [
                { module: "DMS" },
                { entityType: { in: ["DOCUMENT", "FOLDER", "VERSION", "WORKFLOW"] } }
            ]
        };

        if (filters?.startDate) {
            where.createdAt = { ...where.createdAt, gte: filters.startDate };
        }
        if (filters?.endDate) {
            // Set end date to end of day (23:59:59.999) to include all events on that day
            const endOfDay = new Date(filters.endDate);
            endOfDay.setHours(23, 59, 59, 999);
            where.createdAt = { ...where.createdAt, lte: endOfDay };
        }
        if (filters?.action) {
            where.action = filters.action;
        }
        if (filters?.userId) {
            where.actorUserId = filters.userId;
        }
        if (filters?.entityType) {
            where.entityType = filters.entityType;
        }

        const [total, logs] = await Promise.all([
            prisma.auditLog.count({ where }),
            prisma.auditLog.findMany({
                where,
                include: {
                    actor: {
                        select: { fullName: true, email: true }
                    }
                },
                orderBy: { [sortBy]: sortOrder },
                skip,
                take: limit
            })
        ]);

        return {
            items: logs.map(log => {
                // Resolve Entity Name: Metadata -> Details (Regex) -> ID
                let entityName = (log.metadata as any)?.title || (log.metadata as any)?.name;
                if (!entityName && log.details) {
                    const match = log.details.match(/'([^']+)'/);
                    if (match) entityName = match[1];
                }

                return {
                    id: log.id,
                    action: log.action,
                    entityType: log.entityType,
                    entityId: log.entityId,
                    entityName: entityName || log.entityId,
                    details: log.details,
                    metadata: formatAuditMetadata(log.action, log.metadata),
                    actorName: log.actor?.fullName || "System",
                    actorEmail: log.actor?.email,
                    createdAt: log.createdAt,
                    ipAddress: log.ipAddress
                };
            }),
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit)
        };
    }
}
