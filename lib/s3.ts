// lib/s3.ts
import { HeadObjectCommand, S3Client } from "@aws-sdk/client-s3";

export async function headObject(key: string): Promise<
  | { ok: true }
  | { ok: false; code: "NotFound" | "AccessDenied" | "Other"; message?: string }
> {
  const { bucket } = bucketInfo();
  try {
    await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return { ok: true };
  } catch (err: any) {
    const name = err?.name;
    const status = err?.$metadata?.httpStatusCode;

    // not found
    if (name === "NotFound" || status === 404) return { ok: false, code: "NotFound" };

    // permission
    if (name === "AccessDenied" || status === 403)
      return { ok: false, code: "AccessDenied", message: err?.message };

    return { ok: false, code: "Other", message: err?.message ?? String(err) };
  }
}
