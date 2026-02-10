import { NextResponse } from "next/server"
import crypto from "crypto"
import { prisma } from "@/lib/prisma"
import { hashPassword } from "@/lib/auth/password"

export async function POST(req: Request) {
    const { token, newPassword } = await req.json()

    // ✅ Guard clause (THIS avoids your crash)
    if (!token || !newPassword) {
        return NextResponse.json(
            { message: "Token and new password are required" },
            { status: 400 }
        )
    }

    const tokenHash = crypto
        .createHash("sha256")
        .update(token)
        .digest("hex")

    const record = await prisma.passwordResetToken.findFirst({
        where: {
            tokenHash: tokenHash,
            usedAt: null,
            expiresAt: { gt: new Date() }
        }
    })

    if (!record) {
        return NextResponse.json(
            { message: "Invalid or expired token" },
            { status: 400 }
        )
    }

    await prisma.$transaction([
        prisma.user.update({
            where: { id: record.userId },
            data: {
                passwordHash: await hashPassword(newPassword)
            }
        }),
        prisma.passwordResetToken.update({
            where: { id: record.id },
            data: { usedAt: new Date() }
        })
    ])

    return NextResponse.json({
        message: "Password reset successful"
    })
}
