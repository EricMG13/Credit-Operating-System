"use client";

// Analyst memo intake — upload market/research commentary into the Obsidian
// vault (Analyst-Memos/). The server auto-wikilinks covered issuer names and
// tickers, so a plain note lands in the Wiki & Memos graph without the analyst
// hand-writing [[links]]. Esc / ✕ / backdrop to close.
//
// With an ``issuer`` prop this becomes the Issuer Profile's "Log a note"
// quick-capture: a typed note is composed client-side into a .md memo whose
// header mentions the issuer (name + ticker), so the SAME upload endpoint +
// autolink + memochunks path tags it to the issuer — no new store, no new
// schema (plan D4).

import { useRef, useState } from "react";
import { uploadVaultMemo, type VaultMemoResult } from "@/lib/api";
import { CloseButton } from "@/components/shared/CloseButton";
import { useNotify } from "@/components/shared/Notifications";
import { useModalA11y } from "@/lib/use-modal-a11y";
import { ModalBackdrop } from "@/components/shared/ModalBackdrop";
import { ActionReason } from "@/components/shared/ActionReason";

const MEMO_TYPES = [
  { id: "market-commentary", label: "Market commentary" },
  { id: "research", label: "Research" },
  { id: "memo", label: "Memo" },
] as const;

const ACCEPT = ".md,.txt,.pdf";

export interface MemoIssuerTag {
  name: string;
  ticker?: string | null;
}

export function VaultMemoUpload({
  onUploaded,
  issuer,
}: {
  onUploaded?: (r: VaultMemoResult) => void;
  issuer?: MemoIssuerTag;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="tabular text-caos-xs px-2 py-1 rounded border border-caos-border text-caos-muted hover:text-caos-text hover:border-caos-accent/60 transition-caos focus-ring whitespace-nowrap"
        title={issuer
          ? `Log a quick note tagged to ${issuer.name} in the Obsidian vault`
          : "Upload market or research commentary into the Obsidian vault"}
      >
        {issuer ? "LOG NOTE" : "ADD MEMO"}
      </button>
      {open && <MemoDialog onClose={() => setOpen(false)} onUploaded={onUploaded} issuer={issuer} />}
    </>
  );
}

function MemoDialog({
  onClose,
  onUploaded,
  issuer,
}: {
  onClose: () => void;
  onUploaded?: (r: VaultMemoResult) => void;
  issuer?: MemoIssuerTag;
}) {
  const [memoType, setMemoType] = useState<string>(issuer ? "memo" : MEMO_TYPES[0].id);
  const [file, setFile] = useState<File | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const notify = useNotify();
  const panelRef = useModalA11y<HTMLDivElement>(onClose);

  // Quick-capture: compose the typed note into a plain .md memo whose first
  // line mentions the issuer (and ticker), so the server's autolinker tags it
  // — the note travels the exact same vault path as a file upload.
  const composed = issuer && note.trim()
    ? new File(
        [`# Note — ${issuer.name}${issuer.ticker ? ` (${issuer.ticker})` : ""}

${note.trim()}
`],
        `note-${new Date().toISOString().slice(0, 10)}.md`,
        { type: "text/markdown" },
      )
    : null;
  const payload = issuer ? composed : file;

  const submit = async () => {
    if (!payload || busy) return;
    setBusy(true);
    setErr(null);
    const fd = new FormData();
    fd.append("memo_type", memoType);
    fd.append("file", payload);
    try {
      const res = await uploadVaultMemo(fd);
      notify(
        "Memo vaulted",
        `${res.note} — ${res.issuer_links.length} issuer link${res.issuer_links.length === 1 ? "" : "s"}`
      );
      onUploaded?.(res);
      onClose();
    } catch (e) {
      const d = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail
        || (e as Error)?.message || "upload failed";
      setErr(String(d));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ModalBackdrop onClose={onClose} className="caos-enter">
      <div
        ref={panelRef}
        className="w-[440px] max-w-[92vw] flex flex-col bg-caos-panel border border-caos-accent/50 rounded-md overflow-hidden"
        style={{ boxShadow: "var(--shadow-modal)" }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={issuer ? "Log a note to the vault" : "Upload memo to vault"}
      >
        <div className="h-9 shrink-0 px-3 flex items-center gap-2 border-b border-caos-border bg-caos-elevated/70">
          <span className="tabular text-caos-md uppercase tracking-wider text-caos-muted">
            {issuer ? "Log a note" : "Add memo to vault"}
          </span>
          <div className="flex-1" />
          <CloseButton onClick={onClose} label="Close memo upload" />
        </div>

        <div className="p-4 flex flex-col gap-3">
          <div className="text-caos-2xs text-caos-muted font-mono leading-normal">
            {issuer
              ? <>Tagged to {issuer.name}{issuer.ticker ? ` (${issuer.ticker})` : ""} → Analyst-Memos/ in the Obsidian vault; appears under Analyst notes and the Wiki &amp; Memos graph.</>
              : <>Market or research commentary → Analyst-Memos/ in the Obsidian vault.
                Covered issuer names and tickers are wikilinked automatically and appear
                under Wiki &amp; Memos.</>}
          </div>

          <label className="flex items-center gap-2">
            <span className="tabular text-caos-3xs uppercase tracking-wider text-caos-muted w-16 shrink-0">Type</span>
            <select
              value={memoType}
              onChange={(e) => setMemoType(e.target.value)}
              className="focus-ring h-7 flex-1 rounded border border-caos-border bg-caos-elevated px-2 tabular text-caos-sm text-caos-text outline-none transition-caos hover:border-caos-accent/60"
            >
              {MEMO_TYPES.map((t) => (
                <option key={t.id} value={t.id}>{t.label}</option>
              ))}
            </select>
          </label>

          {issuer ? (
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={5}
              placeholder="What did you learn? Plain text — it lands as a tagged vault memo."
              aria-label="Note text"
              className="focus-ring w-full rounded border border-caos-border bg-caos-elevated px-2 py-1.5 tabular text-caos-sm text-caos-text outline-none transition-caos hover:border-caos-accent/60 resize-y"
            />
          ) : (
          <label className="flex items-center gap-2">
            <span className="tabular text-caos-3xs uppercase tracking-wider text-caos-muted w-16 shrink-0">File</span>
            <input
              ref={fileRef}
              type="file"
              accept={ACCEPT}
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="focus-ring flex-1 min-w-0 tabular text-caos-xs text-caos-text file:mr-2 file:px-2 file:py-1 file:rounded file:border file:border-caos-border file:bg-caos-elevated file:text-caos-text file:text-caos-xs file:cursor-pointer"
              aria-label="Memo file (.md, .txt or .pdf)"
            />
          </label>
          )}

          {err && (
            <div className="tabular text-caos-xs text-caos-warning" role="alert">
              <span aria-hidden>!</span> {err}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="tabular text-caos-xs px-3 py-1 rounded border border-caos-border text-caos-muted hover:text-caos-text transition-caos focus-ring"
            >
              CANCEL
            </button>
            <ActionReason
              onClick={submit}
              reason={busy ? "Uploading…" : !payload ? (issuer ? "Type a note first" : "Choose a file first") : null}
              className="tabular text-caos-xs px-3 py-1 rounded bg-caos-accent text-caos-bg font-semibold hover:opacity-90 transition-caos focus-ring aria-disabled:opacity-40 aria-disabled:cursor-not-allowed"
            >
              {busy ? "UPLOADING…" : issuer ? "SAVE NOTE" : "UPLOAD"}
            </ActionReason>
          </div>
        </div>
      </div>
    </ModalBackdrop>
  );
}
