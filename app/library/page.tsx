"use client";

import { useEffect, useMemo, useState } from "react";
import "./library.css";

type PdfItem = {
  id: string;
  originalName: string;
  sizeBytes: number; // API now returns Number(BigInt)
  createdAt: string;
  tags?: string[];
};

export default function LibraryPage() {
  const [pdfs, setPdfs] = useState<PdfItem[]>([]);
  const [loading, setLoading] = useState(false);

  const [query, setQuery] = useState("");
  const [activeTag, setActiveTag] = useState("");
  const [sort, setSort] = useState<"newest" | "oldest" | "name" | "size">("newest");

  async function refresh(opts?: { q?: string; tag?: string; sort?: string }) {
    const q = (opts?.q ?? query).trim();
    const tag = (opts?.tag ?? activeTag).trim();
    const s = (opts?.sort ?? sort).trim();

    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (tag) params.set("tag", tag);
    if (s) params.set("sort", s);

    setLoading(true);
    try {
      const res = await fetch(`/api/pdfs/list?${params.toString()}`);
      if (!res.ok) {
        console.error("List failed:", res.status);
        setPdfs([]);
        return;
      }
      const j = await res.json().catch(() => ({}));
      setPdfs(j.pdfs ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const allTags = useMemo(() => {
    const set = new Set<string>();
    for (const p of pdfs) {
      for (const t of p.tags ?? []) set.add(t);
    }
    return Array.from(set).sort();
  }, [pdfs]);

  function fmtSize(n: number) {
    const mb = n / (1024 * 1024);
    if (mb >= 1) return `${mb.toFixed(1)} MB`;
    return `${Math.round(n / 1024)} KB`;
  }

  function onSubmitSearch(e: React.FormEvent) {
    e.preventDefault();
    refresh({ q: query, tag: activeTag, sort });
  }

  function clearFilters() {
    setQuery("");
    setActiveTag("");
    setSort("newest");
    refresh({ q: "", tag: "", sort: "newest" });
  }

  return (
    <main className="library-page">
      <div className="library-header">
        <h1 className="library-title">THE LIBRARY</h1>

        <a href="/admin" className="admin-btn">
          Admin
        </a>
      </div>

      {/* Search + sort */}
      <div className="panel">
        <form className="controls" onSubmit={onSubmitSearch}>
          <input
            className="input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by title or exact tag…"
          />

          <button className="btn" type="submit" disabled={loading}>
            Search
          </button>

          <select
            className="input"
            value={sort}
            onChange={(e) => {
              const next = e.target.value as any;
              setSort(next);
              refresh({ sort: next });
            }}
            aria-label="Sort"
          >
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
            <option value="name">Name (A→Z)</option>
            <option value="size">Size (big→small)</option>
          </select>

          <button className="btn" type="button" onClick={clearFilters} disabled={loading}>
            Clear
          </button>

          {loading && <span className="hint">Loading…</span>}
        </form>

        {/* Tag chips */}
        {allTags.length > 0 && (
          <div className="tags">
            {allTags.map((t) => (
              <button
                key={t}
                type="button"
                className={t === activeTag ? "tag tag-active" : "tag"}
                onClick={() => {
                  const next = t === activeTag ? "" : t;
                  setActiveTag(next);
                  refresh({ tag: next });
                }}
              >
                {t}
              </button>
            ))}
          </div>
        )}

        {activeTag && (
          <div className="hint" style={{ marginTop: 8 }}>
            Filtering by tag: <strong>{activeTag}</strong>
          </div>
        )}
      </div>

      {/* List */}
      <div className="catalog-card">
        <div className="catalog-header">
          <span>NAME</span>
          <span>SIZE</span>
          <span>DATE</span>
          <span></span>
        </div>

        {pdfs.map((p) => (
          <div key={p.id} className="catalog-row">
            <div className="file-cell">
              <div className="file-name">{p.originalName}</div>

              {!!(p.tags?.length) && (
                <div className="file-tags">
                  {p.tags!.map((t) => (
                    <button
                      key={t}
                      type="button"
                      className="mini-tag"
                      onClick={() => {
                        setActiveTag(t);
                        refresh({ tag: t });
                      }}
                      title="Filter by tag"
                    >
                      {t}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <span>{fmtSize(p.sizeBytes)}</span>
            <span>{new Date(p.createdAt).toLocaleDateString()}</span>

            <a className="open-btn" href={`/pdfs/${p.id}`} target="_blank" rel="noreferrer">
              OPEN
            </a>
          </div>
        ))}

        {pdfs.length === 0 && <div className="empty-state">No PDFs found.</div>}
      </div>
    </main>
  );
}
