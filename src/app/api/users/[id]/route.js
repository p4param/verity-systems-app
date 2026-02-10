import { NextResponse } from "next/server";
import { prisma as db } from "@/lib/prisma";

export async function GET(req, { params }) {
    try {
        const { id } = params;

        if (!id) {
            return NextResponse.json({ error: "ID is required" }, { status: 400 });
        }

        const user = await db.user.findUnique({
            where: {
                id: parseInt(id),
            },
        });

        if (!user) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        return NextResponse.json(user);
    } catch (error) {
        console.error("[USER_GET]", error);
        return NextResponse.json({ error: "Internal Error" }, { status: 500 });
    }
}

export async function PATCH(req, { params }) {
    try {
        const { id } = params;
        const body = await req.json();
        const { email, name } = body;

        const user = await db.user.update({
            where: {
                id: parseInt(id),
            },
            data: {
                email,
                name,
                updatedAt: new Date(),
            },
        });

        return NextResponse.json(user);
    } catch (error) {
        console.error("[USER_PATCH]", error);
        return NextResponse.json({ error: "Internal Error" }, { status: 500 });
    }
}

export async function DELETE(req, { params }) {
    try {
        const { id } = params;

        const user = await db.user.delete({
            where: {
                id: parseInt(id),
            },
        });

        return NextResponse.json(user);
    } catch (error) {
        console.error("[USER_DELETE]", error);
        return NextResponse.json({ error: "Internal Error" }, { status: 500 });
    }
}
