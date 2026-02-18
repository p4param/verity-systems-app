import { prisma } from "./prisma";
import { AlertService } from "./security/alert-service";

interface AuditLogParams {
    tenantId: number;
    actorUserId?: number;
    targetUserId?: number;
    entityType?: string;
    entityId?: string;
    action: string;
    details?: string;
    module?: string;
    metadata?: Record<string, any>;
    ipAddress?: string;
}

/**
 * Creates an audit log entry.
 * Can be used within a transaction or standalone.
 * If 'tx' is provided, it uses that transaction.
 */
export async function createAuditLog(
    params: AuditLogParams,
    tx?: any
) {
    const db = tx || prisma;
    try {
        const log = await db.auditLog.create({
            data: {
                tenantId: params.tenantId,
                actorUserId: params.actorUserId,
                targetUserId: params.targetUserId,
                entityType: params.entityType,
                entityId: params.entityId,
                action: params.action,
                module: params.module,
                details: params.details,
                metadata: params.metadata || undefined,
                ipAddress: params.ipAddress,
            }
        });

        // Trigger Security Alert Engine (Fire-and-forget)
        // We do NOT await this to prevent blocking the main transaction.
        AlertService.evaluateEvent(log).catch(alertErr => {
            console.error("[ALERT_ENGINE_ERROR]", alertErr);
        });

        return log;
    } catch (error) {
        // Fallback: Log to console if audit fails to write to DB
        // This prevents the main transaction from failing just because logging failed,
        // unless it's critical. However, usually audit is critical.
        // For strictly critical audit, we should let it throw.
        console.error("[AUDIT_LOG_ERROR]", error, params);
        // Rethrow if strict audit is required.
        throw error;
    }
}

