import { randomBytes } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

import { env, integrations } from "@/lib/env";

/**
 * Uploads integration.
 *
 * Live mode: pushes to S3-compatible storage (Cloudflare R2, AWS S3, or any
 * other S3-compatible provider — same client, just point S3_ENDPOINT at it).
 * Mock mode: writes to `public/uploads` and returns a local URL. Mock mode is
 * also what runs on Vercel if S3_* isn't configured — Vercel's filesystem is
 * read-only outside /tmp, so that write would fail; live mode is required for
 * uploads to actually work on a serverless deploy.
 */

let s3Client: S3Client | null = null;

function getS3Client(): S3Client {
  if (!s3Client) {
    s3Client = new S3Client({
      region: env.S3_REGION || "auto",
      endpoint: env.S3_ENDPOINT,
      credentials: {
        accessKeyId: env.S3_ACCESS_KEY_ID,
        secretAccessKey: env.S3_SECRET_ACCESS_KEY,
      },
    });
  }
  return s3Client;
}

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
    const key = `${folder}/${name}`;
    await getS3Client().send(
      new PutObjectCommand({
        Bucket: env.S3_BUCKET,
        Key: key,
        Body: bytes,
        ContentType: file.type,
        CacheControl: "public, max-age=31536000, immutable",
      })
    );
    const base = env.S3_PUBLIC_URL.replace(/\/$/, "");
    return { url: `${base}/${key}`, mocked: false };
  }

  // Mock: write under public/uploads/<folder>/
  const dir = path.join(process.cwd(), "public", "uploads", folder);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, name), bytes);
  return { url: `/uploads/${folder}/${name}`, mocked: true };
}
