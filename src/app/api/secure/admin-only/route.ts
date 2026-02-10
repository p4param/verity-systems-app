import { NextResponse } from "next/server"
import { requireRole } from "@/lib/auth/auth-guard"

export async function GET(req: Request) {
    try {
        const user = requireRole(req, "Admin")

        return NextResponse.json({
            message: "Welcome Admin",
            user
        })
    } catch (err: any) {
        return NextResponse.json(
            { message: err.message },
            { status: err.status ?? 401 }
        )
    }
}
