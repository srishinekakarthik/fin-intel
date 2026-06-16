import { supabaseAdmin } from '../config/supabase';
import { AppError } from '../middleware/error';

const BUCKET = 'documents';

/**
 * Upload a document buffer to Supabase Storage.
 * Path format: {orgId}/{documentId}/{filename}
 * Returns the storage path (not a public URL — access is controlled).
 */
export async function uploadDocumentToStorage(
  orgId: string,
  documentId: string,
  filename: string,
  buffer: Buffer,
  mimeType: string
): Promise<string> {
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
  const storagePath = `${orgId}/${documentId}/${safeName}`;

  const { error } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(storagePath, buffer, {
      contentType: mimeType,
      upsert: false,
    });

  if (error) {
    throw new AppError(`Storage upload failed: ${error.message}`, 500);
  }

  return storagePath;
}

/**
 * Generate a short-lived signed URL for downloading a document.
 * Expires in 1 hour by default.
 */
export async function getSignedUrl(
  storagePath: string,
  expiresInSeconds = 3600
): Promise<string> {
  const { data, error } = await supabaseAdmin.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, expiresInSeconds);

  if (error || !data) {
    throw new AppError('Failed to generate download URL', 500);
  }

  return data.signedUrl;
}

/**
 * Delete a document file from storage.
 */
export async function deleteDocumentFromStorage(storagePath: string): Promise<void> {
  const { error } = await supabaseAdmin.storage
    .from(BUCKET)
    .remove([storagePath]);

  if (error) {
    throw new AppError(`Storage delete failed: ${error.message}`, 500);
  }
}
