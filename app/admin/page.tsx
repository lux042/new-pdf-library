"use client";

import { useEffect, useState } from "react";
import "./admin.css";

type PdfItem = {
  id: string;
  originalName: string;
  sizeBytes: number;
  createdAt: string;
  tags?: string[];
};

export default function AdminPage() {
  const [pdfs, setPdfs] = useState<PdfItem[]>([]);
  const [uploading, setUploading] = useState(false);

  const [code, setCode] = useState("");
  const [authed, setAuthed] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [tagText, setTagText] = useState("");

  /* =========================
     LOAD LIBRARY
  ========================= */

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

  /* =========================
     AUTH
  ========================= */

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

  /* =========================
     UPLOAD
  ========================= */

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    setMsg(null);

    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type && file.type !== "application/pdf") {
      alert("PDFs only");
      return;
    }

    setUploading(true);

    const tags = tagText
      .split(",")
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean);

    /* STEP 1 — create upload */
    const res = await fetch("/api/pdfs/create-upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        filename: file.name,
        mimeType: "application/pdf",
        sizeBytes: file.size,
        tags,
      }),
    });

    if (!res.ok) {
      setUploading(false);
      const j = await res.json().catch(() => ({}));
      setMsg(j?.error ?? "Failed to start upload (are you logged in?)");
      return;
    }

    // ✅ read ONCE
    const { uploadUrl, pdfId } = await res.json();

    /* STEP 2 — PUT to S3 */
    const put = await fetch(uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": "application/pdf" },
      body: file,
    });

    if (!put.ok) {
      setUploading(false);
      setMsg("Upload failed");
      return;
    }

    /* STEP 3 — finalize */
    const fin = await fetch("/api/pdfs/finalize-upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pdfId }),
    });

    setUploading(false);

    if (!fin.ok) {
      const j = await fin.json().catch(() => ({}));
      setMsg(j?.error ?? "Upload finalize failed");
      return;
    }

    setTagText("");
    setMsg("Upload complete.");
    await refresh();
    e.target.value = "";
  }

  /* =========================
     DELETE
  ========================= */

  async function deletePdf(p: PdfItem) {
    if (!confirm(`Delete "${p.originalName}"?`)) return;

    const r = await fetch(`/api/pdfs/${p.id}/delete`, { method: "POST" });
    const j = await r.json().catch(() => ({}));

    if (!r.ok) {
      setMsg(j?.error ?? "Delete failed");
      return;
    }

    setMsg("Deleted.");
    await refresh();
  }


  return (
    <main className="library-page">
      <div className="library-topbar">
        <h1 className="library-title">ADMIN • THE LIBRARY</h1>
        <a className="library-link" href="/library">
          Public Library
        </a>
      </div>

      <div className="panel">
        {!authed ? (
          <form onSubmit={login} className="row">
            <span className="label">Admin code:</span>
            <input
              className="input"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Enter admin code"
            />
            <button className="btn" type="submit">
              Log in
            </button>
          </form>
        ) : (
          <div className="row">
            <strong>Logged in</strong>
            <button className="btn" onClick={logout}>
              Log out
            </button>
          </div>
        )}

        {msg && <div className="msg">{msg}</div>}
      </div>

      <div className="panel">
        <div className="row">
          <input
            className="input"
            type="file"
            accept="application/pdf"
            onChange={onPickFile}
            disabled={!authed || uploading}
          />

          {/* ✅ NEW: tags input */}
          <input
            className="input"
            value={tagText}
            onChange={(e) => setTagText(e.target.value)}
            placeholder="tags (comma separated)"
            disabled={!authed || uploading}
          />

          {uploading && <span>Uploading…</span>}
          {!authed && <span className="hint">Log in to upload/delete</span>}
        </div>

        <div className="hint" style={{ marginTop: 8 }}>
          Example: <strong>history, austen, literature</strong>
        </div>
      </div>

      <div className="catalog">
        <div className="catalog-header">
          <span>NAME</span>
          <span>SIZE</span>
          <span>DATE</span>
          <span style={{ textAlign: "right" }}>ACTIONS</span>
        </div>

        {pdfs.map((p) => (
          <div key={p.id} className="catalog-row">
            <span className="file-name">{p.originalName}</span>
            <span>{fmtSize(p.sizeBytes)}</span>
            <span>{new Date(p.createdAt).toLocaleString()}</span>

            <div className="actions">
              <a className="open-btn" href={`/pdfs/${p.id}`} target="_blank" rel="noreferrer">
                OPEN
              </a>

              <button
                className="delete-btn"
                onClick={() => deletePdf(p)}
                disabled={!authed || uploading}
                title={!authed ? "Log in first" : "Delete this PDF"}
              >
                DELETE
              </button>
            </div>

            
            {p.tags?.length ? (
              <div style={{ gridColumn: "1 / -1", marginTop: 6, opacity: 0.8 }}>
                Tags: {p.tags.join(", ")}
              </div>
            ) : null}
            
          </div>
        ))}

        {pdfs.length === 0 && <div className="empty">No PDFs yet.</div>}
      </div>
    </main>
  );
}
