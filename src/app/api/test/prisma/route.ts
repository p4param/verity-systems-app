import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET() {
    const tokens = await prisma.passwordResetToken.findMany()

    const request = await prisma.passwordResetRequest.create({
        data: {
            email: "test@test.com",
            ipAddress: "127.0.0.1"
        }
    })

    const token = await prisma.passwordResetToken.findFirst({
        where: { tokenHash: "abc" }
    })

    return NextResponse.json({
        tokensCount: tokens.length,
        request,
        token
    })
}
