import { NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import { isAdmin } from "@/lib/admin";
import { bucketInfo, presignPut } from "@/lib/s3";
import { prisma } from "@/lib/db";

const Body = z.object({
  filename: z.string().min(1).max(255),
  mimeType: z.literal("application/pdf"),
  sizeBytes: z.number().int().positive().max(50 * 1024 * 1024),
  tags: z.array(z.string().min(1).max(30)).max(20).optional(),
});

export async function POST(req: Request) {
  // ✅ Next 16: await admin check
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { prefix } = bucketInfo();
  const safeName = parsed.data.filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  const rand = crypto.randomBytes(8).toString("hex");
  const storageKey = `${prefix}/${Date.now()}_${rand}_${safeName}`;

  const tags = (parsed.data.tags ?? [])
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);

  const pdf = await prisma.pdf.create({
    data: {
      originalName: parsed.data.filename,
      storageKey,
      mimeType: parsed.data.mimeType,
      sizeBytes: BigInt(parsed.data.sizeBytes),
      tags,
    },
  });

  const uploadUrl = await presignPut(storageKey, parsed.data.mimeType);

  console.log("CREATE storageKey:", storageKey, "bucket:", process.env.S3_BUCKET);

  return NextResponse.json({ pdfId: pdf.id, uploadUrl, storageKey });
}
