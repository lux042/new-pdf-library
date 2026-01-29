import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const tag = (url.searchParams.get("tag") ?? "").trim().toLowerCase();
  const sort = (url.searchParams.get("sort") ?? "newest").trim();

  const where: any = {};

  if (q) {
    where.OR = [
      { originalName: { contains: q, mode: "insensitive" } },
      { tags: { has: q.toLowerCase() } }, // quick “search by exact tag”
    ];
  }

  if (tag) {
    where.tags = { has: tag };
  }

  const orderBy =
    sort === "oldest"
      ? { createdAt: "asc" as const }
      : sort === "name"
      ? { originalName: "asc" as const }
      : sort === "size"
      ? { sizeBytes: "desc" as const }
      : { createdAt: "desc" as const };

 const pdfs = await prisma.pdf.findMany({
  where,
  orderBy,
  select: {
    id: true,
    originalName: true,
    sizeBytes: true,
    createdAt: true,
    tags: true,
  },
});

// ✅ Convert BigInt to number for JSON
return NextResponse.json({
  pdfs: pdfs.map((p) => ({
    ...p,
    sizeBytes: Number(p.sizeBytes),
  })),
});
}