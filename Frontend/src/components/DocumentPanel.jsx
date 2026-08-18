import { FolderOpen, Loader2, Paperclip, X } from "lucide-react";
import { useRef } from "react";

export function DocumentPanel({
  isOpen,
  onClose,
  documents,
  selectedDocs,
  onToggleDoc,
  onUpload,
  isUploading,
}) {
  const fileInputRef = useRef(null);

  return (
    <aside
      className={`relative min-h-0 border-l border-white/5 glass-panel z-20 ${
        isOpen ? "flex w-full flex-col lg:w-72" : "hidden"
      }`}
    >
      <div className="flex h-16 shrink-0 items-center justify-between border-b border-white/5 px-5">
        <div className="flex items-center gap-3">
          <div className="w-1.5 h-1.5 rounded-full bg-white/50" />
          <div>
            <h2 className="text-[9px] font-semibold uppercase tracking-widest text-white/80">Data Repo</h2>
            <p className="font-mono text-[7px] text-white/30 mt-0.5">INDEX: {documents.length}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="grid h-8 w-8 place-items-center rounded-md border border-transparent text-white/30 hover:bg-white/5 hover:text-white transition"
        >
          <X size={12} />
        </button>
      </div>
      <div className="flex min-h-0 flex-1 flex-col p-4 relative">
        <div className="mb-5">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-white/5 border border-white/10 text-[9px] font-bold uppercase tracking-widest text-white/80 hover:bg-white/10 hover:text-white disabled:opacity-50 transition-colors shadow-[0_0_10px_rgba(255,255,255,0.02)]"
          >
            {isUploading ? <Loader2 size={14} className="animate-spin" /> : <Paperclip size={12} />}
            Upload Sequence
          </button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.md,.pdf,.txt"
          className="hidden"
          onChange={(event) => {
            onUpload(event.target.files?.[0]);
            if (fileInputRef.current) fileInputRef.current.value = "";
          }}
        />
        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          {documents.length === 0 ? (
            <div className="rounded-xl bg-black/20 border border-white/5 p-4 font-mono text-[9px] uppercase text-white/30 text-center">
              [ REPO EMPTY ]
            </div>
          ) : (
            <div className="space-y-2">
              {documents.map((doc) => {
                const active = selectedDocs.includes(doc._id);
                return (
                  <button
                    type="button"
                    key={doc._id}
                    onClick={() => onToggleDoc(doc._id)}
                    className={`w-full rounded-xl p-3 text-left transition-all ${
                      active
                        ? "glass-panel-active text-white shadow-[0_0_10px_rgba(255,255,255,0.02)]"
                        : "border border-transparent hover:bg-white/5 text-white/50"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`mt-0.5 grid h-3.5 w-3.5 shrink-0 place-items-center rounded-full border ${active ? "border-white/80 bg-white/10" : "border-white/10"}`}>
                        {active && <div className="w-1.5 h-1.5 rounded-full bg-white/80 shadow-[0_0_5px_#fff]" />}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-[9px] font-semibold uppercase tracking-wide text-white/80">{doc.original_file_name}</p>
                        <p className={`mt-1 font-mono text-[7px] uppercase ${active ? "text-white/50" : "text-white/20"}`}>
                          TYPE: {doc.file_type}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}

export function DocumentPanelToggle({ onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-9 items-center gap-2 rounded-lg border border-white/5 bg-white/5 px-3 text-[9px] font-semibold uppercase tracking-widest text-white/60 hover:bg-white/10 hover:text-white transition-colors"
    >
      <FolderOpen size={12} />
      Data Repo
    </button>
  );
}
