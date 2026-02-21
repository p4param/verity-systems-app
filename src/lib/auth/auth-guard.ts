import { verifyJwt } from "./jwt"
import { NextResponse } from "next/server"
import { AuthUser } from "./auth-types"
export type { AuthUser } from "./auth-types"
import { prisma } from "@/lib/prisma"

/**
 * requireAuth
 *
 * POST-AUTH identity verification.
 * - Verifies JWT only (NO DB access)
 * - Establishes trusted tenant context
 *
 * IMPORTANT:
 * Any database access AFTER this point
 * MUST include tenantId explicitly.
 */
export async function requireAuth(req: Request): Promise<AuthUser> {
    const authHeader = req.headers.get("authorization")

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        console.warn(`[AUTH_GUARD] Unauthorized: Missing or invalid Authorization header for ${req.url}`)
        throw NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    const token = authHeader.replace("Bearer ", "").trim()

    let user: AuthUser
    try {
        const decoded = verifyJwt<AuthUser>(token)
        if (!decoded) {
            throw new Error("Invalid token")
        }
        user = decoded
    } catch {
        throw NextResponse.json(
            { message: "Invalid or expired token" },
            { status: 401 }
        )
    }

    // 🔒 Hard assertion: tenant context must exist post-auth
    if (!user.tenantId) {
        throw NextResponse.json(
            { message: "Tenant context missing" },
            { status: 401 }
        )
    }

    // ⚡ Session Validation (Instant Revocation)
    if (user.sid) {
        try {
            const session = await prisma.refreshToken.findUnique({
                where: { id: user.sid },
                select: { revokedAt: true }
            });

            if (!session || session.revokedAt) {
                // 🕒 RACE CONDITION GRACE PERIOD
                const GRACE_PERIOD_MS = 30 * 1000;
                const isWithinGrace = session?.revokedAt && (Date.now() - new Date(session.revokedAt).getTime() < GRACE_PERIOD_MS);

                if (!isWithinGrace) {
                    console.warn(`[AUTH_GUARD] Session ${user.sid} is ${!session ? 'NOT FOUND' : 'REVOKED'} for user ${user.sub}`)
                    throw NextResponse.json(
                        { message: "Session revoked or invalid" },
                        { status: 401 }
                    );
                }
            }
        } catch (err: any) {
            // Re-throw NextResponse (session revoked) errors as-is
            if (err instanceof NextResponse || (err && typeof err.status === 'number')) throw err
            // For DB connectivity errors (P1001), skip session check — JWT is still valid
            if (err?.code === 'P1001' || err?.message?.includes('Can\'t reach database')) {
                console.warn(`[AUTH_GUARD] DB unreachable during session check, skipping (P1001). User: ${user.sub}`)
            } else {
                // Unknown DB error — still allow request through (JWT is trusted)
                console.error(`[AUTH_GUARD] Unexpected error during session validation:`, err?.message)
            }
        }
    }

    return user
}

export async function requireRole(req: Request, role: string | number): Promise<AuthUser> {
    const user = await requireAuth(req)

    const hasRole = typeof role === 'number'
        ? user.roleIds?.includes(role)
        : user.roles.includes(role)

    if (!hasRole) {
        throw NextResponse.json({ message: "Forbidden" }, { status: 403 })
    }

    return user
}

export async function requirePermission(req: Request, permission: string): Promise<AuthUser> {
    const user = await requireAuth(req)

    if (!user.permissions || !user.permissions.includes(permission)) {
        throw NextResponse.json({ message: "Forbidden" }, { status: 403 })
    }

    return user
}

// import { verifyJwt } from "./jwt"
// import { NextResponse } from "next/server"

// export type AuthUser = {
//     sub: number        // userId
//     tenantId: number
//     email: string
//     roles: string[]
//     permissions?: string[]
// }

// export function requireAuth(req: Request): AuthUser {
//     const authHeader = req.headers.get("authorization")

//     if (!authHeader || !authHeader.startsWith("Bearer ")) {
//         throw NextResponse.json({ message: "Unauthorized" }, { status: 401 })
//     }

//     const token = authHeader.replace("Bearer ", "")

//     const user = verifyJwt<AuthUser>(token)

//     if (!user) {
//         throw NextResponse.json({ message: "Invalid or expired token" }, { status: 401 })
//     }

//     return user
// }

// export function requireRole(req: Request, role: string): AuthUser {
//     const user = requireAuth(req)

//     if (!user.roles?.includes(role)) {
//         throw NextResponse.json({ message: "Forbidden" }, { status: 403 })
//     }

//     return user
// }

// export function requirePermission(req: Request, permission: string): AuthUser {
//     const user = requireAuth(req)

//     if (!user.permissions || !user.permissions.includes(permission)) {
//         throw NextResponse.json({ message: "Forbidden" }, { status: 403 })
//     }

//     return user
// }
