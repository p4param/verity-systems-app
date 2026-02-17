
import fs from "fs/promises";
import path from "path";
import { StorageProvider, UploadResult, FileMetadata } from "../types";
import { StorageError } from "../errors";

export class LocalStorageProvider implements StorageProvider {
    private uploadDir: string;

    constructor() {
        this.uploadDir = path.join(process.cwd(), "private", "uploads");

        fs.mkdir(this.uploadDir, { recursive: true }).catch(err => {
            console.error("Failed to create upload directory", err);
        });
    }

    async upload(key: string, body: Buffer | Uint8Array, metadata: FileMetadata): Promise<UploadResult> {
        try {
            const filePath = path.join(this.uploadDir, key);
            const dir = path.dirname(filePath);

            await fs.mkdir(dir, { recursive: true });
            await fs.writeFile(filePath, Buffer.from(body));

            return {
                storageKey: key,
                etag: `local-${Date.now()}`,
                versionId: "1"
            };
        } catch (error: any) {
            console.error("[LOCAL_UPLOAD_ERROR]", error);
            throw new StorageError(`Failed to save file locally: ${error.message}`);
        }
    }

    async getSignedUrl(key: string, expiresIn: number = 3600): Promise<string> {
        // For local dev, we generate a signed URL to allow access without auth header
        const expires = Math.floor(Date.now() / 1000) + expiresIn;
        const secret = process.env.APP_SECRET || "local-dev-secret";

        // Simple HMAC signature
        const crypto = require('crypto');
        const signature = crypto
            .createHmac('sha256', secret)
            .update(`${key}:${expires}`)
            .digest('hex');

        return `/api/secure/dms/storage/local?key=${encodeURIComponent(key)}&expires=${expires}&signature=${signature}`;
    }

    async exists(key: string): Promise<boolean> {
        try {
            const filePath = path.join(this.uploadDir, key);
            await fs.access(filePath);
            return true;
        } catch {
            return false;
        }
    }
}
