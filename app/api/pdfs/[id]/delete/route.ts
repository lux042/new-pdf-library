import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin";
import { prisma } from "@/lib/db";
import { deleteObject } from "@/lib/s3";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isAdmin()) {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const { id } = await params;

  const pdf = await prisma.pdf.findUnique({ where: { id } });
  if (!pdf) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Try deleting from S3; even if it fails, still delete DB row to clean library
  await deleteObject(pdf.storageKey).catch(() => {});
  await prisma.pdf.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
