import { StorageService } from "../../lib/dms/storage";
import { generateHTML } from '@tiptap/html/server';
import StarterKit from '@tiptap/starter-kit'
import { Table } from '@tiptap/extension-table'
import { TableRow } from '@tiptap/extension-table-row'
import { TableCell } from '@tiptap/extension-table-cell'
import { TableHeader } from '@tiptap/extension-table-header'
import { Link } from '@tiptap/extension-link'
import { TextAlign } from '@tiptap/extension-text-align'
import { Underline } from '@tiptap/extension-underline'
import { Color } from '@tiptap/extension-color'
import { TextStyle } from '@tiptap/extension-text-style'
import { Highlight } from '@tiptap/extension-highlight'
import { FontFamily } from '@tiptap/extension-font-family'
import { Superscript } from '@tiptap/extension-superscript'
import { Subscript } from '@tiptap/extension-subscript'
import { TaskList } from '@tiptap/extension-task-list'
import { TaskItem } from '@tiptap/extension-task-item'
import { chromium } from 'playwright'

export class PdfService {
    /**
     * generateSnapshot
     * 
     * Renders contentJson to a high-fidelity PDF using Playwright and uploads it to storage.
     * Used during document approval for STRUCTURED content.
     */
    static async generateSnapshot(params: {
        tenantId: number;
        documentId: string;
        versionId: string;
        contentJson: any;
    }): Promise<string> {
        const { tenantId, documentId, versionId, contentJson } = params;

        // 1. Convert TipTap JSON to HTML using all supported extensions
        const htmlContent = generateHTML(contentJson, [
            StarterKit,
            Table, TableRow, TableCell, TableHeader,
            Link, TextAlign, Underline,
            Color, TextStyle, Highlight.configure({ multicolor: true }),
            FontFamily, Superscript, Subscript,
            TaskList, TaskItem.configure({ nested: true }),
        ])

        // 2. Wrap in full document structure with PDF-ready styling
        const fullHtml = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <style>
                    * { box-sizing: border-box; }
                    body { font-family: Arial, sans-serif; padding: 48px 56px; line-height: 1.7; color: #111827; font-size: 13px; }
                    h1 { font-size: 2em; font-weight: 700; margin: 1.2em 0 0.4em; color: #111827; }
                    h2 { font-size: 1.5em; font-weight: 700; margin: 1em 0 0.4em; color: #1e293b; }
                    h3 { font-size: 1.25em; font-weight: 600; margin: 0.9em 0 0.3em; color: #1e293b; }
                    h4 { font-size: 1.1em; font-weight: 600; margin: 0.8em 0 0.3em; color: #374151; }
                    p { margin: 0.4em 0; }
                    ul { list-style-type: disc; padding-left: 1.5rem; margin: 0.4em 0; }
                    ol { list-style-type: decimal; padding-left: 1.5rem; margin: 0.4em 0; }
                    li { margin: 0.2em 0; }
                    blockquote { border-left: 4px solid #d1d5db; padding-left: 1rem; margin: 0.7em 0; color: #4b5563; font-style: italic; }
                    hr { border: none; border-top: 2px solid #e5e7eb; margin: 1.5em 0; }
                    code { background: #f3f4f6; color: #dc2626; padding: 0.15em 0.35em; border-radius: 3px; font-size: 0.875em; font-family: 'Courier New', monospace; }
                    a { color: #2563eb; text-decoration: underline; }
                    table { border-collapse: collapse; width: 100%; margin: 1em 0; }
                    td, th { border: 1px solid #d1d5db; padding: 7px 10px; vertical-align: top; }
                    th { background: #f9fafb; font-weight: 600; }
                    sup { font-size: 0.75em; vertical-align: super; }
                    sub { font-size: 0.75em; vertical-align: sub; }
                    .page-break { page-break-before: always !important; }
                    div[data-page-break] { page-break-before: always !important; border: none; }
                    .header { border-bottom: 2px solid #374151; margin-bottom: 24px; padding-bottom: 12px; }
                    .metadata { color: #6b7280; font-size: 11px; margin-bottom: 32px; display: flex; gap: 24px; }
                    mark { padding: 0.1em 0.2em; border-radius: 2px; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>Document Snapshot</h1>
                </div>
                <div class="metadata">
                    <span>Document: ${documentId}</span>
                    <span>Version: ${versionId}</span>
                    <span>Generated: ${new Date().toLocaleString()}</span>
                </div>
                <div class="content">
                    ${htmlContent}
                </div>
            </body>
            </html>
        `

        // 3. Generate PDF using Playwright
        const browser = await chromium.launch();
        const page = await browser.newPage();
        await page.setContent(fullHtml, { waitUntil: 'networkidle' });
        const pdfBuffer = await page.pdf({
            format: 'A4',
            margin: { top: '20mm', right: '20mm', bottom: '20mm', left: '20mm' },
            printBackground: true,
        });
        await browser.close();

        // 4. Generate Storage Key
        const storageKey = `${tenantId}/${documentId}/${versionId}/generated.pdf`;

        // 5. Upload to Storage
        const provider = (StorageService as any).getProvider();
        await provider.upload(storageKey, pdfBuffer, {
            size: pdfBuffer.byteLength,
            mimeType: "application/pdf",
            extension: "pdf"
        });

        return storageKey;
    }
}
