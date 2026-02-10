import { verifyJwt } from "./jwt"
import { NextResponse } from "next/server"

export type AuthUser = {
    sub: number        // userId
    tenantId: number
    email: string
    roles: string[]
    permissions?: string[]
    sid?: number
}

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
export function requireAuth(req: Request): AuthUser {
    const authHeader = req.headers.get("authorization")

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
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

    return user
}

export function requireRole(req: Request, role: string): AuthUser {
    const user = requireAuth(req)

    if (!user.roles?.includes(role)) {
        throw NextResponse.json({ message: "Forbidden" }, { status: 403 })
    }

    return user
}

export function requirePermission(req: Request, permission: string): AuthUser {
    const user = requireAuth(req)

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
