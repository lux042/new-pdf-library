import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { existsObject } from "@/lib/s3";
import { isAdmin } from "@/lib/admin";

const Body = z.object({ pdfId: z.string().min(1) });

export async function POST(req: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const pdf = await prisma.pdf.findUnique({ where: { id: parsed.data.pdfId } });
  if (!pdf) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const head = await existsObject(pdf.storageKey);

  // ✅ If AccessDenied, don’t delete the DB row — report the real problem.
  if (!head.ok && head.status === 403) {
    return NextResponse.json(
      {
        error: "S3 verify blocked (AccessDenied). Fix IAM explicit deny / permissions.",
        storageKey: pdf.storageKey,
        s3: head,
      },
      { status: 409 }
    );
  }

  // ❌ If actually missing, then delete the DB row (this case is real NoSuchKey)
  if (!head.ok) {
    await prisma.pdf.delete({ where: { id: pdf.id } }).catch(() => {});
    return NextResponse.json(
      { error: "Upload missing in S3 (NotFound). DB row removed.", storageKey: pdf.storageKey, s3: head },
      { status: 409 }
    );
  }

  return NextResponse.json({ ok: true });
}
