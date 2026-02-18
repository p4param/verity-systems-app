
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/auth-guard";
import { requirePermission } from "@/lib/auth/permission-guard";
import { handleApiError } from "@/lib/dms/api-error-handler";
import { DocumentService } from "@/services/dms/document-service";
import { DocumentNotFoundError } from "@/lib/dms/errors";

/**
 * GET /api/secure/dms/documents/[id]
 * 
 * Retrieves document details with current version.
 */
export async function GET(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const user = await requirePermission(req, "DMS_DOCUMENT_READ");

        const document = await DocumentService.getDocumentById(id, user.tenantId, user);

        if (!document) {
            throw new DocumentNotFoundError(id, user.tenantId);
        }

        return NextResponse.json(document);
    } catch (error: any) {
        return handleApiError(error);
    }
}

/**
 * PATCH /api/secure/dms/documents/[id]
 * 
 * Updates document metadata (excluding status).
 */
export async function PATCH(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const user = await requirePermission(req, "DMS_DOCUMENT_EDIT");
        const body = await req.json();

        const document = await DocumentService.updateDocumentMetadata({
            id,
            title: body.title,
            description: body.description,
            folderId: body.folderId,
            expiryDate: body.expiryDate ? new Date(body.expiryDate) : undefined,
            typeId: body.typeId,
            tenantId: user.tenantId,
            user
        });

        return NextResponse.json(document);
    } catch (error: any) {
        return handleApiError(error);
    }
}

/**
 * DELETE /api/secure/dms/documents/[id]
 * 
 * Deletes a document.
 */
export async function DELETE(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const user = await requirePermission(req, "DMS_DOCUMENT_DELETE");

        const result = await DocumentService.deleteDocument(id, user.tenantId, user);
        return NextResponse.json(result);
    } catch (error: any) {
        return handleApiError(error);
    }
}
