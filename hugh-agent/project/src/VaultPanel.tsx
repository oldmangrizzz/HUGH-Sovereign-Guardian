import { useState, useRef } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { Doc, Id } from "../convex/_generated/dataModel";

export default function VaultPanel() {
  const files = useQuery(api.vault.listFiles);
  const generateUploadUrl = useMutation(api.vault.generateUploadUrl);
  const saveFile = useMutation(api.vault.saveFile);
  const deleteFile = useMutation(api.vault.deleteFile);
  const updateFile = useMutation(api.vault.updateFile);

  const [uploading, setUploading] = useState(false);
  const [editingId, setEditingId] = useState<Id<"vaultFiles"> | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editContext, setEditContext] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const uploadUrl = await generateUploadUrl();
      const contentType = file.type || "application/octet-stream";
      const result = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": contentType },
        body: file,
      });
      if (!result.ok) throw new Error(`Upload failed: ${result.status}`);
      const json = await result.json();
      const storageId = json.storageId;
      if (!storageId) throw new Error("Upload response missing storageId");
      await saveFile({
        storageId,
        filename: file.name,
        contentType,
        sizeBytes: file.size,
      });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const startEdit = (file: { _id: Id<"vaultFiles">; label?: string; hughContext?: string }) => {
    setEditingId(file._id);
    setEditLabel(file.label ?? "");
    setEditContext(file.hughContext ?? "");
  };

  const saveEdit = async () => {
    if (!editingId) return;
    await updateFile({ fileId: editingId, label: editLabel, hughContext: editContext });
    setEditingId(null);
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  };

  const getFileIcon = (contentType: string) => {
    if (contentType.startsWith("image/")) return "◈";
    if (contentType.includes("pdf")) return "▣";
    if (contentType.includes("text") || contentType.includes("json")) return "≡";
    if (contentType.includes("audio")) return "♪";
    if (contentType.includes("video")) return "▶";
    return "◻";
  };

  return (
    <div className="space-y-4">
      {/* Upload zone */}
      <div
        className="panel-inset relative overflow-hidden"
        style={{ borderRadius: 6, padding: "20px" }}
      >
        <div className="absolute top-0 left-0 right-0 h-px" style={{ background: "#10b981", boxShadow: "0 0 8px #10b981" }} />
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="rivet" />
            <span className="font-mono text-[10px] text-workshop-muted tracking-widest">UPLOAD TO VAULT</span>
          </div>
          <span className="font-mono text-[9px] text-workshop-dim">ADMIN ONLY — PUBLIC UPLOAD DISABLED</span>
        </div>
        <div className="flex items-center gap-3">
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleUpload}
            disabled={uploading}
            className="hidden"
            id="vault-upload"
          />
          <label
            htmlFor="vault-upload"
            className="btn-forge btn-emerald cursor-pointer"
            style={{ borderRadius: 4, padding: "8px 16px" }}
          >
            {uploading ? "UPLOADING..." : "◈ SELECT FILE"}
          </label>
          <span className="font-mono text-[10px] text-workshop-dim">
            Images, PDFs, text, audio — anything H.U.G.H. should know about
          </span>
        </div>
      </div>

      {/* File list */}
      {files && files.length > 0 ? (
        <div className="space-y-2">
          {files.map((file: Doc<"vaultFiles"> & { url: string | null }) => (
            <div
              key={file._id}
              className="panel relative overflow-hidden"
              style={{ borderRadius: 6, padding: "14px 16px" }}
            >
              <div className="flex items-start gap-3">
                {/* Icon */}
                <div
                  className="flex-shrink-0 flex items-center justify-center font-mono text-sm"
                  style={{
                    width: 32, height: 32,
                    background: "linear-gradient(145deg, #1a1a1a, #0a0a0a)",
                    border: "1px solid #2a2a2a",
                    borderRadius: 4,
                    color: "#10b981",
                  }}
                >
                  {getFileIcon(file.contentType)}
                </div>

                <div className="flex-1 min-w-0">
                  {editingId === file._id ? (
                    <div className="space-y-2">
                      <input
                        value={editLabel}
                        onChange={(e) => setEditLabel(e.target.value)}
                        placeholder="Label (optional)"
                        className="w-full font-mono text-xs text-workshop-text outline-none"
                        style={{
                          background: "#060606",
                          border: "1px solid #2a2a2a",
                          borderRadius: 3,
                          padding: "6px 10px",
                        }}
                      />
                      <textarea
                        value={editContext}
                        onChange={(e) => setEditContext(e.target.value)}
                        placeholder="What should H.U.G.H. know about this file?"
                        rows={3}
                        className="w-full font-mono text-xs text-workshop-text outline-none resize-none"
                        style={{
                          background: "#060606",
                          border: "1px solid #2a2a2a",
                          borderRadius: 3,
                          padding: "6px 10px",
                        }}
                      />
                      <div className="flex gap-2">
                        <button onClick={saveEdit} className="btn-forge btn-emerald" style={{ borderRadius: 3, padding: "4px 12px", fontSize: 10 }}>SAVE</button>
                        <button onClick={() => setEditingId(null)} className="btn-forge btn-silver" style={{ borderRadius: 3, padding: "4px 12px", fontSize: 10 }}>CANCEL</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono text-xs text-workshop-chrome font-bold truncate">{file.label || file.filename}</span>
                        {file.label && <span className="font-mono text-[9px] text-workshop-dim truncate">{file.filename}</span>}
                      </div>
                      <div className="flex items-center gap-3 mb-1">
                        <span className="font-mono text-[9px] text-workshop-dim">{formatSize(file.sizeBytes)}</span>
                        <span className="font-mono text-[9px] text-workshop-dim">{file.contentType}</span>
                      </div>
                      {file.hughContext && (
                        <p className="font-mono text-[10px] text-workshop-muted italic mt-1 line-clamp-2">
                          ↳ {file.hughContext}
                        </p>
                      )}
                    </>
                  )}
                </div>

                {editingId !== file._id && (
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {file.url && (
                      <a
                        href={file.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-forge btn-silver"
                        style={{ borderRadius: 3, padding: "4px 10px", fontSize: 10 }}
                      >
                        ↓ VIEW
                      </a>
                    )}
                    <button
                      onClick={() => startEdit(file)}
                      className="btn-forge btn-silver"
                      style={{ borderRadius: 3, padding: "4px 10px", fontSize: 10 }}
                    >
                      EDIT
                    </button>
                    <button
                      onClick={() => deleteFile({ fileId: file._id })}
                      className="btn-forge btn-crimson"
                      style={{ borderRadius: 3, padding: "4px 10px", fontSize: 10 }}
                    >
                      ✕
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="panel-inset" style={{ borderRadius: 6, padding: "32px", textAlign: "center" }}>
          <p className="font-mono text-[10px] text-workshop-dim">VAULT EMPTY — NO FILES UPLOADED</p>
        </div>
      )}
    </div>
  );
}
