import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcrypt"
import { signJwt } from "@/lib/auth/jwt"
import { generateRefreshToken } from "@/lib/auth/refresh-token"
import { getUserPermissions } from "@/lib/auth/permission"
import { createAuditLog } from "@/lib/audit"

const ACCESS_TOKEN_EXP = "15m"
const REFRESH_TOKEN_DAYS = 7

export async function POST(req: Request) {
    try {
        const { email, password } = await req.json()

        if (!email || !password) {
            return NextResponse.json(
                { error: "Email and password are required" },
                { status: 400 }
            )
        }

        // 1️⃣ Fetch user with roles (Resolution Strategy: Implicit with Integrity Check)
        const users = await prisma.user.findMany({
            where: { email },
            include: {
                userRoles: {
                    include: {
                        role: true
                    }
                }
            }
        })

        if (users.length === 0) {
            return NextResponse.json({ error: "Invalid credentials" }, { status: 401 })
        }

        if (users.length > 1) {
            console.warn(`[AUTH_WARNING] Duplicate users found for email ${email}. Using first result.`)
            // We do not block login here to allow users to access at least one of their accounts.
        }

        // Proceed with the single resolved user
        const user = users[0]

        if (!user || !user.passwordHash) {
            // User exists but has no password (e.g. OAuth only)? Treat as invalid credentials.
            return NextResponse.json({ error: "Invalid credentials" }, { status: 401 })
        }

        const ipAddress = req.headers.get("x-forwarded-for") || "unknown"

        if (!user.isActive) {
            await createAuditLog({
                tenantId: user.tenantId,
                actorUserId: user.id,
                action: "USER.LOGIN_FAILED",
                details: "Login blocked: Account is inactive",
                ipAddress
            })
            return NextResponse.json({ error: "Account is inactive" }, { status: 401 })
        }

        if (user.isLocked) {
            await createAuditLog({
                tenantId: user.tenantId,
                actorUserId: user.id,
                action: "USER.LOGIN_FAILED",
                details: "Login blocked: Account is locked",
                ipAddress
            })
            return NextResponse.json({ error: "Account is locked" }, { status: 401 })
        }

        // Check user status (only ACTIVE users can log in)
        if (user.status !== "ACTIVE") {
            await createAuditLog({
                tenantId: user.tenantId,
                actorUserId: user.id,
                action: "USER.LOGIN_FAILED",
                details: `Login blocked: Account status is ${user.status}`,
                ipAddress
            })
            return NextResponse.json({ error: "Account is not available" }, { status: 401 })
        }

        // 2️⃣ Verify password
        const isPasswordValid = await bcrypt.compare(password, user.passwordHash)

        if (!isPasswordValid) {
            await createAuditLog({
                tenantId: user.tenantId,
                actorUserId: user.id,
                action: "USER.LOGIN_FAILED",
                details: "Invalid password provided",
                ipAddress
            })
            return NextResponse.json({ error: "Invalid credentials" }, { status: 401 })
        }

        // 3️⃣ Update last login
        await prisma.user.update({
            where: { id: user.id },
            data: { lastLoginAt: new Date() }
        })

        // 🟢 MFA CHECK
        // Check if MFA is enabled OR if forced setup is required
        if (user.mfaEnabled || user.mfaSetupRequired) {
            const purpose = user.mfaSetupRequired ? "mfa_setup_pending" : "mfa_pending"

            const tempToken = signJwt(
                {
                    sub: user.id,
                    email: user.email,
                    tenantId: user.tenantId,
                    purpose: purpose
                },
                { expiresIn: "5m" }
            )

            return NextResponse.json({
                mfaRequired: true,
                setupRequired: user.mfaSetupRequired,
                tempToken
            })
        }

        // 4️⃣ Build roles
        const roles = user.userRoles.map((ur) => ur.role.name)
        const roleIds = user.userRoles.map((ur) => ur.role.id)

        // 4.5️⃣ Fetch permissions
        const { ids: permissionIds, codes: permissions } = await getUserPermissions(user.id, user.tenantId)

        // 7️⃣ Create refresh token
        const { token: refreshToken, hash } = generateRefreshToken()

        const newRefreshTokenRecord = await prisma.refreshToken.create({
            data: {
                userId: user.id,
                tokenHash: hash,
                mfaVerified: false,
                deviceInfo: req.headers.get("user-agent") || "unknown",
                ipAddress: req.headers.get("x-forwarded-for") || "unknown",
                lastActiveAt: new Date(),
                expiresAt: new Date(
                    Date.now() + REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000
                )
            }
        })

        // 5️⃣ Access token (Created AFTER refresh token to include SID)
        const accessToken = signJwt(
            {
                sub: user.id,
                id: user.id,
                tenantId: user.tenantId,
                email: user.email,
                roles,
                roleIds,
                permissions,
                permissionIds,
                mfaEnabled: user.mfaEnabled,
                sid: newRefreshTokenRecord.id // Session ID
            },
            { expiresIn: ACCESS_TOKEN_EXP }
        )

        // 8️⃣ Response
        const response = NextResponse.json({
            accessToken,
            refreshToken,
            expiresIn: 15 * 60,
            user: {
                id: user.id,
                fullName: user.fullName,
                email: user.email,
                roles,
                roleIds,
                permissions,
                permissionIds,
                mfaEnabled: user.mfaEnabled
            }
        })

        // Set cookies for middleware access
        const host = req.headers.get("host") || "";
        // Regex to match localhost OR any IPv4 address (with optional port)
        const isLocal = host.includes("localhost") ||
            host.includes("127.0.0.1") ||
            host.includes("::1") ||
            /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}(?::[0-9]+)?$/.test(host);

        const secure = process.env.NODE_ENV === "production" && !isLocal;

        console.log(`[AUTH_LOGIN] Host: ${host} | isLocal: ${isLocal} | Secure: ${secure}`);

        const cookieOptions = {
            httpOnly: true,
            secure,
            sameSite: "lax" as const,
            path: "/",
            maxAge: REFRESH_TOKEN_DAYS * 24 * 60 * 60 // Match refresh token expiry
        }

        response.cookies.set("accessToken", accessToken, {
            ...cookieOptions,
            maxAge: 15 * 60 // Access token is short-lived
        })

        response.cookies.set("refreshToken", refreshToken, cookieOptions)

        return response
    } catch (error) {
        console.error("[AUTH_LOGIN]", error)
        return NextResponse.json(
            { error: "Internal Server Error" },
            { status: 500 }
        )
    }
}
