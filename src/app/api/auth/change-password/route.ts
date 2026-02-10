import { NextResponse } from "next/server"
import bcrypt from "bcrypt"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/auth/auth-guard"

export async function POST(req: Request) {
    try {
        const user = await requireAuth(req)

        const { currentPassword, newPassword } = await req.json()

        if (!currentPassword || !newPassword) {
            return NextResponse.json(
                { message: "Missing fields" },
                { status: 400 }
            )
        }

        const dbUser = await prisma.user.findUnique({
            where: { id: user.sub }
        })

        if (!dbUser || !dbUser.passwordHash) {
            return NextResponse.json(
                { message: "User not found" },
                { status: 404 }
            )
        }

        const isValid = await bcrypt.compare(
            currentPassword,
            dbUser.passwordHash
        )

        if (!isValid) {
            return NextResponse.json(
                { message: "Current password is incorrect" },
                { status: 401 }
            )
        }

        const newHash = await bcrypt.hash(newPassword, 12)

        await prisma.$transaction([
            prisma.user.update({
                where: { id: dbUser.id },
                data: {
                    passwordHash: newHash,
                    updatedAt: new Date()
                }
            }),

            // Revoke ALL sessions
            prisma.refreshToken.updateMany({
                where: {
                    userId: dbUser.id,
                    revokedAt: null
                },
                data: {
                    revokedAt: new Date()
                }
            })
        ])

        return NextResponse.json({
            message: "Password changed successfully. Please log in again."
        })
    } catch (error) {
        console.error("Change password error:", error)
        return NextResponse.json(
            { message: "Internal server error" },
            { status: 500 }
        )
    }
}
