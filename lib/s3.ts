// lib/s3.ts
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

function must(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

// ✅ single shared S3 client
export const s3 = new S3Client({
  region: must("AWS_REGION"),
  credentials: {
    accessKeyId: must("AWS_ACCESS_KEY_ID"),
    secretAccessKey: must("AWS_SECRET_ACCESS_KEY"),
  },
});

export function bucketInfo() {
  const bucket = must("S3_BUCKET");
  const prefix = process.env.S3_PREFIX || "pdfs";
  return { bucket, prefix };
}

// ✅ required by create-upload route
export async function presignPut(key: string, contentType: string) {
  const { bucket } = bucketInfo();

  const cmd = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: contentType,
  });

  return getSignedUrl(s3, cmd, { expiresIn: 300 }); // 5 min
}

// ✅ used by /pdfs/[id] route to open directly
export async function presignGet(key: string, filename?: string) {
  const { bucket } = bucketInfo();

  const cmd = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
    ResponseContentType: "application/pdf",
    ...(filename
      ? { ResponseContentDisposition: `inline; filename="${filename}"` }
      : {}),
  });

  return getSignedUrl(s3, cmd, { expiresIn: 300 }); // 5 min
}

// ✅ used by finalize-upload
export async function existsObject(key: string): Promise<boolean> {
  const { bucket } = bucketInfo();
  try {
    await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return true;
  } catch {
    return false;
  }
}

// ✅ used by delete route
export async function deleteObject(key: string) {
  const { bucket } = bucketInfo();
  await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}
