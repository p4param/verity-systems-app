
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { computeComplianceSnapshot } from "@/lib/compliance/computeComplianceSnapshot";
import { createAuditLog } from "@/lib/audit";

export async function POST(req: Request) {
    try {
        // 1. Security Check (Internal Secret)
        const authHeader = req.headers.get("x-internal-secret");
        const secret = process.env.INTERNAL_JOB_SECRET || "dev-internal-secret";

        if (authHeader !== secret) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // 2. Iterate All Active Tenants
        const tenants = await prisma.tenant.findMany({
            where: { isActive: true },
            select: { id: true, name: true }
        });

        const results = [];
        for (const tenant of tenants) {
            try {
                const snapshot = await computeComplianceSnapshot(tenant.id);

                await createAuditLog({
                    tenantId: tenant.id,
                    entityType: "SYSTEM",
                    entityId: "COMPLIANCE_JOB",
                    action: "SYSTEM.COMPLIANCE_SNAPSHOT_COMPUTED",
                    details: `Nightly compliance snapshot computed for tenant '${tenant.name}'`,
                    metadata: { snapshotId: snapshot.id }
                });

                results.push({ tenantId: tenant.id, status: "success", score: snapshot.complianceScore });
            } catch (err: any) {
                console.error(`Failed to compute compliance for tenant ${tenant.id}:`, err);
                results.push({ tenantId: tenant.id, status: "error", error: err.message });
            }
        }

        return NextResponse.json({
            success: true,
            job: "compliance-nightly",
            executionTime: new Date().toISOString(),
            tenantsProcessed: results
        });

    } catch (error: any) {
        console.error("Critical error in compliance-nightly job:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
