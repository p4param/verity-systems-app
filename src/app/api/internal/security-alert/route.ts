import { NextResponse } from "next/server"
import { createAuditLog } from "@/lib/audit"

/**
 * Internal API to create security alerts and audit logs.
 * This is called by the Middleware when unauthorized access is detected.
 */
export async function POST(req: Request) {
    try {
        // Simple internal check - only allow if a specific internal header is present
        // In a real production app, this would be a shared secret.
        const internalSecret = req.headers.get("x-internal-secret")
        if (internalSecret !== process.env.INTERNAL_API_SECRET) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 })
        }

        const body = await req.json()
        const { userId, tenantId, action, details, ipAddress } = body

        if (!userId || !tenantId || !action) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
        }

        await createAuditLog({
            tenantId,
            actorUserId: userId,
            action,
            details,
            ipAddress
        })

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error("[INTERNAL_SECURITY_ALERT_ERROR]", error)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}
