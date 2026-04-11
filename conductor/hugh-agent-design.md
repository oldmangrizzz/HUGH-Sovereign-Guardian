# H.U.G.H. — Holographic Satellite Node Design (hugh-agent)

This plan outlines the design and implementation of the **`hugh-agent`**—an npm-packaged CLI tool designed to act as a "Holographic Satellite Node" for the H.U.G.H. infrastructure. It provides a secure, portable, and self-repairing bridge between H.U.G.H. (the central intelligence on Convex) and your various lab environments (local WAN, VPS, Proxmox VMs).

## 1. Objective
Create a portable `npm` package that can be deployed instantly to any node. It will handle its own secure connection (Cloudflare Tunnel), execute commands issued by H.U.G.H., and support a "self-repair" mechanism for architectural updates.

## 2. Key Files & Context
- **`hugh-agent/`**: A new root directory for this package.
- **`package.json`**: NPM package configuration, defining the `hugh-agent` CLI command.
- **`server.js`**: The core HTTP bridge (Node.js ≥ 18).
- **`tunnel.js`**: Spontaneous Cloudflare Tunnel manager.
- **`updater.js`**: Self-repair and architecture synchronization logic.

## 3. Implementation Steps

### Phase 1: Package Scaffolding
- Initialize a new `npm` package in the `hugh-agent/` directory.
- Set up a CLI entry point so you can run it via `npm install -g hugh-agent` or `npx hugh-agent`.
- Define dependencies: `axios` (for H.U.G.H. comms), `dotenv` (for secrets), and `child_process` (for shell bridge).

### Phase 2: The Core Bridge (The "Remote Control")
- Port the `server.js` logic from the spec sheet into the package.
- Implement the `/exec`, `/ping`, and `/info` endpoints.
- **Security:** Ensure it binds to `127.0.0.1` and strictly validates the `X-Agent-Secret`.

### Phase 3: Spontaneous Tunneling (The "Hologram")
- Implement a `tunnel.js` module that checks for `cloudflared`.
- Add logic to automatically create an ephemeral or persistent tunnel on `GrizzlyMedicine.ICU`.
- Support your Cloudflare API credentials for automatic subdomain creation.

### Phase 4: Self-Repair (The "Fabrication")
- Implement an `updater.js` module that allows H.U.G.H. to trigger its own updates.
- Add a mechanism for the agent to pull latest architectural changes or "fix its own pieces" as directed by the central intelligence.

## 4. Coordination with H.U.G.H. (Convex Agent)
To ensure we build this "bridge" correctly, I have one critical question for the **`chef.convex.dev`** agent:

> **Question for Convex:** "How does the `kvmCommandLog` table currently handle multi-node routing? Specifically, for the new `hugh-agent` satellite nodes, is there an existing mechanism in Convex to dynamically register new `KVM_AGENT_URL` endpoints when a 'spontaneous' tunnel is created, or should the agent report its new URL back to a 'registry' table upon startup?"

---

### Verification & Testing
- **Local Test:** Run `hugh-agent --secret test` and verify `curl localhost:7734/ping`.
- **Tunnel Test:** Verify the agent successfully requests a tunnel and prints a reachable URL.
- **H.U.G.H. Test:** Issue a test command from the Convex console and verify the log entry in `kvmCommandLog`.

---

### Next Steps
1. **Approval:** Does this architectural plan for the `hugh-agent` package look correct to you?
2. **Mailman:** Once you're ready, please pass the question above to the Convex agent and let me know what they say.
