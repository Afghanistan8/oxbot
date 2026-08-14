import { randomBytes } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";

import { integrations } from "@/lib/env";

/**
 * Uploads integration.
 *
 * Live mode: pushes to S3-compatible storage (stub — wire your SDK of choice).
 * Mock mode: writes to `public/uploads` and returns a local URL, so image
 * uploads work in development with no cloud storage.
 */

export type UploadResult = { url: string; mocked: boolean };

const ALLOWED = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

function extForType(type: string): string {
  switch (type) {
    case "image/png":
      return "png";
    case "image/jpeg":
      return "jpg";
    case "image/webp":
      return "webp";
    case "image/gif":
      return "gif";
    default:
      return "bin";
  }
}

export function validateUpload(file: { type: string; size: number }): string | null {
  if (!ALLOWED.has(file.type)) return "Unsupported file type. Use PNG, JPG, WEBP, or GIF.";
  if (file.size > MAX_BYTES) return "File too large (max 5 MB).";
  return null;
}

/**
 * Store an uploaded file and return its public URL.
 * `folder` groups uploads (e.g. "banners", "logos").
 */
export async function storeUpload(
  file: { arrayBuffer: () => Promise<ArrayBuffer>; type: string; size: number },
  folder = "misc"
): Promise<UploadResult> {
  const validationError = validateUpload(file);
  if (validationError) throw new Error(validationError);

  const bytes = Buffer.from(await file.arrayBuffer());
  const name = `${Date.now()}-${randomBytes(6).toString("hex")}.${extForType(file.type)}`;

  if (integrations.uploads.live) {
    // TODO(phase-2): push `bytes` to S3 (AWS SDK / R2) and return S3_PUBLIC_URL.
    // Intentionally not implemented in Phase 1; live keys are documented in .env.example.
    throw new Error(
      "S3 uploads are not wired yet. Remove S3_* env vars to use local (mock) uploads."
    );
  }

  // Mock: write under public/uploads/<folder>/
  const dir = path.join(process.cwd(), "public", "uploads", folder);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, name), bytes);
  return { url: `/uploads/${folder}/${name}`, mocked: true };
}
