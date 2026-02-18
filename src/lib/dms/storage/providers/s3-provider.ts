
import {
    S3Client,
    PutObjectCommand,
    HeadObjectCommand,
    GetObjectCommand
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import {
    StorageProvider,
    FileMetadata,
    UploadResult
} from "../types";
import { StorageConfigurationError, StorageError } from "../errors";

/**
 * S3Provider
 * 
 * Implements S3-compatible storage logic.
 * Works with AWS S3, MinIO, Cloudflare R2, etc.
 */
export class S3Provider implements StorageProvider {
    private client: S3Client;
    private bucket: string;

    constructor() {
        const region = process.env.DMS_STORAGE_REGION || "auto";
        const endpoint = process.env.DMS_STORAGE_ENDPOINT;
        const accessKeyId = process.env.DMS_STORAGE_ACCESS_KEY;
        const secretAccessKey = process.env.DMS_STORAGE_SECRET_KEY;
        const bucket = process.env.DMS_STORAGE_BUCKET;

        if (!accessKeyId || !secretAccessKey || !bucket) {
            throw new StorageConfigurationError(
                "Missing required S3 configuration (Access Key, Secret Key, or Bucket)."
            );
        }

        this.bucket = bucket;
        this.client = new S3Client({
            region,
            endpoint,
            credentials: {
                accessKeyId,
                secretAccessKey,
            },
            // Force path style for S3-compatible providers like MinIO
            forcePathStyle: process.env.DMS_STORAGE_FORCE_PATH_STYLE === "true",
        });
    }

    /**
     * Uploads a file to S3.
     */
    async upload(
        key: string,
        body: Buffer | Uint8Array,
        metadata: FileMetadata
    ): Promise<UploadResult> {
        try {
            const command = new PutObjectCommand({
                Bucket: this.bucket,
                Key: key,
                Body: body,
                ContentType: metadata.mimeType,
                ContentLength: metadata.size,
            });

            const response = await this.client.send(command);

            return {
                storageKey: key,
                etag: response.ETag,
                versionId: response.VersionId,
            };
        } catch (error: any) {
            console.error("[S3_UPLOAD_ERROR]", error);
            throw new StorageError(`Failed to upload file to S3: ${error.message}`);
        }
    }

    /**
     * Generates a signed URL for temporary access.
     */
    async getSignedUrl(key: string, expiresIn: number = 3600, fileName?: string): Promise<string> {
        try {
            const command = new GetObjectCommand({
                Bucket: this.bucket,
                Key: key,
                ResponseContentDisposition: fileName ? `attachment; filename="${fileName}"` : undefined,
            });

            return await getSignedUrl(this.client, command, { expiresIn });
        } catch (error: any) {
            console.error("[S3_SIGNED_URL_ERROR]", error);
            throw new StorageError(`Failed to generate signed URL: ${error.message}`);
        }
    }

    /**
     * Checks for file existence using HeadObject.
     */
    async exists(key: string): Promise<boolean> {
        try {
            const command = new HeadObjectCommand({
                Bucket: this.bucket,
                Key: key,
            });
            await this.client.send(command);
            return true;
        } catch (error: any) {
            if (error.name === "NotFound" || error.$metadata?.httpStatusCode === 404) {
                return false;
            }
            throw new StorageError(`Failed to check file existence in S3: ${error.message}`);
        }
    }
}
