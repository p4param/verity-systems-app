import { NextResponse } from "next/server"
import crypto from "crypto"
import { prisma } from "@/lib/prisma"

export async function POST(req: Request) {
    let refreshToken

    try {
        const body = await req.json()
        refreshToken = body.refreshToken
    } catch {
        // If JSON parsing fails or no body, treat as no token provided
    }

    if (!refreshToken) {
        return NextResponse.json({ message: "OK" })
    }

    const tokenHash = crypto
        .createHash("sha256")
        .update(refreshToken)
        .digest("hex")

    await prisma.refreshToken.updateMany({
        where: { tokenHash },
        data: { revokedAt: new Date() }
    })

    const response = NextResponse.json({ message: "Logged out" })

    response.cookies.delete("accessToken")
    response.cookies.delete("refreshToken")

    return response
}
