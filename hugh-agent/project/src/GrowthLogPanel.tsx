import { useState } from "react";
import { useMutation, useQuery, useAction } from "convex/react";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";
import { toast } from "sonner";

type Category = "directive" | "observation" | "correction" | "expansion" | "anchor_update";

const CATEGORY_COLORS: Record<Category, { color: string; label: string }> = {
  directive:     { color: "#10b981", label: "DIRECTIVE" },
  observation:   { color: "#94a3b8", label: "OBSERVATION" },
  correction:    { color: "#ef4444", label: "CORRECTION" },
  expansion:     { color: "#8b5cf6", label: "EXPANSION" },
  anchor_update: { color: "#f59e0b", label: "ANCHOR UPDATE" },
};

export default function GrowthLogPanel() {
  const entries    = useQuery(api.growth.listEntries, { includeArchived: true });
  const addEntry   = useMutation(api.growth.addEntry);
  const setActive  = useMutation(api.growth.setActive);
  const deleteEntry = useMutation(api.growth.deleteEntry);
  const updateEntry = useMutation(api.growth.updateEntry);
  const importRepo  = useAction(api.github.importRepo);

  const [showForm, setShowForm]     = useState(false);
  const [editingId, setEditingId]   = useState<Id<"growthLog"> | null>(null);
  const [importing, setImporting]   = useState(false);
  const [importInput, setImportInput] = useState("GrizzlyMedicine/zord-theory-doug-ramsey-protocol");
  const [form, setForm] = useState({
    category: "directive" as Category,
    title: "", content: "", priority: 0.5, tags: "",
  });

  const resetForm = () => {
    setForm({ category: "directive", title: "", content: "", priority: 0.5, tags: "" });
    setShowForm(false);
    setEditingId(null);
  };

  const handleSubmit = async () => {
    if (!form.title.trim() || !form.content.trim()) return;
    const tags = form.tags ? form.tags.split(",").map(t => t.trim()).filter(Boolean) : undefined;
    if (editingId) {
      await updateEntry({ entryId: editingId, title: form.title, content: form.content, priority: form.priority, tags });
    } else {
      await addEntry({ category: form.category, title: form.title, content: form.content, priority: form.priority, tags });
    }
    resetForm();
  };

  const startEdit = (entry: { _id: Id<"growthLog">; category: string; title: string; content: string; priority: number; tags?: string[] }) => {
    setEditingId(entry._id);
    setForm({ category: entry.category as Category, title: entry.title, content: entry.content, priority: entry.priority, tags: entry.tags?.join(", ") ?? "" });
    setShowForm(true);
  };

  const handleImport = async () => {
    const parts = importInput.trim().split("/");
    if (parts.length < 2) { toast.error("Format: owner/repo"); return; }
    const owner = parts[0];
    const repo = parts.slice(1).join("/");
    setImporting(true);
    try {
      const result = await importRepo({ owner, repo });
      toast.success(`Imported ${result.filesImported} files → Growth Log`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-4">

      {/* ── GITHUB IMPORT ── */}
      <div className="panel-inset relative overflow-hidden" style={{ borderRadius: 6, padding: "14px 16px" }}>
        <div className="absolute top-0 left-0 right-0 h-px" style={{ background: "#8b5cf6", boxShadow: "0 0 8px #8b5cf6" }} />
        <p className="font-mono text-[9px] text-workshop-muted tracking-widest mb-3">GITHUB REPO IMPORT</p>
        <div className="flex gap-2">
          <input
            value={importInput}
            onChange={e => setImportInput(e.target.value)}
            placeholder="owner/repo"
            className="flex-1 font-mono text-xs text-workshop-text outline-none"
            style={{ background: "#060606", border: "1px solid #2a2a2a", borderRadius: 3, padding: "7px 10px" }}
          />
          <button
            onClick={handleImport}
            disabled={importing}
            className="btn-forge btn-emerald"
            style={{ borderRadius: 3, padding: "7px 14px", fontSize: 10 }}
          >
            {importing ? "IMPORTING..." : "IMPORT"}
          </button>
        </div>
        <p className="font-mono text-[9px] text-workshop-dim mt-2">
          Fetches repo contents → injects into H.U.G.H. context at priority 0.95
        </p>
      </div>

      {/* ── ADD BUTTON ── */}
      {!showForm && (
        <button onClick={() => setShowForm(true)} className="btn-forge btn-emerald w-full" style={{ borderRadius: 4, padding: "10px" }}>
          + ADD GROWTH ENTRY
        </button>
      )}

      {/* ── FORM ── */}
      {showForm && (
        <div className="panel relative overflow-hidden" style={{ borderRadius: 6, padding: "16px" }}>
          <div className="absolute top-0 left-0 right-0 h-px" style={{ background: "#8b5cf6", boxShadow: "0 0 8px #8b5cf6" }} />
          <p className="font-mono text-[10px] text-workshop-muted tracking-widest mb-4">
            {editingId ? "EDIT ENTRY" : "NEW GROWTH ENTRY"}
          </p>
          <div className="space-y-3">
            <div>
              <p className="font-mono text-[9px] text-workshop-dim mb-1">CATEGORY</p>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(CATEGORY_COLORS) as Category[]).map(cat => (
                  <button key={cat} onClick={() => setForm(f => ({ ...f, category: cat }))}
                    className="font-mono text-[9px] px-2 py-1 border transition-all"
                    style={{ borderRadius: 3, borderColor: form.category === cat ? CATEGORY_COLORS[cat].color : "#2a2a2a", color: form.category === cat ? CATEGORY_COLORS[cat].color : "#64748b", background: form.category === cat ? `${CATEGORY_COLORS[cat].color}15` : "transparent" }}>
                    {CATEGORY_COLORS[cat].label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="font-mono text-[9px] text-workshop-dim mb-1">TITLE</p>
              <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Entry title..."
                className="w-full font-mono text-xs text-workshop-text outline-none"
                style={{ background: "#060606", border: "1px solid #2a2a2a", borderRadius: 3, padding: "8px 12px" }} />
            </div>
            <div>
              <p className="font-mono text-[9px] text-workshop-dim mb-1">CONTENT</p>
              <textarea value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
                placeholder="What should H.U.G.H. know, do, or remember?" rows={4}
                className="w-full font-mono text-xs text-workshop-text outline-none resize-none"
                style={{ background: "#060606", border: "1px solid #2a2a2a", borderRadius: 3, padding: "8px 12px" }} />
            </div>
            <div>
              <div className="flex justify-between mb-1">
                <p className="font-mono text-[9px] text-workshop-dim">PRIORITY</p>
                <p className="font-mono text-[9px] text-workshop-emerald">{form.priority.toFixed(2)}</p>
              </div>
              <input type="range" min="0" max="1" step="0.05" value={form.priority}
                onChange={e => setForm(f => ({ ...f, priority: parseFloat(e.target.value) }))} className="w-full" />
            </div>
            <div>
              <p className="font-mono text-[9px] text-workshop-dim mb-1">TAGS (comma-separated)</p>
              <input value={form.tags} onChange={e => setForm(f => ({ ...f, tags: e.target.value }))}
                placeholder="memory, identity, protocol..."
                className="w-full font-mono text-xs text-workshop-text outline-none"
                style={{ background: "#060606", border: "1px solid #2a2a2a", borderRadius: 3, padding: "8px 12px" }} />
            </div>
            <div className="flex gap-2">
              <button onClick={handleSubmit} className="btn-forge btn-emerald flex-1" style={{ borderRadius: 3, padding: "8px" }}>
                {editingId ? "UPDATE" : "COMMIT"}
              </button>
              <button onClick={resetForm} className="btn-forge btn-silver" style={{ borderRadius: 3, padding: "8px 16px" }}>CANCEL</button>
            </div>
          </div>
        </div>
      )}

      {/* ── ENTRY LIST ── */}
      <div className="space-y-2">
        {entries?.map(entry => {
          const cat = CATEGORY_COLORS[entry.category as Category] ?? { color: "#64748b", label: entry.category.toUpperCase() };
          return (
            <div key={entry._id} className="panel relative overflow-hidden"
              style={{ borderRadius: 6, padding: "12px 14px", opacity: entry.active ? 1 : 0.5 }}>
              <div className="absolute top-0 left-0 right-0 h-px" style={{ background: cat.color, boxShadow: `0 0 6px ${cat.color}` }} />
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-[9px] font-bold" style={{ color: cat.color }}>{cat.label}</span>
                    <span className="font-mono text-[9px] text-workshop-dim">P:{entry.priority.toFixed(2)}</span>
                    {!entry.active && <span className="font-mono text-[9px] text-workshop-dim">ARCHIVED</span>}
                  </div>
                  <p className="font-mono text-xs text-workshop-chrome font-bold mb-1">{entry.title}</p>
                  <p className="font-mono text-[10px] text-workshop-muted line-clamp-2">{entry.content}</p>
                  {entry.tags && entry.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {entry.tags.map(tag => (
                        <span key={tag} className="font-mono text-[8px] px-1.5 py-0.5"
                          style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 2, color: "#64748b" }}>
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-1 flex-shrink-0">
                  <button onClick={() => startEdit(entry)} className="btn-forge btn-silver" style={{ borderRadius: 3, padding: "3px 8px", fontSize: 9 }}>EDIT</button>
                  <button onClick={() => setActive({ entryId: entry._id, active: !entry.active })} className="btn-forge btn-silver" style={{ borderRadius: 3, padding: "3px 8px", fontSize: 9 }}>
                    {entry.active ? "ARCHIVE" : "RESTORE"}
                  </button>
                  <button onClick={() => deleteEntry({ entryId: entry._id })} className="btn-forge btn-crimson" style={{ borderRadius: 3, padding: "3px 8px", fontSize: 9 }}>✕</button>
                </div>
              </div>
            </div>
          );
        })}
        {(!entries || entries.length === 0) && (
          <div className="panel-inset" style={{ borderRadius: 6, padding: "32px", textAlign: "center" }}>
            <p className="font-mono text-[10px] text-workshop-dim">GROWTH LOG EMPTY</p>
          </div>
        )}
      </div>
    </div>
  );
}
