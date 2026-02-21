
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/auth-guard";
import { requirePermission } from "@/lib/auth/permission-guard";
import { handleApiError } from "@/lib/dms/api-error-handler";
import { DocumentService } from "@/services/dms/document-service";

/**
 * GET /api/secure/dms/documents
 * 
 * Lists documents with optional folder/status/search filters.
 */
/**
 * GET /api/secure/dms/documents
 * 
 * Lists documents with advanced filtering, sorting, and pagination.
 */
export async function GET(req: Request) {
    try {
        const user = await requirePermission(req, "DMS_DOCUMENT_READ");
        const { searchParams } = new URL(req.url);

        // Parsing Query Parameters
        const page = parseInt(searchParams.get("page") || "1");
        const limit = parseInt(searchParams.get("limit") || "50");
        const search = searchParams.get("search") || undefined;
        const folderId = searchParams.get("folderId") || undefined;
        const includeSubfolders = searchParams.get("includeSubfolders") === "true";

        // Arrays (support both comma-separated and multiple keys)
        const parseArray = (key: string) => {
            let values = searchParams.getAll(key);
            if (values.length === 1 && values[0].includes(',')) {
                values = values[0].split(',').map(v => v.trim());
            }
            // Filter out 'undefined', 'null', and empty strings
            const cleanValues = values.filter(v => v && v !== 'undefined' && v !== 'null');
            return cleanValues.length > 0 ? cleanValues : undefined;
        };

        const status = parseArray("status") as any[];
        const typeIds = parseArray("documentTypeIds");

        // Expiry
        const expiryFilter = searchParams.get("expiryFilter") as any;
        const expiryFrom = searchParams.get("expiryFrom") ? new Date(searchParams.get("expiryFrom")!) : undefined;
        const expiryTo = searchParams.get("expiryTo") ? new Date(searchParams.get("expiryTo")!) : undefined;

        // Version
        const versionFrom = searchParams.get("versionFrom") ? parseInt(searchParams.get("versionFrom")!) : undefined;
        const versionTo = searchParams.get("versionTo") ? parseInt(searchParams.get("versionTo")!) : undefined;

        // Sorting
        const sortBy = (searchParams.get("sortBy") || 'createdAt') as any;
        const sortOrder = (searchParams.get("sortOrder") || 'desc') as any;

        const result = await DocumentService.listDocuments({
            tenantId: user.tenantId,
            folderId,
            includeSubfolders,
            search,
            status,
            typeIds,
            expiryFilter,
            expiryFrom,
            expiryTo,
            versionFrom,
            versionTo,
            sortBy,
            sortOrder,
            page,
            limit
        });

        return NextResponse.json(result);
    } catch (error: any) {
        return handleApiError(error);
    }
}

/**
 * POST /api/secure/dms/documents
 * 
 * Creates a new document record (DRAFT).
 */
export async function POST(req: Request) {
    try {
        const user = await requirePermission(req, "DMS_DOCUMENT_CREATE");
        const body = await req.json();

        const document = await DocumentService.createDocument({
            title: body.title,
            description: body.description,
            folderId: body.folderId,
            expiryDate: body.expiryDate ? new Date(body.expiryDate) : undefined,
            typeId: body.typeId,
            contentMode: body.contentMode,
            tenantId: user.tenantId,
            user
        });

        return NextResponse.json(document, { status: 201 });
    } catch (error: any) {
        return handleApiError(error);
    }
}
