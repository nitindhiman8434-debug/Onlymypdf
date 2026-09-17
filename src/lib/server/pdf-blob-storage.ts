import {
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createServiceClient, isSupabaseConfigured } from "@/lib/supabase/server";

const SUPABASE_BUCKET = "pdf-files";
const DEFAULT_R2_BUCKET = "onlymypdf-files";
const DIRECT_UPLOAD_TTL_SECONDS = 15 * 60;

export type PdfBlobStorageProvider = "supabase" | "r2";

export type PdfBlobUploadTarget =
  | {
      provider: "supabase";
      path: string;
      token: string;
      expiresInSeconds: number;
    }
  | {
      provider: "r2";
      path: string;
      uploadUrl: string;
      expiresInSeconds: number;
    };

export type PdfBlobObjectInfo = {
  path: string;
  size: number;
  contentType?: string;
  lastModified?: Date;
};

type R2Config = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
};

let cachedR2Client: S3Client | undefined;
let cachedR2Fingerprint = "";

export function getPdfBlobStorageProvider(): PdfBlobStorageProvider {
  return process.env.FILE_STORAGE_PROVIDER?.trim().toLowerCase() === "r2"
    ? "r2"
    : "supabase";
}

function getR2Config(): R2Config | null {
  const accountId = process.env.R2_ACCOUNT_ID?.trim();
  const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim();
  const bucket = process.env.R2_BUCKET_NAME?.trim() || DEFAULT_R2_BUCKET;
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) return null;
  return { accountId, accessKeyId, secretAccessKey, bucket };
}

