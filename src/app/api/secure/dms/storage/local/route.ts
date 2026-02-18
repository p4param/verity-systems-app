
import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { requireAuth } from "@/lib/auth/auth-guard";


// Helper to get mime type (or just rely on stored metadata if we had it easily accessible)
// For simplicity, we'll try to guess based on extension or fallback
const getMimeType = (filePath: string) => {
    // You might want to install 'mime-types' package for robust detection
    // For now, simple fallback
    const ext = path.extname(filePath).toLowerCase();
    const types: Record<string, string> = {
        ".pdf": "application/pdf",
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ".txt": "text/plain"
    };
    return types[ext] || "application/octet-stream";
};

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const key = searchParams.get("key");
        const expires = searchParams.get("expires");
        const signature = searchParams.get("signature");
        const fileName = searchParams.get("fileName");

        if (!key || !expires || !signature) {
            return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
        }

        // 1. Verify Expiry
        if (parseInt(expires) < Math.floor(Date.now() / 1000)) {
            return NextResponse.json({ error: "URL expired" }, { status: 401 });
        }

        // 2. Verify Signature
        const secret = process.env.APP_SECRET || "local-dev-secret";
        const crypto = require('crypto');
        const signaturePayload = fileName ? `${key}:${expires}:${fileName}` : `${key}:${expires}`;
        const expectedSignature = crypto
            .createHmac('sha256', secret)
            .update(signaturePayload)
            .digest('hex');

        if (signature !== expectedSignature) {
            return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
        }

        // 3. Serve File
        const filePath = path.join(process.cwd(), "private", "uploads", key);

        // Security: Prevent traversal
        if (!filePath.startsWith(path.join(process.cwd(), "private", "uploads"))) {
            return NextResponse.json({ error: "Invalid path" }, { status: 403 });
        }

        if (!fs.existsSync(filePath)) {
            return NextResponse.json({ error: "File not found" }, { status: 404 });
        }

        const fileBuffer = fs.readFileSync(filePath);
        const mimeType = getMimeType(filePath);

        return new NextResponse(fileBuffer, {
            headers: {
                "Content-Type": mimeType,
                "Content-Disposition": `attachment; filename="${fileName || path.basename(key)}"`,
                "Content-Length": String(fileBuffer.length),
                "Cache-Control": "private, max-age=300",
                "X-Content-Type-Options": "nosniff",
            }
        });

    } catch (error: any) {
        console.error("Local file serve error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
