import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "../../../../lib/db";
import { existsObject } from "../../../../lib/s3";
import { isAdmin } from "../../../../lib/admin";

const Body = z.object({ pdfId: z.string().min(1) });

export async function POST(req: Request) {
  // Admin-only (recommended)
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const pdf = await prisma.pdf.findUnique({
    where: { id: parsed.data.pdfId },
  });
  if (!pdf) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const head = await existsObject(pdf.storageKey);

  // If your existsObject returns boolean, use: if (!head) { ... }
  // If it returns { ok: boolean, ... }, use: if (!head.ok) { ... }
  const exists = typeof head === "boolean" ? head : head.ok;

  if (!exists) {
    await prisma.pdf.delete({ where: { id: pdf.id } }).catch(() => {});
    return NextResponse.json(
      { error: "Upload not found in S3 (NoSuchKey). Removed DB row." },
      { status: 409 }
    );
  }

  return NextResponse.json({ ok: true });
}
