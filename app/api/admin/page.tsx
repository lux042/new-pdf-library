"use client";

import { useEffect, useState } from "react";

type PdfItem = {
  id: string;
  originalName: string;
  sizeBytes: number;
  createdAt: string;
};

export default function AdminPage() {
  const [pdfs, setPdfs] = useState<PdfItem[]>([]);
  const [uploading, setUploading] = useState(false);

  const [code, setCode] = useState("");
  const [authed, setAuthed] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function refresh() {
    const res = await fetch("/api/pdfs/list");
    const j = await res.json().catch(() => ({}));
    setPdfs(j.pdfs ?? []);
  }

  useEffect(() => {
    refresh();
  }, []);

  function fmtSize(n: number) {
    const mb = n / (1024 * 1024);
    if (mb >= 1) return `${mb.toFixed(1)} MB`;
    return `${Math.round(n / 1024)} KB`;
  }

  async function login(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);

    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });

    const j = await res.json().catch(() => ({}));

    if (!res.ok) {
      setAuthed(false);
      setMsg(j?.error ?? "Login failed");
      return;
    }

    setAuthed(true);
    setCode("");
    setMsg("Logged in.");
  }

  async function logout() {
    setMsg(null);
    await fetch("/api/admin/logout", { method: "POST" }).catch(() => {});
    setAuthed(false);
    setMsg("Logged out.");
  }

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    setMsg(null);

    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type && file.type !== "application/pdf") {
      alert("PDFs only");
      return;
    }

    setUploading(true);

    // 1) request presigned URL + create DB row (admin-only)
    const res = await fetch("/api/pdfs/create-upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        filename: file.name,
        mimeType: "application/pdf",
        sizeBytes: file.size,
      }),
    });

    if (!res.ok) {
      setUploading(false);
      const j = await res.json().catch(() => ({}));
      setMsg(j?.error ?? "Failed to start upload (are you logged in?)");
      return;
    }

    const { uploadUrl, pdfId } = (await res.json()) as {
      uploadUrl: string;
      pdfId: string;
    };

    // 2) upload to S3
    let put: Response;
    try {
      put = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": "application/pdf" },
        body: file,
      });
    } catch (err: any) {
      setUploading(false);
      setMsg(`Upload request failed (network/CORS). ${err?.message ?? err}`);
      return;
    }

    if (!put.ok) {
      setUploading(false);
      const txt = await put.text().catch(() => "");
      setMsg(`Upload failed. Status: ${put.status}. ${txt.slice(0, 400)}`);
      return;
    }

    // 3) finalize upload (admin-only)
    const fin = await fetch("/api/pdfs/finalize-upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pdfId }),
    });

    setUploading(false);

    if (!fin.ok) {
      const j = await fin.json().catch(() => ({}));
      setMsg(j?.error ?? "Upload finalize failed");
      await refresh();
      e.target.value = "";
      return;
    }

    setMsg("Upload complete.");
    await refresh();
    e.target.value = "";
  }

  async function deletePdf(p: PdfItem) {
    setMsg(null);
    if (!confirm(`Delete "${p.originalName}"?`)) return;

    const r = await fetch(`/api/pdfs/${p.id}/delete`, { method: "POST" });
    const j = await r.json().catch(() => ({}));

    if (!r.ok) {
      setMsg(j?.error ?? "Delete failed (are you logged in?)");
      return;
    }

    setMsg("Deleted.");
    await refresh();
  }

  return (
    <main style={{ maxWidth: 950, margin: "40px auto", fontFamily: "system-ui" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1 style={{ margin: 0 }}>Admin • PDF Library</h1>
        <a href="/library">Public Library</a>
      </div>

      <div style={{ marginTop: 16, padding: 12, border: "1px solid #ddd", borderRadius: 10 }}>
        {!authed ? (
          <form onSubmit={login} style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <label style={{ fontWeight: 600 }}>Admin code:</label>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Enter admin code"
              style={{ padding: 8, width: 220 }}
            />
            <button type="submit" style={{ padding: "8px 12px" }}>
              Log in
            </button>
          </form>
        ) : (
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <strong>Logged in</strong>
            <button onClick={logout} style={{ padding: "8px 12px" }}>
              Log out
            </button>
          </div>
        )}

        {msg && <div style={{ marginTop: 10, opacity: 0.9 }}>{msg}</div>}
      </div>

      <div style={{ marginTop: 18, padding: 12, border: "1px solid #eee", borderRadius: 10 }}>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <input type="file" accept="application/pdf" onChange={onPickFile} disabled={!authed || uploading} />
          {uploading && <span>Uploading…</span>}
          {!authed && <span style={{ opacity: 0.7 }}>Log in to upload/delete</span>}
        </div>
      </div>

      <div style={{ borderTop: "1px solid #ddd", marginTop: 18 }}>
        {pdfs.map((p) => (
          <div key={p.id} style={{ padding: "12px 0", borderBottom: "1px solid #eee" }}>
            <div style={{ fontWeight: 600 }}>{p.originalName}</div>
            <div style={{ opacity: 0.75, fontSize: 14 }}>
              {fmtSize(p.sizeBytes)} • {new Date(p.createdAt).toLocaleString()}
            </div>

            <div style={{ marginTop: 6, display: "flex", gap: 12, alignItems: "center" }}>
              <a href={`/pdfs/${p.id}`} target="_blank" rel="noreferrer">
                Open PDF
              </a>

              <button onClick={() => deletePdf(p)} disabled={!authed || uploading}>
                Delete
              </button>
            </div>
          </div>
        ))}
        {pdfs.length === 0 && <p>No PDFs yet.</p>}
      </div>
    </main>
  );
}
