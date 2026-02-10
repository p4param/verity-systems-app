import { NextResponse } from "next/server"
import crypto from "crypto"
import { prisma } from "@/lib/prisma"
import { signJwt } from "@/lib/auth/jwt"
import { generateRefreshToken } from "@/lib/auth/refresh-token"
import { getUserPermissions } from "@/lib/auth/permission"

const ACCESS_TOKEN_EXP = "15m"
const REFRESH_TOKEN_DAYS = 7

export async function POST(req: Request) {
    let refreshToken

    try {
        const body = await req.json()
        refreshToken = body.refreshToken
    } catch {
        return NextResponse.json(
            { message: "Refresh token required" },
            { status: 400 }
        )
    }

    if (!refreshToken) {
        return NextResponse.json(
            { message: "Refresh token required" },
            { status: 400 }
        )
    }

    const tokenHash = crypto
        .createHash("sha256")
        .update(refreshToken)
        .digest("hex")

    const record = await prisma.refreshToken.findFirst({
        where: {
            tokenHash,
            revokedAt: null,
            expiresAt: { gt: new Date() }
        },
        include: {
            user: {
                include: {
                    userRoles: {
                        include: { role: true }
                    }
                }
            }
        }
    })

    if (!record) {
        return NextResponse.json(
            { message: "Invalid refresh token" },
            { status: 401 }
        )
    }

    // 🔁 Revoke OLD refresh token
    const { token: newRefreshToken, hash: newHash } =
        generateRefreshToken()

    await prisma.refreshToken.update({
        where: { id: record.id },
        data: {
            revokedAt: new Date(),
            replacedByToken: newHash
        }
    })

    // 🔁 Generate NEW refresh token
    const newRecord = await prisma.refreshToken.create({
        data: {
            userId: record.userId,
            tokenHash: newHash,
            mfaVerified: record.mfaVerified,
            deviceInfo: record.deviceInfo,
            ipAddress: record.ipAddress,
            lastActiveAt: new Date(), // Update activity
            expiresAt: new Date(
                Date.now() + REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000
            )
        }
    })

    const roles = record.user.userRoles.map((ur) => ur.role.name)

    // 🔁 New access token
    const payload: any = {
        sub: record.user.id,
        tenantId: record.user.tenantId,
        email: record.user.email,
        roles,
        mfaEnabled: record.user.mfaEnabled,
        sid: newRecord.id // Session ID
    };

    if (record.mfaVerified) {
        payload.amr = ["pwd", "mfa"];
    } else {
        payload.amr = ["pwd"];
    }

    const newAccessToken = signJwt(
        payload,
        { expiresIn: ACCESS_TOKEN_EXP }
    )

    const permissions = await getUserPermissions(record.user.id, record.user.tenantId)

    // 🔁 Response
    const response = NextResponse.json({
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        expiresIn: 15 * 60,
        user: {
            id: record.user.id,
            fullName: record.user.fullName,
            email: record.user.email,
            roles,
            permissions,
            mfaEnabled: record.user.mfaEnabled
        }
    })

    const cookieOptions = {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax" as const,
        path: "/",
        maxAge: REFRESH_TOKEN_DAYS * 24 * 60 * 60
    }

    response.cookies.set("accessToken", newAccessToken, {
        ...cookieOptions,
        maxAge: 15 * 60
    })

    response.cookies.set("refreshToken", newRefreshToken, cookieOptions)

    return response
}
