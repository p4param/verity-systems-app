
/**
 * Metadata for a file to be stored.
 */
export interface FileMetadata {
    size: number;
    mimeType: string;
    extension: string;
}

/**
 * Result of a successful upload operation.
 */
export interface UploadResult {
    storageKey: string;
    etag?: string;
    versionId?: string;
}

/**
 * Interface that all storage providers (S3, Disk, etc.) must implement.
 */
export interface StorageProvider {
    /**
     * Uploads a file buffer or stream to the storage.
     */
    upload(
        key: string,
        body: Buffer | Uint8Array,
        metadata: FileMetadata
    ): Promise<UploadResult>;

    /**
     * Generates a signed URL for temporary access to a file.
     * Default expiration: 1 hour.
     */
    getSignedUrl(key: string, expiresIn?: number, fileName?: string): Promise<string>;

    /**
     * Checks if a file exists at the given key.
     */
    exists(key: string): Promise<boolean>;
}
