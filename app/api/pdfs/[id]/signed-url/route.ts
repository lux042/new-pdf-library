import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { presignGet } from "@/lib/s3";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const pdf = await prisma.pdf.findUnique({ where: { id } });
  if (!pdf) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const url = await presignGet(pdf.storageKey, pdf.originalName);
  return NextResponse.json({ url, name: pdf.originalName });
}
