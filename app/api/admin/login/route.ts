import { NextResponse } from "next/server";
import { z } from "zod";
import { setAdminCookie } from "@/lib/admin";

const Body = z.object({ code: z.string().min(1) });

export async function POST(req: Request) {
  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const expected = process.env.ADMIN_CODE;
  if (!expected) {
    return NextResponse.json({ error: "ADMIN_CODE not set" }, { status: 500 });
  }

console.log("ADMIN_CODE expected:", JSON.stringify(expected));
console.log("Got:", JSON.stringify(parsed.data.code));


  if (parsed.data.code !== expected) {
    return NextResponse.json({ error: "Wrong code" }, { status: 401 });
  }

  await setAdminCookie(); // IMPORTANT
  return NextResponse.json({ ok: true });
}
