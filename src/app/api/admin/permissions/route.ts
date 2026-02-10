import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requirePermission } from "@/lib/auth/permission-guard"

export async function GET(req: Request) {
    try {
        await requirePermission(req, "PERMISSION_VIEW")

        const permissions = await prisma.permission.findMany({
            orderBy: { code: "asc" }
        })

        return NextResponse.json(permissions)
    } catch (error) {
        if (error instanceof Response) return error
        return NextResponse.json(
            { message: error instanceof Error ? error.message : "Internal Server Error" },
            { status: 500 }
        )
    }
}
