/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as analyses from "../analyses.js";
import type * as analysisActions from "../analysisActions.js";
import type * as analysisHelpers from "../analysisHelpers.js";
import type * as artifacts from "../artifacts.js";
import type * as audioActions from "../audioActions.js";
import type * as auth from "../auth.js";
import type * as focus from "../focus.js";
import type * as http from "../http.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_customFunctions from "../lib/customFunctions.js";
import type * as messages from "../messages.js";
import type * as migrations from "../migrations.js";
import type * as observations from "../observations.js";
import type * as personas from "../personas.js";
import type * as perspectives from "../perspectives.js";
import type * as processState from "../processState.js";
import type * as processes from "../processes.js";
import type * as projectHelpers from "../projectHelpers.js";
import type * as projects from "../projects.js";
import type * as scholars from "../scholars.js";
import type * as seed from "../seed.js";
import type * as units from "../units.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  analyses: typeof analyses;
  analysisActions: typeof analysisActions;
  analysisHelpers: typeof analysisHelpers;
  artifacts: typeof artifacts;
  audioActions: typeof audioActions;
  auth: typeof auth;
  focus: typeof focus;
  http: typeof http;
  "lib/auth": typeof lib_auth;
  "lib/customFunctions": typeof lib_customFunctions;
  messages: typeof messages;
  migrations: typeof migrations;
  observations: typeof observations;
  personas: typeof personas;
  perspectives: typeof perspectives;
  processState: typeof processState;
  processes: typeof processes;
  projectHelpers: typeof projectHelpers;
  projects: typeof projects;
  scholars: typeof scholars;
  seed: typeof seed;
  units: typeof units;
  users: typeof users;
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

export declare const components: {
  persistentTextStreaming: {
    lib: {
      addChunk: FunctionReference<
        "mutation",
        "internal",
        { final: boolean; streamId: string; text: string },
        any
      >;
      createStream: FunctionReference<"mutation", "internal", {}, any>;
      getStreamStatus: FunctionReference<
        "query",
        "internal",
        { streamId: string },
        "pending" | "streaming" | "done" | "error" | "timeout"
      >;
      getStreamText: FunctionReference<
        "query",
        "internal",
        { streamId: string },
        {
          status: "pending" | "streaming" | "done" | "error" | "timeout";
          text: string;
        }
      >;
      setStreamStatus: FunctionReference<
        "mutation",
        "internal",
        {
          status: "pending" | "streaming" | "done" | "error" | "timeout";
          streamId: string;
        },
        any
      >;
    };
  };
};