function getR2Client(): { client: S3Client; config: R2Config } {
  const config = getR2Config();
  if (!config) throw new Error("Cloudflare R2 storage is not configured.");
  const fingerprint = `${config.accountId}:${config.accessKeyId}:${config.bucket}`;
  if (!cachedR2Client || cachedR2Fingerprint !== fingerprint) {
    cachedR2Client = new S3Client({
      region: "auto",
      endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
    cachedR2Fingerprint = fingerprint;
  }
  return { client: cachedR2Client, config };
}

export function isR2StorageConfigured(): boolean {
  return getR2Config() !== null;
}

export function isPdfBlobStorageConfigured(): boolean {
  return getPdfBlobStorageProvider() === "r2"
    ? isR2StorageConfigured()
    : isSupabaseConfigured();
}

export async function createPdfBlobUploadTarget(
  path: string,
  contentType: string
): Promise<PdfBlobUploadTarget> {
  if (getPdfBlobStorageProvider() === "r2") {
    const { client, config } = getR2Client();
    const uploadUrl = await getSignedUrl(
      client,
      new PutObjectCommand({
        Bucket: config.bucket,
        Key: path,
        ContentType: contentType,
      }),
      { expiresIn: DIRECT_UPLOAD_TTL_SECONDS }
    );
    return {
      provider: "r2",
      path,
      uploadUrl,
      expiresInSeconds: DIRECT_UPLOAD_TTL_SECONDS,
    };
  }

  const supabase = await createServiceClient();
  const { data, error } = await supabase.storage
    .from(SUPABASE_BUCKET)
    .createSignedUploadUrl(path, { upsert: false });
  if (error || !data?.token) throw error ?? new Error("Could not create direct upload URL.");
  return {
    provider: "supabase",
    path: data.path || path,
    token: data.token,
    expiresInSeconds: DIRECT_UPLOAD_TTL_SECONDS,
  };
}

export async function putPdfBlobObject(
  path: string,
  body: Buffer,
  contentType: string
): Promise<void> {
  if (getPdfBlobStorageProvider() === "r2") {
    const { client, config } = getR2Client();
    await client.send(
      new PutObjectCommand({
        Bucket: config.bucket,
        Key: path,
        Body: body,
        ContentType: contentType,
      })
    );
    return;
  }

  const supabase = await createServiceClient();
  const { error } = await supabase.storage.from(SUPABASE_BUCKET).upload(path, body, {
    contentType,
    upsert: true,
  });
  if (error) throw error;
}

export async function getPdfBlobObjectInfo(path: string): Promise<PdfBlobObjectInfo> {
  if (getPdfBlobStorageProvider() === "r2") {
    const { client, config } = getR2Client();
    const result = await client.send(
      new HeadObjectCommand({ Bucket: config.bucket, Key: path })
    );
    return {
      path,
      size: result.ContentLength ?? 0,
      contentType: result.ContentType,
      lastModified: result.LastModified,
    };
  }

  const supabase = await createServiceClient();
  const { data, error } = await supabase.storage.from(SUPABASE_BUCKET).info(path);
  if (error || !data) throw error ?? new Error("Stored object was not found.");
  return {
    path,
    size: data.size ?? 0,
    contentType: data.contentType,
    lastModified: data.updatedAt ? new Date(data.updatedAt) : undefined,
  };
}

export async function readPdfBlobObject(path: string): Promise<Buffer> {
  if (getPdfBlobStorageProvider() === "r2") {
    const { client, config } = getR2Client();
    const result = await client.send(
      new GetObjectCommand({ Bucket: config.bucket, Key: path })
    );
    if (!result.Body) throw new Error("Stored object has no content.");
    return Buffer.from(await result.Body.transformToByteArray());
  }

  const supabase = await createServiceClient();
  const { data, error } = await supabase.storage.from(SUPABASE_BUCKET).download(path);
  if (error || !data) throw error ?? new Error("Stored object was not found.");
  return Buffer.from(await data.arrayBuffer());
}

export async function deletePdfBlobObjects(paths: string[]): Promise<void> {
  if (paths.length === 0) return;
  if (getPdfBlobStorageProvider() === "r2") {
    const { client, config } = getR2Client();
    const result = await client.send(
      new DeleteObjectsCommand({
        Bucket: config.bucket,
        Delete: { Objects: paths.map((Key) => ({ Key })), Quiet: true },
      })
    );
    if (result.Errors?.length) {
      const failedPaths = result.Errors.map((entry) => entry.Key).filter(Boolean).join(", ");
      throw new Error(`R2 could not delete ${result.Errors.length} object(s): ${failedPaths}`);
    }
    return;
  }

  const supabase = await createServiceClient();
  const { error } = await supabase.storage.from(SUPABASE_BUCKET).remove(paths);
  if (error) throw error;
}

export async function listR2PdfBlobObjects(
  prefix: string,
  maxObjects = 10_000
): Promise<PdfBlobObjectInfo[]> {
  if (getPdfBlobStorageProvider() !== "r2") {
    throw new Error("R2 object listing requested while R2 is not selected.");
  }
  const { client, config } = getR2Client();
  const objects: PdfBlobObjectInfo[] = [];
  let continuationToken: string | undefined;

  do {
    const page = await client.send(
      new ListObjectsV2Command({
        Bucket: config.bucket,
        Prefix: prefix,
        ContinuationToken: continuationToken,
        MaxKeys: Math.min(1_000, maxObjects - objects.length),
      })
    );
    for (const entry of page.Contents ?? []) {
      if (!entry.Key) continue;
      objects.push({
        path: entry.Key,
        size: entry.Size ?? 0,
        lastModified: entry.LastModified,
      });
      if (objects.length >= maxObjects) break;
    }
    continuationToken = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (continuationToken && objects.length < maxObjects);

  return objects;
}

export async function checkPdfBlobStorage(): Promise<{
  ok: boolean;
  provider: PdfBlobStorageProvider;
  detail: string;
}> {
  const provider = getPdfBlobStorageProvider();
  try {
    if (provider === "r2") {
      const { client, config } = getR2Client();
      await client.send(new HeadBucketCommand({ Bucket: config.bucket }));
      return {
        ok: true,
        provider,
        detail: `R2 bucket=${config.bucket} reachable; public access must remain disabled`,
      };
    }

    const supabase = await createServiceClient();
    const { data: bucket, error } = await supabase.storage.getBucket(SUPABASE_BUCKET);
    return {
      ok: !error && bucket?.public === false,
      provider,
      detail: error
        ? error.message
        : bucket
          ? `bucket=${SUPABASE_BUCKET} public=${String(bucket.public)}`
          : `${SUPABASE_BUCKET} bucket not found`,
    };
  } catch (error) {
    return {
      ok: false,
      provider,
      detail: error instanceof Error ? error.message : "Storage check failed",
    };
  }
}
