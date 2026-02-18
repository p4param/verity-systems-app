import path from "path";
import {
    StorageProvider,
    FileMetadata,
    UploadResult
} from "./types";
import { S3Provider } from "./providers/s3-provider";
import {
    FileTooLargeError,
    MimeTypeMismatchError,
    StorageConfigurationError
} from "./errors";
import { validateDmsFile } from "./validation";

// 🛑 Hard limits for DMS V1
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

/**
 * StorageService
 * 
 * Centralized service for all DMS storage interactions.
 * Enforces architectural rules: 
 * - Tenant isolation via path prefix.
 * - File size limits.
 * - Metadata validation.
 */
export class StorageService {
    private static provider: StorageProvider;

    /**
     * Initializes or returns the configured storage provider.
     */
    private static getProvider(): StorageProvider {
        if (!this.provider) {
            const providerType = process.env.DMS_STORAGE_PROVIDER || "s3";
            console.log("[StorageService] Initializing provider:", providerType); // DEBUG LOG

            if (providerType === "local") {
                const { LocalStorageProvider } = require("./providers/local-provider");
                this.provider = new LocalStorageProvider();
            } else {
                this.provider = new S3Provider();
            }
        }
        return this.provider;
    }

    /**
     * Generates a secure, tenant-scoped storage key.
     * Format: tenantId/documentId/versionNumber.extension
     */
    static generateKey(params: {
        tenantId: number;
        documentId: string;
        versionNumber: number;
        extension: string;
    }): string {
        const { tenantId, documentId, versionNumber, extension } = params;

        // Normalize extension (remove leading dot if present)
        const ext = extension.startsWith(".") ? extension.slice(1) : extension;

        // 🛡️ Strict hierarchy to prevent cross-tenant traversal
        return `${tenantId}/${documentId}/${versionNumber}.${ext}`;
    }

    /**
     * Validates file metadata before upload.
     */
    static validateFile(metadata: FileMetadata) {
        // 1. Size Check
        if (metadata.size > MAX_FILE_SIZE) {
            throw new FileTooLargeError(metadata.size, MAX_FILE_SIZE);
        }

        // 2. Mime-Type Consistency (Basic check)
        // In V1 we trust the client metadata, but ensure it's provided.
        if (!metadata.mimeType || !metadata.extension) {
            throw new MimeTypeMismatchError("undefined", "undefined");
        }
    }

    /**
     * Uploads a file to storage after validation.
     */
    static async uploadFile(
        params: {
            tenantId: number;
            documentId: string;
            versionNumber: number;
            body: Buffer | Uint8Array;
            metadata: FileMetadata;
        }
    ): Promise<UploadResult> {
        const { tenantId, documentId, versionNumber, body, metadata } = params;

        // a. Validate (Robust check including Magic Bytes)
        validateDmsFile({
            fileSize: metadata.size,
            mimeType: metadata.mimeType,
            fileName: `file.${metadata.extension}`,
            fileBuffer: body
        });

        // b. Generate Key
        const key = this.generateKey({
            tenantId,
            documentId,
            versionNumber,
            extension: metadata.extension
        });

        // c. Execute via Provider
        return await this.getProvider().upload(key, body, metadata);
    }

    /**
     * Generates a temporary signed URL for file download.
     */
    static async getDownloadUrl(key: string, expiresIn: number = 3600, fileName?: string): Promise<string> {
        return await this.getProvider().getSignedUrl(key, expiresIn, fileName);
    }

    /**
     * Checks if a file exists.
     */
    static async fileExists(key: string): Promise<boolean> {
        return await this.getProvider().exists(key);
    }
}
