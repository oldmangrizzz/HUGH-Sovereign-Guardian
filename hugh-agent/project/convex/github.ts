"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

const GITHUB_API = "https://api.github.com";
const CONTENT_EXTENSIONS = [".md", ".txt", ".ts", ".js", ".py", ".json", ".yaml", ".yml", ".sh"];
const MAX_FILE_SIZE = 50000;
const MAX_TOTAL_CHARS = 60000;

async function ghFetch(p: string, pat: string) {
  const res = await fetch(`${GITHUB_API}${p}`, {
    headers: {
      Authorization: `Bearer ${pat}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`GitHub GET ${p} ${res.status}: ${txt.slice(0, 200)}`);
  }
  return res.json();
}

async function ghPost(p: string, pat: string, body: unknown) {
  const res = await fetch(`${GITHUB_API}${p}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${pat}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const txt = await res.text();
  if (!res.ok) throw new Error(`GitHub POST ${p} ${res.status}: ${txt.slice(0, 200)}`);
  return JSON.parse(txt);
}

async function ghPut(p: string, pat: string, body: unknown) {
  const res = await fetch(`${GITHUB_API}${p}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${pat}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const txt = await res.text();
  if (!res.ok) throw new Error(`GitHub PUT ${p} ${res.status}: ${txt.slice(0, 200)}`);
  return JSON.parse(txt);
}

async function ghPatch(p: string, pat: string, body: unknown) {
  const res = await fetch(`${GITHUB_API}${p}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${pat}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const txt = await res.text();
  if (!res.ok) throw new Error(`GitHub PATCH ${p} ${res.status}: ${txt.slice(0, 200)}`);
  return JSON.parse(txt);
}

// ── EXPORT THIS PROJECT TO GITHUB ─────────────────────────────────────────
// Files are collected by the CLIENT (browser has access to the dev server)
// and passed in as filesJson. The action only does GitHub API work.
export const exportToGitHub = action({
  args: {
    repoName: v.string(),
    orgOrUser: v.string(),
    isPrivate: v.optional(v.boolean()),
    filesJson: v.string(), // JSON array of {path, content}
  },
  handler: async (_ctx, args): Promise<{ success: boolean; repoUrl: string; filesUploaded: number }> => {
    const pat = process.env.GITHUB_PAT;
    if (!pat) throw new Error("GITHUB_PAT not configured in Convex env vars");

    const owner = args.orgOrUser;
    const repo = args.repoName;
    const isPrivate = args.isPrivate ?? true;

    const filesToPush: Array<{ path: string; content: string }> = JSON.parse(args.filesJson);
    if (!filesToPush.length) throw new Error("No files provided — client collection failed");

    // 1. Create repo if it doesn't exist (422 = already exists, ignore)
    const createRes = await fetch(`${GITHUB_API}/user/repos`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${pat}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: repo,
        private: isPrivate,
        auto_init: false,
        description: "H.U.G.H. — Grizzly Medicine Workshop",
      }),
    });
    if (!createRes.ok && createRes.status !== 422) {
      throw new Error(`Repo create failed: ${(await createRes.text()).slice(0, 200)}`);
    }

    // 2. Bootstrap via Contents API (handles truly empty repos)
    const bootstrapB64 = Buffer.from(
      `# H.U.G.H. — Grizzly Medicine Workshop\n\nInitialised ${new Date().toISOString()}\n`
    ).toString("base64");
    let readmeSha: string | undefined;
    try {
      const existing = await ghFetch(`/repos/${owner}/${repo}/contents/README.md`, pat) as { sha: string };
      readmeSha = existing.sha;
    } catch { /* doesn't exist yet */ }
    await ghPut(`/repos/${owner}/${repo}/contents/README.md`, pat, {
      message: "chore: bootstrap repo",
      content: bootstrapB64,
      ...(readmeSha ? { sha: readmeSha } : {}),
    });

    // 3. Get HEAD
    let parentSha = "";
    let baseTreeSha = "";
    for (let i = 0; i < 5; i++) {
      try {
        const ref = await ghFetch(`/repos/${owner}/${repo}/git/ref/heads/main`, pat) as { object: { sha: string } };
        parentSha = ref.object.sha;
        const c = await ghFetch(`/repos/${owner}/${repo}/git/commits/${parentSha}`, pat) as { tree: { sha: string } };
        baseTreeSha = c.tree.sha;
        break;
      } catch {
        if (i < 4) await new Promise(r => setTimeout(r, 1200));
      }
    }
    if (!parentSha) throw new Error("Could not resolve HEAD after bootstrap — check PAT permissions");

    // 4. Create blobs
    const treeItems: Array<{ path: string; mode: string; type: string; sha: string }> = [];
    const blobErrors: string[] = [];
    for (const file of filesToPush) {
      try {
        const blob = await ghPost(`/repos/${owner}/${repo}/git/blobs`, pat, {
          content: Buffer.from(file.content).toString("base64"),
          encoding: "base64",
        }) as { sha: string };
        treeItems.push({ path: file.path, mode: "100644", type: "blob", sha: blob.sha });
      } catch (e) {
        blobErrors.push(`${file.path}: ${String(e).slice(0, 80)}`);
      }
    }
    if (treeItems.length === 0) {
      throw new Error(`All ${filesToPush.length} blobs failed. Sample: ${blobErrors.slice(0, 2).join(" | ")}`);
    }
    if (blobErrors.length > 0) {
      console.warn(`${blobErrors.length} blobs skipped: ${blobErrors.slice(0, 3).join(" | ")}`);
    }

    // 5. Create tree
    const tree = await ghPost(`/repos/${owner}/${repo}/git/trees`, pat, {
      tree: treeItems,
      base_tree: baseTreeSha,
    }) as { sha: string };

    // 6. Create commit
    const commit = await ghPost(`/repos/${owner}/${repo}/git/commits`, pat, {
      message: `Export from H.U.G.H. Workshop — ${new Date().toISOString()}`,
      tree: tree.sha,
      parents: [parentSha],
    }) as { sha: string };

    // 7. Force-update main ref
    await ghPatch(`/repos/${owner}/${repo}/git/refs/heads/main`, pat, {
      sha: commit.sha,
      force: true,
    });

    return { success: true, repoUrl: `https://github.com/${owner}/${repo}`, filesUploaded: treeItems.length };
  },
});

// ── IMPORT REPO INTO GROWTH LOG ────────────────────────────────────────────
export const importRepo = action({
  args: {
    owner: v.string(),
    repo: v.string(),
    branch: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{ success: boolean; filesImported: number; totalChars: number; entryId: string; repoDescription: string | null }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const pat = process.env.GITHUB_PAT;
    if (!pat) throw new Error("GITHUB_PAT not configured in Convex environment variables");

    const branch = args.branch ?? "main";

    const repoMeta = await ghFetch(`/repos/${args.owner}/${args.repo}`, pat) as {
      description: string | null;
      default_branch: string;
      topics: string[];
      stargazers_count: number;
      updated_at: string;
    };

    const treeData = await ghFetch(
      `/repos/${args.owner}/${args.repo}/git/trees/${branch}?recursive=1`,
      pat
    ) as { tree: Array<{ path: string; type: string; size?: number; sha: string }> };

    const files = treeData.tree.filter(
      (f) =>
        f.type === "blob" &&
        CONTENT_EXTENSIONS.some((ext) => f.path.endsWith(ext)) &&
        (f.size ?? 0) < MAX_FILE_SIZE
    );

    files.sort((a, b) => {
      const score = (p: string) =>
        p.toLowerCase().includes("readme") ? 0 : p.endsWith(".md") ? 1 : p.endsWith(".txt") ? 2 : 3;
      return score(a.path) - score(b.path);
    });

    let totalChars = 0;
    const fileContents: Array<{ path: string; content: string }> = [];

    for (const file of files) {
      if (totalChars >= MAX_TOTAL_CHARS) break;
      try {
        const fileData = await ghFetch(
          `/repos/${args.owner}/${args.repo}/contents/${file.path}?ref=${branch}`,
          pat
        ) as { content?: string; encoding?: string };

        if (fileData.content && fileData.encoding === "base64") {
          const decoded = Buffer.from(fileData.content.replace(/\n/g, ""), "base64").toString("utf-8");
          const truncated = decoded.slice(0, MAX_FILE_SIZE);
          fileContents.push({ path: file.path, content: truncated });
          totalChars += truncated.length;
        }
      } catch {
        // skip unreadable files
      }
    }

    const allPaths = treeData.tree
      .filter((f) => f.type === "blob")
      .map((f) => f.path)
      .slice(0, 200);

    const contentBlock = fileContents
      .map((f) => `\n--- FILE: ${f.path} ---\n${f.content}`)
      .join("\n");

    const growthContent = [
      `REPOSITORY: ${args.owner}/${args.repo}`,
      `BRANCH: ${branch}`,
      `DESCRIPTION: ${repoMeta.description ?? "none"}`,
      `LAST UPDATED: ${repoMeta.updated_at}`,
      `TOPICS: ${repoMeta.topics?.join(", ") || "none"}`,
      ``,
      `FILE TREE (${allPaths.length} files):`,
      allPaths.join("\n"),
      ``,
      `FILE CONTENTS:`,
      contentBlock,
      ``,
      `Imported ${fileContents.length} files, ${totalChars.toLocaleString()} chars.`,
    ].join("\n");

    const entryId: string = await ctx.runMutation(internal.githubDb.insertGrowthEntry, {
      title: `REPO IMPORT: ${args.owner}/${args.repo}`,
      content: growthContent.slice(0, 900000),
      tags: ["github", "repo-import", args.repo, ...(repoMeta.topics ?? [])],
    });

    return {
      success: true,
      filesImported: fileContents.length,
      totalChars,
      entryId,
      repoDescription: repoMeta.description,
    };
  },
});
