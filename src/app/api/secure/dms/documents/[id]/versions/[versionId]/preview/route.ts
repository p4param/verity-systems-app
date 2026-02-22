import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/auth-guard";
import { prisma } from "@/lib/prisma";
import { PdfService } from "@/services/dms/pdf-service";
import { StorageService } from "@/lib/dms/storage";

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string; versionId: string }> }
) {
    try {
        const startTime = Date.now();
        const user = await requireAuth(req);
        console.log(`[PREVIEW_API_TIMER] Auth resolved in ${Date.now() - startTime}ms`);
        const { id: documentId, versionId } = await params;

        // 1. Fetch document and version with strict tenant isolation
        const document = await prisma.document.findFirst({
            where: { id: documentId, tenantId: user.tenantId },
            include: {
                currentVersion: true,
                folder: true,
            }
        });
        console.log(`[PREVIEW_API_TIMER] Document lookup in ${Date.now() - startTime}ms`);

        if (!document) {
            return NextResponse.json({ message: "Document not found" }, { status: 404 });
        }

        const version = await (prisma.documentVersion.findFirst({
            where: { id: versionId, documentId, tenantId: user.tenantId },
            select: {
                id: true,
                contentMode: true,
                contentJson: true,
                storageKey: true,
                mimeType: true
            }
        }) as any);
        console.log(`[PREVIEW_API_TIMER] Version lookup in ${Date.now() - startTime}ms`);

        if (!version) {
            return NextResponse.json({ message: "Version not found" }, { status: 404 });
        }

        // 2. Permission Check (Simplified: if you can view document, you can preview)

        if ((version as any).contentMode !== "STRUCTURED") {
            console.log(`[PREVIEW_API] Blocking non-structured request. Mode: ${(version as any).contentMode}`);
            return NextResponse.json({ message: "This endpoint only supports structured documents" }, { status: 400 });
        }

        const status = document.status;
        console.log(`[PREVIEW_API] Document status: ${status}, Version ID: ${versionId}`);

        // 3. Mapping: SUBMITTED and REJECTED both need live rendering in DRAFT phase
        if (status === "DRAFT" || status === "SUBMITTED" || status === "REJECTED") {
            // LIVE GENERATION (No Storage)
            const content = (version as any).contentJson;
            if (!content) {
                console.warn(`[PREVIEW_API] No contentJson found for version ${versionId}`);
                return NextResponse.json({ message: "No content available to preview" }, { status: 400 });
            }

            try {
                console.log(`[PREVIEW_API_TIMER] Starting Live PDF Generation...`);
                const genStartTime = Date.now();
                const pdfBuffer = await PdfService.generateStructuredPdf({
                    documentId,
                    versionId,
                    contentJson: (version as any).contentJson,
                    title: "Document Preview"
                });
                console.log(`[PREVIEW_API_TIMER] PDF Generation finished in ${Date.now() - genStartTime}ms. Total API time: ${Date.now() - startTime}ms`);

                // Convert Buffer to Uint8Array for Response body compatibility
                const body = new Uint8Array(pdfBuffer);

                return new Response(body, {
                    status: 200,
                    headers: {
                        'Content-Type': 'application/pdf',
                        'Content-Disposition': 'inline; filename="preview.pdf"',
                        'Cache-Control': 'no-store, max-age=0'
                    },
                });
            } catch (genErr) {
                console.error("[PREVIEW_API] PDF Generation Failed:", genErr);
                return NextResponse.json({ message: "PDF_PREVIEW_GENERATION_FAILED" }, { status: 500 });
            }
        }

        // APPROVED or OBSOLETE should have a stored snapshot
        if ((version as any).storageKey) {
            const signedUrl = await StorageService.getDownloadUrl((version as any).storageKey, 300);
            return NextResponse.redirect(signedUrl);
        }

        return NextResponse.json({ message: "Snapshot not available" }, { status: 404 });

        return NextResponse.json({ message: "Preview not available for this file type" }, { status: 415 });

    } catch (err: any) {
        if (err instanceof NextResponse) return err;
        console.error("[PREVIEW_API] Unexpected error:", err);
        return NextResponse.json({ message: "Internal server error" }, { status: 500 });
    }
}
