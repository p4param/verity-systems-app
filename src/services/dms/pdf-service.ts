import { jsPDF } from "jspdf";
import { StorageService } from "../../lib/dms/storage";
import { prisma } from "../../lib/prisma";

export class PdfService {
    /**
     * generateSnapshot
     * 
     * Renders contentJson to a PDF and uploads it to storage.
     * Used during document approval for INLINE content.
     */
    static async generateSnapshot(params: {
        tenantId: number;
        documentId: string;
        versionId: string;
        contentJson: any;
    }): Promise<string> {
        const { tenantId, documentId, versionId, contentJson } = params;

        // 1. Generate PDF
        // Simple implementation: Render JSON keys/values or a text blob
        // In a real app, this would use a proper HTML-to-PDF engine
        const doc = new jsPDF();

        doc.setFontSize(20);
        doc.text("Document Snapshot", 20, 20);
        doc.setFontSize(12);
        doc.text(`Tenant ID: ${tenantId}`, 20, 30);
        doc.text(`Document ID: ${documentId}`, 20, 40);
        doc.text(`Version ID: ${versionId}`, 20, 50);
        doc.text("--- Content ---", 20, 60);

        // Basic rendering of contentJson
        const contentString = typeof contentJson === "string"
            ? contentJson
            : JSON.stringify(contentJson, null, 2);

        const splitText = doc.splitTextToSize(contentString, 170);
        doc.text(splitText, 20, 70);

        const pdfBuffer = Buffer.from(doc.output("arraybuffer"));

        // 2. Generate Storage Key
        const storageKey = `${tenantId}/${documentId}/${versionId}/generated.pdf`;

        // 3. Upload to Storage
        const provider = (StorageService as any).getProvider();
        await provider.upload(storageKey, pdfBuffer, {
            size: pdfBuffer.byteLength,
            mimeType: "application/pdf",
            extension: "pdf"
        });

        return storageKey;
    }
}
