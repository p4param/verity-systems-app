
import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/permission-guard";
import { handleApiError } from "@/lib/dms/api-error-handler";
import { VersionService } from "@/services/dms/version-service";

import { StorageService } from "@/lib/dms/storage";

/**
 * GET /api/secure/dms/documents/[id]/versions
 * 
 * Lists version history for a specific document.
 * optionally handles ?action=view&versionId=... to get signed URL
 */
export async function GET(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: documentId } = await params;
        const user = await requirePermission(req, "DMS_DOCUMENT_READ");
        const { searchParams } = new URL(req.url);
        const action = searchParams.get("action");
        const versionId = searchParams.get("versionId");

        console.log(`[API] GET /versions id=${documentId} action=${action} versionId=${versionId}`);

        // Handle File View/Download Request
        if (action === "view" && versionId) {
            const version = await VersionService.getVersionById(versionId, user.tenantId, documentId);

            if (!version) {
                console.log(`[API] Version not found: ${versionId}`);
                return NextResponse.json({ message: "Version not found" }, { status: 404 });
            }

            // Generate signed URL (valid for 1 hour)
            const downloadUrl = await StorageService.getDownloadUrl(version.storageKey, 3600);
            console.log(`[API] Generated downloadUrl: ${downloadUrl}`);

            return NextResponse.json({ downloadUrl });
        }

        // Handle File Download Request (Explicit Attachment)
        if (action === "download" && versionId) {
            const version = await VersionService.getVersionById(versionId, user.tenantId, documentId);

            if (!version) {
                return NextResponse.json({ message: "Version not found" }, { status: 404 });
            }

            // Generate signed URL with fileName to force attachment
            const downloadUrl = await StorageService.getDownloadUrl(version.storageKey, 3600, version.fileName);
            return NextResponse.json({ downloadUrl });
        }

        // Default: List History
        const history = await VersionService.listVersions(documentId, user.tenantId);
        return NextResponse.json(history);
    } catch (error: any) {
        console.error("[API] Error in GET /versions:", error);
        return handleApiError(error);
    }
}

/**
 * POST /api/secure/dms/documents/[id]/versions
 * 
 * Uploads a new version of a document.
 */
export async function POST(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: documentId } = await params;
        const user = await requirePermission(req, "DMS_DOCUMENT_UPLOAD");

        const formData = await req.formData();
        const file = formData.get("file") as File;

        if (!file) {
            return NextResponse.json({ message: "No file provided" }, { status: 400 });
        }

        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        const version = await VersionService.uploadNewVersion({
            tenantId: user.tenantId,
            documentId,
            fileBuffer: buffer,
            originalFileName: file.name,
            mimeType: file.type,
            user
        });

        return NextResponse.json(version, { status: 201 });
    } catch (error: any) {
        return handleApiError(error);
    }
}
