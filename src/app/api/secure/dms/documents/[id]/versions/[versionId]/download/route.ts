import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/auth-guard";
import { prisma } from "@/lib/prisma";
import { PdfService } from "@/services/dms/pdf-service";
import { StorageService } from "@/lib/dms/storage";

/**
 * GET /api/secure/dms/documents/[id]/versions/[versionId]/download
 * 
 * Securely downloads a specific document version.
 * - Enforces DMS_DOCUMENT_DOWNLOAD permission.
 * - Validates tenant isolation.
 * - Handles live generation for STRUCTURED drafts.
 * - Handles signed URL redirection for FILEs and APPROVED snapshots.
 */
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string; versionId: string }> }
) {
    try {
        const startTime = Date.now();
        const { id: documentId, versionId } = await params;

        // 1. Authenticate and check permission
        const user = await requirePermission(req, "DMS_DOCUMENT_DOWNLOAD");
        console.log(`[DOWNLOAD_API] Auth verified in ${Date.now() - startTime}ms. User=${user.sub}`);

        // 2. Fetch document and version with strict tenant isolation
        const document = await prisma.document.findFirst({
            where: { id: documentId, tenantId: user.tenantId },
            include: {
                currentVersion: true,
            }
        });

        if (!document) {
            return NextResponse.json({ message: "Document not found" }, { status: 404 });
        }

        const version = await (prisma.documentVersion as any).findFirst({
            where: { id: versionId, documentId, tenantId: user.tenantId },
            select: {
                id: true,
                contentMode: true,
                contentJson: true,
                storageKey: true,
                mimeType: true,
                versionNumber: true
            }
        });

        if (!version) {
            return NextResponse.json({ message: "Version not found" }, { status: 404 });
        }

        const filename = `${document.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_v${version.versionNumber}.pdf`;

        // 3. Handle STRUCTURED documents
        if (version.contentMode === "STRUCTURED") {
            const status = document.status;

            // DRAFT, SUBMITTED (IN_REVIEW), or REJECTED need live generation
            if (status === "DRAFT" || status === "SUBMITTED" || status === "REJECTED") {
                if (!version.contentJson) {
                    return NextResponse.json({ message: "No content available to download" }, { status: 400 });
                }

                try {
                    console.log(`[DOWNLOAD_API] Starting Live PDF Generation for download...`);
                    const genStartTime = Date.now();
                    const pdfBuffer = await PdfService.generateStructuredPdf({
                        documentId,
                        versionId,
                        contentJson: version.contentJson,
                        title: document.title
                    });
                    console.log(`[DOWNLOAD_API] PDF Generation finished in ${Date.now() - genStartTime}ms`);

                    return new Response(new Uint8Array(pdfBuffer), {
                        status: 200,
                        headers: {
                            'Content-Type': 'application/pdf',
                            'Content-Disposition': `attachment; filename="${filename}"`,
                            'Cache-Control': 'no-store, max-age=0'
                        },
                    });
                } catch (genErr) {
                    console.error("[DOWNLOAD_API] PDF Generation Failed:", genErr);
                    return NextResponse.json({ message: "DOWNLOAD_GENERATION_FAILED" }, { status: 500 });
                }
            }

            // APPROVED or OBSOLETE should have a stored snapshot
            if (version.storageKey) {
                const signedUrl = await StorageService.getDownloadUrl(version.storageKey, 300); // 5 min expiry
                return NextResponse.redirect(signedUrl);
            }

            return NextResponse.json({ message: "Download snapshot not available" }, { status: 404 });
        }

        // 4. Handle FILE documents
        if (version.storageKey) {
            const signedUrl = await StorageService.getDownloadUrl(version.storageKey, 300);
            return NextResponse.redirect(signedUrl);
        }

        return NextResponse.json({ message: "File not found in storage" }, { status: 404 });

    } catch (err: any) {
        if (err instanceof NextResponse) return err;
        console.error("[DOWNLOAD_API] Unexpected error:", err);
        return NextResponse.json({ message: "Internal server error" }, { status: 500 });
    }
}
