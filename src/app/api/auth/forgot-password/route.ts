import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { generateResetToken } from "@/lib/auth/reset-token"

const MAX_REQUESTS = 3
const WINDOW_MINUTES = 15

export async function POST(req: Request) {
    const { email } = await req.json()

    const ip =
        req.headers.get("x-forwarded-for") ??
        req.headers.get("x-real-ip") ??
        "unknown"

    const since = new Date(Date.now() - WINDOW_MINUTES * 60 * 1000)

    // 1️⃣ Rate-limit check
    const recentCount = await prisma.passwordResetRequest.count({
        where: {
            OR: [
                { email, requestedAt: { gt: since } },
                { ipAddress: ip, requestedAt: { gt: since } }
            ]
        }
    })

    // 2️⃣ Always return same response
    if (recentCount >= MAX_REQUESTS) {
        console.log(`[ForgotPW] Rate limit hit for ${email} or IP ${ip}`)
        return NextResponse.json({
            message: "If the email exists, a reset link has been sent"
        })
    }

    // 3️⃣ Log this attempt
    await prisma.passwordResetRequest.create({
        data: {
            email,
            ipAddress: ip
        }
    })

    // 4️⃣ Generate reset token (only if user exists and is unique)
    const users = await prisma.user.findMany({
        where: { email, isActive: true }
    })

    if (users.length > 1) {
        console.error(`[ForgotPW_CRITICAL] Duplicate users found for email ${email}. Aborting reset.`)
        // Fall through to generic response to avoid leaking existence
    } else if (users.length === 1) {
        const user = users[0]
        const { token, hash } = generateResetToken()

        await prisma.passwordResetToken.create({
            data: {
                userId: user.id,
                tokenHash: hash,
                expiresAt: new Date(Date.now() + 30 * 60 * 1000)
            }
        })

        // Email stub (dev only)
        console.log("============================================================")
        console.log(`[ForgotPW] User Found: ${user.email}`)
        console.log(`[ForgotPW] Reset link: http://localhost:3000/reset-password?token=${token}`)
        console.log("============================================================")
    } else {
        console.log(`[ForgotPW] User NOT found or inactive for email: ${email}`)
    }

    return NextResponse.json({
        message: "If the email exists, a reset link has been sent"
    })
}
