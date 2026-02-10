import { NextResponse } from "next/server"
import crypto from "crypto"
import { prisma } from "@/lib/prisma"
import { hashPassword } from "@/lib/auth/password"

export async function POST(req: Request) {
    try {
        // Parse request body
        const { token, password } = await req.json()

        // Validate input
        if (!token || !password) {
            return NextResponse.json(
                { message: "Token and password are required" },
                { status: 400 }
            )
        }

        // Validate password strength (basic check)
        if (password.length < 8) {
            return NextResponse.json(
                { message: "Password must be at least 8 characters" },
                { status: 400 }
            )
        }

        // 1. Hash the incoming token
        const tokenHash = crypto
            .createHash("sha256")
            .update(token)
            .digest("hex")

        // 2. Look up UserInvite
        const invite = await prisma.userInvite.findFirst({
            where: {
                tokenHash: tokenHash,
                usedAt: null,
                expiresAt: { gt: new Date() }
            }
        })

        // 3. If invalid or expired, return 400
        if (!invite) {
            return NextResponse.json(
                { message: "Invalid or expired invite token" },
                { status: 400 }
            )
        }

        // Find the user by email and tenantId
        const user = await prisma.user.findUnique({
            where: {
                tenantId_email: {
                    tenantId: invite.tenantId,
                    email: invite.email
                }
            }
        })

        if (!user) {
            return NextResponse.json(
                { message: "User not found" },
                { status: 404 }
            )
        }

        // Check if user is already active
        if (user.status === "ACTIVE") {
            return NextResponse.json(
                { message: "User is already activated" },
                { status: 400 }
            )
        }

        // 4. Hash the password
        const passwordHash = await hashPassword(password)

        // 5. Update user and mark invite as used in transaction
        await prisma.$transaction([
            // Update user: set password and status
            prisma.user.update({
                where: { id: user.id },
                data: {
                    passwordHash: passwordHash,
                    status: "ACTIVE"
                }
            }),
            // Mark invite as used
            prisma.userInvite.update({
                where: { id: invite.id },
                data: { usedAt: new Date() }
            })
        ])

        // 6. Return success (no auto-login)
        return NextResponse.json({
            message: "Account activated successfully. You can now log in.",
            email: user.email
        })

    } catch (error) {
        console.error("[ACTIVATION_ERROR]", error)

        return NextResponse.json(
            { message: error instanceof Error ? error.message : "Internal Server Error" },
            { status: 500 }
        )
    }
}
