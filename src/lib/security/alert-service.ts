import { prisma } from "@/lib/prisma";
import { AuditLog } from "@prisma/client";

export type AlertEventType =
    | "AUTH_LOGIN_NEW_DEVICE"
    | "AUTH_LOGIN_NEW_LOCATION"
    | "MFA_DISABLED"
    | "MFA_SETUP_COMPLETED"
    | "MFA_RESET_ADMIN"
    | "PWD_CHANGED_SUCCESS"
    | "PWD_RESET_INITIATED"
    | "SESSION_REVOKED_MANUAL"
    | "SESSION_REVOKED_GLOBAL"
    | "UNAUTHORIZED_ADMIN_ACCESS_ATTEMPT"
    | "UNAUTHORIZED_BILLING_ACCESS_ATTEMPT"
    | "UNAUTHORIZED_COMPLIANCE_ACCESS_ATTEMPT"
    | "UNAUTHORIZED_EXPORT_ACCESS_ATTEMPT";

export type AlertSeverity = "CRITICAL" | "HIGH" | "INFO" | "NOTICE";

interface AlertPayload {
    type: AlertEventType;
    severity: AlertSeverity;
    title: string;
    message: string;
    metadata?: any;
}

export class AlertService {
    /**
     * Main entry point to evaluate an audit log for potential security alerts.
     * This should be called immediately after an audit log is created.
     */
    static async evaluateEvent(log: AuditLog) {
        try {
            // We need a userId to alert. If no target or actor, we can't alert a user.
            const userId = log.targetUserId || log.actorUserId;
            if (!userId) return;

            // Fetch user context (Email needed for tenant-safe update)
            const user = await prisma.user.findFirst({
                where: {
                    id: userId,
                    tenantId: log.tenantId
                },
                select: { email: true }
            });

            if (!user) return; // Should not happen if integrity is maintained

            let alert: AlertPayload | null = null;

            switch (log.action) {
                case "LOGIN_SUCCESS":
                    alert = await this.checkLoginAnomaly(log, userId);
                    break;
                case "MFA_ENABLED":
                    alert = {
                        type: "MFA_SETUP_COMPLETED",
                        severity: "INFO",
                        title: "MFA Enabled",
                        message: "Multi-Factor Authentication was successfully enabled on your account."
                    };
                    break;
                case "MFA_DISABLED":
                    alert = {
                        type: "MFA_DISABLED",
                        severity: "CRITICAL",
                        title: "MFA Disabled",
                        message: "Multi-Factor Authentication was disabled. If this wasn't you, secure your account immediately."
                    };
                    break;
                case "PASSWORD_CHANGED":
                    alert = {
                        type: "PWD_CHANGED_SUCCESS",
                        severity: "NOTICE",
                        title: "Password Changed",
                        message: "Your password was successfully updated."
                    };
                    break;
                case "SESSION_REVOKED":
                    const isSelf = log.actorUserId === log.targetUserId;
                    alert = {
                        type: "SESSION_REVOKED_MANUAL",
                        severity: isSelf ? "INFO" : "NOTICE",
                        title: "Session Revoked",
                        message: isSelf
                            ? "A session was manually revoked."
                            : "An administrator revoked one of your active sessions."
                    };
                    break;
                case "ALL_SESSIONS_REVOKED":
                    alert = {
                        type: "SESSION_REVOKED_GLOBAL",
                        severity: "NOTICE",
                        title: "Logged Out Everywhere",
                        message: "You have been logged out of all devices."
                    };
                    break;
                case "UNAUTHORIZED_ADMIN_ACCESS":
                    alert = {
                        type: "UNAUTHORIZED_ADMIN_ACCESS_ATTEMPT",
                        severity: "HIGH",
                        title: "Unauthorized Admin Access Attempt",
                        message: "A non-admin user attempted to access a protected administrative route.",
                        metadata: { resource: log.details }
                    };
                    break;
                case "UNAUTHORIZED_ACCESS_ATTEMPT":
                    try {
                        const info = JSON.parse(log.details || "{}");
                        const domain = info.alertCode?.split('_')[1] || "Domain";
                        const severity = info.alertCode?.includes('EXPORT') ? 'CRITICAL' : 'HIGH';

                        alert = {
                            type: info.alertCode as AlertEventType,
                            severity: severity as AlertSeverity,
                            title: `Unauthorized ${domain} Access Attempt`,
                            message: `A user attempted to access a protected area (${info.path}) without sufficient permissions.`,
                            metadata: info
                        };
                    } catch {
                        // Fallback for non-JSON details
                    }
                    break;
            }

            if (alert) {
                await this.createAlert(log.tenantId, user.email, userId, alert, log);
            }

        } catch (error) {
            console.error("Failed to evaluate security alert:", error);
        }
    }

    private static async checkLoginAnomaly(log: AuditLog, userId: number): Promise<AlertPayload | null> {
        // Tenant-Safe Query
        const previousLoginFromIp = await prisma.auditLog.findFirst({
            where: {
                tenantId: log.tenantId, // Required for tenant isolation
                actorUserId: userId,
                action: "LOGIN_SUCCESS",
                ipAddress: log.ipAddress,
                id: { not: log.id }
            }
        });

        if (!previousLoginFromIp) {
            return {
                type: "AUTH_LOGIN_NEW_LOCATION",
                severity: "NOTICE",
                title: "New Login Detected",
                message: `We detected a successful login from a new IP address (${log.ipAddress}).`,
                metadata: { ip: log.ipAddress }
            };
        }

        return null;
    }

    private static async createAlert(tenantId: number, userEmail: string, userId: number, payload: AlertPayload, sourceLog: AuditLog) {
        const metadata = {
            ...payload.metadata,
            sourceLogId: sourceLog.id,
            actorId: sourceLog.actorUserId,
            ip: sourceLog.ipAddress
        };

        const metadataString = JSON.stringify(metadata);

        // Nested Write via User (Tenant-Safe)
        await prisma.user.update({
            where: {
                tenantId_email: {
                    tenantId: tenantId,
                    email: userEmail
                }
            },
            data: {
                securityAlerts: {
                    create: {
                        type: payload.type,
                        severity: payload.severity,
                        title: payload.title,
                        message: payload.message,
                        metadata: metadataString,
                        isRead: false
                    }
                }
            }
        });
    }
}
