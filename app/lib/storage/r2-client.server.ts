/**
 * SecureR2Client — Cloudflare R2 secure file operations
 * Multi-tenant isolated storage with 7 security layers.
 *
 * Security layers:
 * 1. Path namespacing by org/user/context
 * 2. File type whitelist (images, docs only)
 * 3. Size validation (configurable max)
 * 4. MIME type verification
 * 5. Filename sanitization (path traversal protection)
 * 6. Ownership verification on read/delete
 * 7. No public access — all reads proxy through Worker
 */

// Allowed MIME types for AI attachments
const ALLOWED_MIME_TYPES = new Set([
  // Images
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/svg+xml",
  // Documents
  "application/pdf",
  // Spreadsheets
  "text/csv",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  // Text
  "text/plain",
  "application/json",
]);

// Map of extensions to expected MIME types for extra validation
const EXT_TO_MIME: Record<string, string[]> = {
  jpg: ["image/jpeg"],
  jpeg: ["image/jpeg"],
  png: ["image/png"],
  gif: ["image/gif"],
  webp: ["image/webp"],
  svg: ["image/svg+xml"],
  pdf: ["application/pdf"],
  csv: ["text/csv", "application/vnd.ms-excel"],
  xls: ["application/vnd.ms-excel"],
  xlsx: [
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ],
  txt: ["text/plain"],
  json: ["application/json"],
};

const DEFAULT_MAX_SIZE = 10 * 1024 * 1024; // 10MB

export type R2UploadResult = {
  key: string;
  size: number;
  etag: string;
  contentType: string;
};

/**
 * Sanitize a filename to prevent path traversal and injection attacks
 */
function sanitizeFilename(name: string): string {
  return name
    .replace(/\.\./g, "") // Remove path traversal
    .replace(/[/\\]/g, "") // Remove directory separators
    .replace(/\0/g, "") // Remove null bytes
    .replace(/[<>:"|?*]/g, "") // Remove special chars
    .trim();
}

/**
 * Extract file extension from filename
 */
function getExtension(filename: string): string {
  const parts = filename.split(".");
  return parts.length > 1 ? (parts.pop() || "").toLowerCase() : "";
}

export class SecureR2Client {
  private bucket: R2Bucket;
  private maxSizeBytes: number;

  constructor(
    bucket: R2Bucket,
    options?: { maxSizeBytes?: number }
  ) {
    this.bucket = bucket;
    this.maxSizeBytes = options?.maxSizeBytes ?? DEFAULT_MAX_SIZE;
  }

  /**
   * Validate a file before upload
   * Returns an error message if invalid, null if valid
   */
  validateFile(file: File): string | null {
    // 1. Size check
    if (file.size > this.maxSizeBytes) {
      const maxMB = Math.round(this.maxSizeBytes / (1024 * 1024));
      return `El archivo es demasiado grande. Máximo ${maxMB}MB.`;
    }

    if (file.size === 0) {
      return "El archivo está vacío.";
    }

    // 2. MIME type whitelist
    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      return `Tipo de archivo no permitido: ${file.type}. Permitidos: imágenes, PDF, CSV, Excel.`;
    }

    // 3. Extension vs MIME coherence check
    const ext = getExtension(file.name);
    if (ext && EXT_TO_MIME[ext]) {
      if (!EXT_TO_MIME[ext].includes(file.type)) {
        return `La extensión .${ext} no coincide con el tipo ${file.type}.`;
      }
    }

    // 4. Filename sanitization check
    const sanitized = sanitizeFilename(file.name);
    if (!sanitized || sanitized.length === 0) {
      return "Nombre de archivo inválido.";
    }

    return null; // Valid
  }

  /**
   * Build a namespaced storage key
   * Format: {prefix}/{orgId}/{userId}/{contextId}/{uuid}.{ext}
   */
  private buildKey(params: {
    prefix: string;
    orgId: string;
    userId: string;
    contextId?: string;
    filename: string;
  }): string {
    const fileId = crypto.randomUUID();
    const ext = getExtension(params.filename) || "bin";
    const sanitized = sanitizeFilename(params.filename);
    const baseName = sanitized.replace(/\.[^.]+$/, "").substring(0, 50);

    const parts = [params.prefix, params.orgId, params.userId];
    if (params.contextId) parts.push(params.contextId);
    parts.push(`${fileId}_${baseName}.${ext}`);

    return parts.join("/");
  }

  /**
   * Upload a file securely to R2
   */
  async upload(params: {
    userId: string;
    orgId: string;
    prefix: string;
    file: File;
    contextId?: string;
  }): Promise<R2UploadResult> {
    // Validate
    const error = this.validateFile(params.file);
    if (error) throw new Error(error);

    // Build namespaced key
    const key = this.buildKey({
      prefix: params.prefix,
      orgId: params.orgId,
      userId: params.userId,
      contextId: params.contextId,
      filename: params.file.name,
    });

    // Upload to R2
    const object = await this.bucket.put(key, params.file.stream(), {
      httpMetadata: {
        contentType: params.file.type,
        cacheControl: "private, max-age=86400",
      },
      customMetadata: {
        originalName: sanitizeFilename(params.file.name),
        uploadedBy: params.userId,
        orgId: params.orgId,
        uploadedAt: new Date().toISOString(),
      },
    });

    if (!object) {
      throw new Error("Error al subir archivo a R2.");
    }

    return {
      key: object.key,
      size: object.size,
      etag: object.etag,
      contentType: params.file.type,
    };
  }

  /**
   * Get an object from R2 with ownership verification
   * Returns the R2 object body if authorized, throws if not
   */
  async get(
    key: string,
    userId: string
  ): Promise<{ body: ReadableStream; contentType: string; size: number }> {
    // Ownership check: userId must be in the key path
    if (!this.verifyOwnership(key, userId)) {
      throw new Error("No autorizado para acceder a este archivo.");
    }

    const object = await this.bucket.get(key);
    if (!object) {
      throw new Error("Archivo no encontrado.");
    }

    return {
      body: object.body,
      contentType:
        object.httpMetadata?.contentType || "application/octet-stream",
      size: object.size,
    };
  }

  /**
   * Delete an object with ownership verification
   */
  async delete(key: string, userId: string): Promise<void> {
    if (!this.verifyOwnership(key, userId)) {
      throw new Error("No autorizado para eliminar este archivo.");
    }

    await this.bucket.delete(key);
  }

  /**
   * List objects by prefix (for listing a user's files in a context)
   */
  async list(prefix: string, limit = 100): Promise<R2ObjectSummary[]> {
    const listed = await this.bucket.list({ prefix, limit });
    return listed.objects.map((o) => ({
      key: o.key,
      size: o.size,
      etag: o.etag,
      uploaded: o.uploaded.toISOString(),
    }));
  }

  /**
   * Verify that a userId is part of the object's key path
   * This prevents users from accessing other users' files
   */
  private verifyOwnership(key: string, userId: string): boolean {
    const parts = key.split("/");
    // Key format: prefix/orgId/userId/...
    // userId should be at index 2
    return parts.length >= 3 && parts[2] === userId;
  }
}

export type R2ObjectSummary = {
  key: string;
  size: number;
  etag: string;
  uploaded: string;
};
