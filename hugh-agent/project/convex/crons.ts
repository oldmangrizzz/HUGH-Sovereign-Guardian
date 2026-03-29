/**
 * crons.ts — H.U.G.H. scheduled maintenance jobs
 *
 * Jobs:
 *   cleanExpiredPheromones — every 60 seconds
 *     Soft-deletes pheromones whose expiresAt has passed.
 *     Keeps the substrate clean. Audit trail preserved (evaporated=true).
 *
 * Verify in: Convex Dashboard → Logs → filter "cleanExpiredPheromones"
 */
import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval(
  "cleanExpiredPheromones",
  { seconds: 60 },
  internal.appState.cleanExpiredPheromones,
  {}
);

export default crons;
