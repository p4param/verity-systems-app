import { NextResponse } from "next/server"
import { cleanupAuthTokens } from "@/lib/auth/cleanup-auth-tokens"

export async function POST() {
    try {
        const result = await cleanupAuthTokens()

        return NextResponse.json({
            message: "Auth cleanup successful",
            ...result
        })
    } catch (error) {
        return NextResponse.json(
            { message: "Cleanup failed", error: String(error) },
            { status: 500 }
        )
    }
}
