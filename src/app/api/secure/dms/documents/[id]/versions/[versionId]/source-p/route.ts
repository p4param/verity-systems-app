import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/auth-guard";
import { prisma } from "@/lib/prisma";
import { StorageService } from "@/lib/dms/storage";
import { handleApiError } from "@/lib/dms/api-error-handler";

/**
 * GET /api/secure/dms/documents/[id]/versions/[versionId]/preview-source
 * 
 * Securely resolves the preview source for a document version.
 */
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string; versionId: string }> }
) {
    const { id: documentId, versionId } = await params;
    const logPath = "C:\\Users\\Param\\Downloads\\verity-systems-app\\verity-systems-app\\api-debug.log";
    const fs = require("fs");
    const log = (msg: string) => {
        const line = `[${new Date().toISOString()}] ${msg}\n`;
        fs.appendFileSync(logPath, line);
    };

    try {
        log(`REQ: doc=${documentId}, ver=${versionId}`);

        const user = await requirePermission(req, "DMS_DOCUMENT_READ");
        log(`AUTH: user=${user.email}, tenant=${user.tenantId}`);

        // 1. Fetch document and version with strict tenant isolation
        log(`DB_DOC: finding ${documentId} for tenant ${user.tenantId}`);
        const document = await prisma.document.findFirst({
            where: { id: documentId, tenantId: user.tenantId },
            select: { status: true }
        });

        if (!document) {
            log(`DB_DOC_ERROR: Document not found or tenant mismatch: id=${documentId}, tenant=${user.tenantId}`);
            return NextResponse.json({ message: "Document not found" }, { status: 404 });
        }
        log(`DB_DOC_SUCCESS: status=${document.status}`);

        log(`DB_VER: finding ${versionId} for doc ${documentId}`);
        const version = await prisma.documentVersion.findFirst({
            where: { id: versionId, documentId, tenantId: user.tenantId },
            select: {
                id: true,
                contentMode: true,
                storageKey: true,
                mimeType: true
            }
        });

        if (!version) {
            log(`DB_VER_ERROR: Version not found: ${versionId}`);
            return NextResponse.json({ message: "Version not found" }, { status: 404 });
        }
        log(`DB_VER_SUCCESS: mode=${version.contentMode}`);

        // 2. Resolve Source
        if (version.contentMode === "STRUCTURED") {
            const status = document.status;
            if (status === "DRAFT" || status === "SUBMITTED" || status === "REJECTED") {
                log(`RESOLVE: STRUCTURED_LIVE`);
                return NextResponse.json({
                    type: "PDF",
                    url: `/api/secure/dms/documents/${documentId}/versions/${versionId}/preview`
                });
            }

            if (version.storageKey) {
                log(`RESOLVE: STRUCTURED_SNAPSHOT`);
                const signedUrl = await StorageService.getDownloadUrl(version.storageKey, 300);
                return NextResponse.json({ type: "PDF", url: signedUrl });
            }
            log(`RESOLVE_ERROR: STRUCTURED_NO_SNAPSHOT`);
            return NextResponse.json({ type: "UNSUPPORTED", url: null, message: "Snapshot missing" });
        }

        // FILE MODE
        const cleanMime = version.mimeType?.toLowerCase() || "";
        const isPdf = cleanMime === "application/pdf";
        const isImage = cleanMime.startsWith("image/");

        if (version.storageKey) {
            if (isPdf || isImage) {
                log(`RESOLVE: FILE_URL type=${isPdf ? 'PDF' : 'IMAGE'}`);
                const signedUrl = await StorageService.getDownloadUrl(version.storageKey, 300);
                return NextResponse.json({ type: isPdf ? "PDF" : "IMAGE", url: signedUrl });
            }
        }

        log(`RESOLVE_ERROR: UNSUPPORTED_MIME ${cleanMime}`);
        return NextResponse.json({ type: "UNSUPPORTED", url: null, mimeType: cleanMime });

    } catch (err: any) {
        log(`FATAL_ERROR: ${err.message}\n${err.stack}`);
        return handleApiError(err);
    }
}
