/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as adminAuth from "../adminAuth.js";
import type * as agentRegistry from "../agentRegistry.js";
import type * as appState from "../appState.js";
import type * as audioConfig from "../audioConfig.js";
import type * as auth from "../auth.js";
import type * as browser from "../browser.js";
import type * as crons from "../crons.js";
import type * as deepgram from "../deepgram.js";
import type * as endocrine from "../endocrine.js";
import type * as github from "../github.js";
import type * as githubDb from "../githubDb.js";
import type * as growth from "../growth.js";
import type * as http from "../http.js";
import type * as hugh from "../hugh.js";
import type * as kvm from "../kvm.js";
import type * as kvmDb from "../kvmDb.js";
import type * as livekit from "../livekit.js";
import type * as mcp from "../mcp.js";
import type * as memory from "../memory.js";
import type * as openai from "../openai.js";
import type * as router from "../router.js";
import type * as standby from "../standby.js";
import type * as stigmergy from "../stigmergy.js";
import type * as tacticalMap from "../tacticalMap.js";
import type * as vault from "../vault.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  adminAuth: typeof adminAuth;
  agentRegistry: typeof agentRegistry;
  appState: typeof appState;
  audioConfig: typeof audioConfig;
  auth: typeof auth;
  browser: typeof browser;
  crons: typeof crons;
  deepgram: typeof deepgram;
  endocrine: typeof endocrine;
  github: typeof github;
  githubDb: typeof githubDb;
  growth: typeof growth;
  http: typeof http;
  hugh: typeof hugh;
  kvm: typeof kvm;
  kvmDb: typeof kvmDb;
  livekit: typeof livekit;
  mcp: typeof mcp;
  memory: typeof memory;
  openai: typeof openai;
  router: typeof router;
  standby: typeof standby;
  stigmergy: typeof stigmergy;
  tacticalMap: typeof tacticalMap;
  vault: typeof vault;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
