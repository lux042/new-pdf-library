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

export async function presignPut(key: string, contentType: string) {
  const { bucket } = bucketInfo();
  const cmd = new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: contentType });
  return getSignedUrl(s3, cmd, { expiresIn: 300 });
}

export async function presignGet(key: string, filename?: string) {
  const { bucket } = bucketInfo();
  const cmd = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
    ResponseContentType: "application/pdf",
    ...(filename ? { ResponseContentDisposition: `inline; filename="${filename}"` } : {}),
  });
  return getSignedUrl(s3, cmd, { expiresIn: 300 });
}

export async function existsObject(key: string): Promise<{
  ok: boolean;
  status?: number;
  code?: string;
  message?: string;
}> {
  const { bucket } = bucketInfo();
  try {
    await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return { ok: true };
  } catch (err: any) {
    const status = err?.$metadata?.httpStatusCode;
    const code = err?.name || err?.Code;

    // S3 "not found"
    if (status === 404 || code === "NotFound" || code === "NoSuchKey") {
      return { ok: false, status, code };
    }

    // Permission / policy issue (this is what you’re hitting)
    if (status === 403 || code === "AccessDenied") {
      return { ok: false, status, code, message: err?.message };
    }

    return { ok: false, status, code, message: err?.message };
  }
}

export async function deleteObject(key: string) {
  const { bucket } = bucketInfo();
  await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}
