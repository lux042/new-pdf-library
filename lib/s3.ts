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

export function bucketInfo() {
  // Use ONE env var name everywhere (recommended: S3_BUCKET)
  const bucket = must("S3_BUCKET");
  const prefix = process.env.S3_PREFIX || "pdfs";
  return { bucket, prefix };
}

// Single shared client (don’t redeclare)
export const s3 = new S3Client({
  region: must("AWS_REGION"),
  credentials: {
    accessKeyId: must("AWS_ACCESS_KEY_ID"),
    secretAccessKey: must("AWS_SECRET_ACCESS_KEY"),
  },
});

export async function presignPut(key: string, contentType: string) {
  const { bucket } = bucketInfo();

  const cmd = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: contentType,
  });

  return getSignedUrl(s3, cmd, { expiresIn: 300 }); // 5 minutes
}

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

  return getSignedUrl(s3, cmd, { expiresIn: 300 }); // 5 minutes
}

export async function existsObject(params: { bucket: string; key: string }): Promise<boolean> {
  try {
    await s3.send(
      new HeadObjectCommand({
        Bucket: params.bucket,
        Key: params.key,
      })
    );
    return true;
  } catch (err: any) {
    // Not found
    if (err?.name === "NotFound" || err?.$metadata?.httpStatusCode === 404) return false;
    if (err?.Code === "NotFound") return false;
    throw err;
  }
}

export async function deleteObject(key: string) {
  const { bucket } = bucketInfo();
  await s3.send(
    new DeleteObjectCommand({
      Bucket: bucket,
      Key: key,
    })
  );
}
