import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { presignGet } from "@/lib/s3";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const pdf = await prisma.pdf.findUnique({ where: { id } });
  if (!pdf) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Redirect to a short-lived signed URL for the *exact* stored key
  const url = await presignGet(pdf.storageKey, pdf.originalName);

  const res = NextResponse.redirect(url, 307);
  res.headers.set("Cache-Control", "no-store");
  return res;
}
