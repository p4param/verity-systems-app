import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import crypto from "crypto"

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url)
        const token = searchParams.get("token")

        if (!token) {
            return NextResponse.json(
                { valid: false, message: "No token provided" },
                { status: 400 }
            )
        }

        // Hash the token to compare with stored hash
        const tokenHash = crypto.createHash("sha256").update(token).digest("hex")

        // Find the invite
        const invite = await prisma.userInvite.findFirst({
            where: {
                tokenHash: tokenHash,
                usedAt: null, // Not yet used
                expiresAt: {
                    gt: new Date() // Not expired
                }
            }
        })

        if (!invite) {
            return NextResponse.json(
                { valid: false, message: "Invalid or expired invitation" },
                { status: 404 }
            )
        }

        // Get user details
        const user = await prisma.user.findFirst({
            where: {
                tenantId: invite.tenantId,
                email: invite.email
            }
        })

        if (!user) {
            return NextResponse.json(
                { valid: false, message: "User not found" },
                { status: 404 }
            )
        }

        return NextResponse.json({
            valid: true,
            email: user.email,
            fullName: user.fullName
        })

    } catch (error) {
        console.error("[VALIDATE_INVITE_ERROR]", error)
        return NextResponse.json(
            { valid: false, message: "Internal server error" },
            { status: 500 }
        )
    }
}
