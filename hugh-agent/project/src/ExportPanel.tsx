import { useState } from "react";
import { useAction } from "convex/react";
import { api } from "../convex/_generated/api";
import { toast } from "sonner";

export default function ExportPanel() {
  const exportToGitHub = useAction(api.github.exportToGitHub);

  const [repoName, setRepoName] = useState("grizzly-workshop");
  const [orgOrUser, setOrgOrUser] = useState("GrizzlyMedicine");
  const [isPrivate, setIsPrivate] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [result, setResult] = useState<{ repoUrl: string; filesUploaded: number } | null>(null);

  const handleExport = async () => {
    if (!repoName.trim() || !orgOrUser.trim()) return;
    setExporting(true);
    setResult(null);
    try {
      const r = await exportToGitHub({ repoName: repoName.trim(), orgOrUser: orgOrUser.trim(), isPrivate });
      setResult(r);
      toast.success(`Pushed ${r.filesUploaded} files → ${r.repoUrl}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Export failed");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Info */}
      <div className="panel-inset relative overflow-hidden" style={{ borderRadius: 6, padding: "14px 16px" }}>
        <div className="absolute top-0 left-0 right-0 h-px" style={{ background: "#10b981", boxShadow: "0 0 8px #10b981" }} />
        <p className="font-mono text-[10px] text-emerald-400 font-bold tracking-widest mb-1">EXPORT TO GITHUB</p>
        <p className="font-mono text-[9px] text-workshop-muted">
          Pushes all source files (src/, convex/, configs) to a GitHub repo using your GITHUB_PAT.
          After export, SSH into your VPS and run the two commands below.
        </p>
      </div>

      {/* Form */}
      <div className="panel relative overflow-hidden" style={{ borderRadius: 6, padding: "16px" }}>
        <div className="absolute top-0 left-0 right-0 h-px" style={{ background: "#10b981", boxShadow: "0 0 8px #10b981" }} />
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="font-mono text-[9px] text-workshop-dim mb-1">GITHUB USER / ORG</p>
              <input
                value={orgOrUser}
                onChange={e => setOrgOrUser(e.target.value)}
                placeholder="GrizzlyMedicine"
                className="w-full font-mono text-xs text-workshop-text outline-none"
                style={{ background: "#060606", border: "1px solid #2a2a2a", borderRadius: 3, padding: "8px 12px" }}
              />
            </div>
            <div>
              <p className="font-mono text-[9px] text-workshop-dim mb-1">REPO NAME</p>
              <input
                value={repoName}
                onChange={e => setRepoName(e.target.value)}
                placeholder="grizzly-workshop"
                className="w-full font-mono text-xs text-workshop-text outline-none"
                style={{ background: "#060606", border: "1px solid #2a2a2a", borderRadius: 3, padding: "8px 12px" }}
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsPrivate(!isPrivate)}
              className="font-mono text-[9px] px-3 py-1.5 border transition-all"
              style={{
                borderRadius: 3,
                borderColor: isPrivate ? "#f59e0b" : "#2a2a2a",
                color: isPrivate ? "#f59e0b" : "#64748b",
                background: isPrivate ? "#f59e0b15" : "transparent",
              }}
            >
              {isPrivate ? "⚿ PRIVATE" : "◎ PUBLIC"}
            </button>
            <p className="font-mono text-[9px] text-workshop-dim">
              → github.com/{orgOrUser}/{repoName}
            </p>
          </div>

          <button
            onClick={handleExport}
            disabled={exporting || !repoName.trim() || !orgOrUser.trim()}
            className="btn-forge btn-emerald w-full"
            style={{ borderRadius: 3, padding: "10px" }}
          >
            {exporting ? "PUSHING TO GITHUB..." : "⬆ EXPORT TO GITHUB"}
          </button>
        </div>
      </div>

      {/* Result */}
      {result && (
        <div className="panel-inset relative overflow-hidden" style={{ borderRadius: 6, padding: "14px 16px" }}>
          <div className="absolute top-0 left-0 right-0 h-px" style={{ background: "#10b981", boxShadow: "0 0 8px #10b981" }} />
          <p className="font-mono text-[10px] text-emerald-400 font-bold tracking-widest mb-2">
            ✓ PUSHED {result.filesUploaded} FILES
          </p>
          <a
            href={result.repoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-xs text-emerald-400 underline block mb-4"
          >
            {result.repoUrl}
          </a>
          <p className="font-mono text-[9px] text-workshop-muted mb-2 tracking-widest">NOW ON YOUR VPS — PASTE THIS:</p>
          <pre
            className="font-mono text-[10px] text-workshop-chrome p-3 rounded select-all cursor-text overflow-auto"
            style={{ background: "#000", border: "1px solid #2a2a2a", borderRadius: 4 }}
          >{`git clone ${result.repoUrl} /opt/workshop
cd /opt/workshop
npm install
npx convex deploy --prod
npm run build`}</pre>
          <button
            onClick={() => navigator.clipboard.writeText(
              `git clone ${result.repoUrl} /opt/workshop\ncd /opt/workshop\nnpm install\nnpx convex deploy --prod\nnpm run build`
            )}
            className="btn-forge btn-silver mt-2 font-mono text-[9px] px-4 py-1.5"
            style={{ borderRadius: 3 }}
          >
            COPY COMMANDS
          </button>
        </div>
      )}

      {/* VPS deploy instructions even before export */}
      {!result && (
        <div className="panel-inset" style={{ borderRadius: 6, padding: "14px 16px" }}>
          <p className="font-mono text-[9px] text-workshop-dim tracking-widest mb-2">AFTER EXPORT — RUN ON VPS:</p>
          <pre
            className="font-mono text-[10px] text-workshop-muted p-3 rounded overflow-auto"
            style={{ background: "#000", border: "1px solid #1a1a1a", borderRadius: 4 }}
          >{`git clone https://github.com/${orgOrUser}/${repoName} /opt/workshop
cd /opt/workshop
npm install
npx convex deploy --prod
npm run build`}</pre>
        </div>
      )}
    </div>
  );
}
