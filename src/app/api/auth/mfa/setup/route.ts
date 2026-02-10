import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/auth-guard";
import { prisma } from "@/lib/prisma";
import { authenticator } from "@/lib/auth/mfa";
import QRCode from "qrcode";

export async function POST(req: Request) {
    try {
        const user = requireAuth(req);

        // Generate new secret
        const secret = authenticator.generateSecret();
        const otpauth = authenticator.toURI({ label: user.email, issuer: "Varity Systems", secret });
        const qrCode = await QRCode.toDataURL(otpauth);

        return NextResponse.json({
            secret,
            qrCode
        });
    } catch (error) {
        if (error instanceof Response) return error;
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
