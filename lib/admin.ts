import { cookies } from "next/headers";

const COOKIE = "pdf_admin";

export async function isAdmin(): Promise<boolean> {
  const jar = await cookies();
  return jar.get(COOKIE)?.value === "1";
}

export async function setAdminCookie(): Promise<void> {
  const jar = await cookies();
  jar.set(COOKIE, "1", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 14, // 14 days
  });
}

export async function clearAdminCookie(): Promise<void> {
  const jar = await cookies();
  jar.set(COOKIE, "", { path: "/", maxAge: 0 });
}
