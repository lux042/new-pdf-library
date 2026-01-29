import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { presignGet } from "@/lib/s3";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const pdf = await prisma.pdf.findUnique({ where: { id } });
  if (!pdf) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // If your presignGet accepts filename, pass it; otherwise remove the 2nd arg.
  const url = await presignGet(pdf.storageKey, pdf.originalName);
  return NextResponse.redirect(url);
}
