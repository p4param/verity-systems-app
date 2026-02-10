import { NextResponse } from "next/server";
import { prisma as db } from "@/lib/prisma";

export async function GET() {
    try {
        const users = await db.user.findMany({
            orderBy: {
                createdAt: "desc",
            },
        });
        return NextResponse.json(users);
    } catch (error) {
        console.error("[USERS_GET]", error);
        return NextResponse.json({ error: "Internal Error" }, { status: 500 });
    }
}

export async function POST(req) {
    try {
        const body = await req.json();
        const { email, name } = body;

        if (!email) {
            return NextResponse.json({ error: "Email is required" }, { status: 400 });
        }

        const start = new Date();

        // Note: updatedAt is manually set because introspection didn't find a default
        const user = await db.user.create({
            data: {
                email,
                name,
                updatedAt: start,
            },
        });

        return NextResponse.json(user);
    } catch (error) {
        console.error("[USERS_POST]", error);
        return NextResponse.json({ error: "Internal Error" }, { status: 500 });
    }
}
