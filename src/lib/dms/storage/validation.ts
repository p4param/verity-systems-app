
import path from "path";
import {
    FileTooLargeError,
    InvalidMimeTypeError,
    MimeTypeMismatchError
} from "./errors";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

/**
 * Allowed MIME types for DMS V1.
 */
const ALLOWED_MIME_TYPES: Record<string, string[]> = {
    "application/pdf": [".pdf"],
    "image/png": [".png"],
    "image/jpeg": [".jpg", ".jpeg"],
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
    "text/plain": [".txt"]
};

/**
 * validateDmsFile
 * 
 * Enforces file size, mime-type whitelist, and extension consistency.
 * 
 * @throws {FileTooLargeError} If file exceeds 10MB.
 * @throws {InvalidMimeTypeError} If mime-type is not in whitelist.
 * @throws {MimeTypeMismatchError} If extension does not match mime-type.
 */

const MAGIC_NUMBERS: Record<string, string[]> = {
    "application/pdf": ["25504446"], // %PDF
    "image/jpeg": ["ffd8ffe0", "ffd8ffe1", "ffd8ffe2"],
    "image/png": ["89504e47"], // .PNG
    "application/zip": ["504b0304"], // PK..
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ["504b0304"], // DOCX (zip)
};

export function validateMagicBytes(buffer: Buffer | Uint8Array, mimeType: string): boolean {
    // Skip if unknown/unsupported type for magic byte check
    if (!MAGIC_NUMBERS[mimeType]) return true;

    const hex = Buffer.from(buffer.slice(0, 4)).toString("hex").toLowerCase();
    return MAGIC_NUMBERS[mimeType].some(magic => hex.startsWith(magic));
}

/**
 * validateDmsFile
 * 
 * Enforces file size, mime-type whitelist, extension consistency, and optional magic byte check.
 * 
 * @throws {FileTooLargeError} If file exceeds 10MB.
 * @throws {InvalidMimeTypeError} If mime-type is not in whitelist.
 * @throws {MimeTypeMismatchError} If extension does not match mime-type.
 */
export function validateDmsFile(params: {
    fileSize: number;
    mimeType: string;
    fileName: string;
    fileBuffer?: Buffer | Uint8Array;
}): void {
    const { fileSize, mimeType, fileName, fileBuffer } = params;

    // 1. Max Size Check
    if (fileSize > MAX_FILE_SIZE) {
        throw new FileTooLargeError(fileSize, MAX_FILE_SIZE);
    }

    // 2. Mime-Type Whitelist Check
    const allowedExtensions = ALLOWED_MIME_TYPES[mimeType];
    if (!allowedExtensions) {
        throw new InvalidMimeTypeError(mimeType);
    }

    // 3. Extension Consistency Check
    const fileExt = path.extname(fileName).toLowerCase();
    if (!allowedExtensions.includes(fileExt)) {
        throw new MimeTypeMismatchError(mimeType, fileExt);
    }

    // 4. Protection against executable types
    const blockedExtensions = [".exe", ".bat", ".sh", ".js", ".php"];
    if (blockedExtensions.includes(fileExt)) {
        throw new Error(`Security violation: Executable extension ${fileExt} is strictly forbidden.`);
    }

    // 5. Magic Byte Validation (If buffer provided)
    if (fileBuffer) {
        const isValid = validateMagicBytes(fileBuffer, mimeType);
        if (!isValid) {
            console.warn(`[Security] Magic byte mismatch. Type: ${mimeType}`);
            throw new Error(`File content does not match declared type: ${mimeType}`);
        }
    }
}
