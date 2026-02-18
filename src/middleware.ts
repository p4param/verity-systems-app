import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { PRIVILEGED_AREAS } from "./lib/security/privileged-areas"

// --- Rate Limiting State ---
// Simple in-memory store for rate limiting (Note: In serverless/edge, this memory is not shared)
// For production, use Redis/Upstash.
const rateLimit = new Map<string, { count: number; expires: number }>();
const WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS = 20; // 20 requests per minute per IP

/**
 * Simple JWT decoder for Middleware (Safe for Edge Runtime)
 */
function parseJwt(token: string) {
    try {
        const base64Url = token.split(".")[1]
        const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/")
        const jsonPayload = decodeURIComponent(
            atob(base64)
                .split("")
                .map(function (c) {
                    return "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2)
                })
                .join("")
        )
        return JSON.parse(jsonPayload)
    } catch (e) {
        return null
    }
}

export async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl

    // -------------------------------------------------------------------------
    // 1. Rate Limiting (Public Routes)
    // -------------------------------------------------------------------------
    if (pathname.startsWith('/api/public')) {
        const ip = (request as any).ip || request.headers.get("x-forwarded-for") || 'anonymous';
        const now = Date.now();

        const record = rateLimit.get(ip);

        if (record && now < record.expires) {
            if (record.count >= MAX_REQUESTS) {
                return new NextResponse(
                    JSON.stringify({ message: "Too many requests. Please try again later." }),
                    { status: 429, headers: { 'Content-Type': 'application/json' } }
                );
            }
            record.count++;
        } else {
            rateLimit.set(ip, { count: 1, expires: now + WINDOW_MS });
        }

        // Cleanup old records occasionally
        if (rateLimit.size > 1000) {
            for (const [key, val] of rateLimit.entries()) {
                if (now > val.expires) rateLimit.delete(key);
            }
        }
    }

    // -------------------------------------------------------------------------
    // 2. Privileged Area Security Standard (PASS)
    // -------------------------------------------------------------------------
    const matchingAreaKey = Object.keys(PRIVILEGED_AREAS).find(key =>
        pathname.startsWith(PRIVILEGED_AREAS[key].path)
    )

    if (matchingAreaKey) {
        const area = PRIVILEGED_AREAS[matchingAreaKey]
        let accessToken = request.cookies.get("accessToken")?.value

        // Also check Authorization header (for API clients)
        if (!accessToken) {
            const authHeader = request.headers.get("authorization")
            if (authHeader?.startsWith("Bearer ")) {
                accessToken = authHeader.substring(7)
            }
        }

        // Authenticate
        if (!accessToken) {
            if (pathname.startsWith('/api/')) {
                return NextResponse.json({ message: "Authentication required" }, { status: 401 })
            }
            return NextResponse.redirect(new URL("/login", request.url))
        }

        const payload = parseJwt(accessToken)
        if (!payload) {
            if (pathname.startsWith('/api/')) {
                return NextResponse.json({ message: "Invalid token" }, { status: 401 })
            }
            return NextResponse.redirect(new URL("/login", request.url))
        }

        // Session Validation (Instant Revocation)
        if (payload.sid) {
            try {
                const origin = request.nextUrl.origin
                const validationRes = await fetch(`${origin}/api/internal/validate-session`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "x-internal-secret": process.env.INTERNAL_API_SECRET || ""
                    },
                    body: JSON.stringify({ sid: payload.sid })
                })

                if (validationRes.ok) {
                    const validation = await validationRes.json()
                    if (!validation.valid) {
                        if (pathname.startsWith('/api/')) {
                            const response = NextResponse.json({ message: `Session invalid: ${validation.reason}` }, { status: 401 })
                            response.cookies.delete("accessToken")
                            response.cookies.delete("refreshToken")
                            return response
                        }
                        const response = NextResponse.redirect(new URL("/login", request.url))
                        response.cookies.delete("accessToken")
                        response.cookies.delete("refreshToken")
                        return response
                    }
                }
            } catch (err) {
                console.error("Session validation fetch error:", err)
            }
        }

        // Authorize
        let isAuthorized = false

        // Role-based check
        if (area.requiredRoles) {
            isAuthorized = area.requiredRoles.some(role => {
                if (typeof role === 'number') {
                    return payload.roleIds?.includes(role)
                }
                return payload.roles?.includes(role)
            })
        }

        // Permission-based check
        if (!isAuthorized && area.requiredPermissions) {
            isAuthorized = area.requiredPermissions.some(perm => {
                if (typeof perm === 'number') {
                    return payload.permissionIds?.includes(perm) || payload.permissionIds?.includes(String(perm))
                }
                return payload.permissions?.includes(perm) || (payload.permissionIds && payload.permissionIds.includes(parseInt(perm)))
            })
        }

        // Handle Unauthorized
        if (!isAuthorized) {
            try {
                const origin = request.nextUrl.origin
                fetch(`${origin}/api/internal/security-alert`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "x-internal-secret": process.env.INTERNAL_API_SECRET || ""
                    },
                    body: JSON.stringify({
                        userId: payload.sub || 0,
                        tenantId: payload.tenantId || 0,
                        action: "UNAUTHORIZED_ACCESS_ATTEMPT",
                        details: JSON.stringify({
                            path: pathname,
                            alertCode: area.alertCode
                        }),
                        ipAddress: request.headers.get("x-forwarded-for") || "unknown"
                    })
                }).catch(err => console.error("Middleware alert fetch error:", err))
            } catch (err) {
                console.error("Failed to trigger security alert from middleware:", err)
            }

            if (pathname.startsWith('/api/')) {
                return NextResponse.json({ message: "Forbidden: Admin access required" }, { status: 403 })
            }
            return NextResponse.redirect(new URL("/dashboard", request.url))
        }
    }

    return NextResponse.next()
}

export const config = {
    matcher: [
        "/admin", "/admin/:path*",
        "/billing/:path*",
        "/compliance/:path*",
        "/exports/:path*",
        "/api/admin/:path*",
        "/api/public/:path*"
    ]
}
