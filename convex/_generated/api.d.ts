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
import type * as analysisHelpers from "../analysisHelpers.js";
import type * as artifacts from "../artifacts.js";
import type * as audioActions from "../audioActions.js";
import type * as auth from "../auth.js";
import type * as crossDomainConnections from "../crossDomainConnections.js";
import type * as curriculumAssistant from "../curriculumAssistant.js";
import type * as dossier from "../dossier.js";
import type * as files from "../files.js";
import type * as focus from "../focus.js";
import type * as http from "../http.js";
import type * as lessons from "../lessons.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_customFunctions from "../lib/customFunctions.js";
import type * as masteryObservations from "../masteryObservations.js";
import type * as messages from "../messages.js";
import type * as observations from "../observations.js";
import type * as observer from "../observer.js";
import type * as personas from "../personas.js";
import type * as perspectives from "../perspectives.js";
import type * as processState from "../processState.js";
import type * as processes from "../processes.js";
import type * as projectHelpers from "../projectHelpers.js";
import type * as projects from "../projects.js";
import type * as prompts from "../prompts.js";
import type * as reports from "../reports.js";
import type * as scholars from "../scholars.js";
import type * as seed from "../seed.js";
import type * as seeds from "../seeds.js";
import type * as sessionSignals from "../sessionSignals.js";
import type * as standardsImport from "../standardsImport.js";
import type * as standardsImportHelpers from "../standardsImportHelpers.js";
import type * as standardsMapper from "../standardsMapper.js";
import type * as standardsTree from "../standardsTree.js";
import type * as teacherMasteryOverrides from "../teacherMasteryOverrides.js";
import type * as tokens from "../tokens.js";
import type * as units from "../units.js";
import type * as users from "../users.js";
import type * as youtubeActions from "../youtubeActions.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  analyses: typeof analyses;
  analysisHelpers: typeof analysisHelpers;
  artifacts: typeof artifacts;
  audioActions: typeof audioActions;
  auth: typeof auth;
  crossDomainConnections: typeof crossDomainConnections;
  curriculumAssistant: typeof curriculumAssistant;
  dossier: typeof dossier;
  files: typeof files;
  focus: typeof focus;
  http: typeof http;
  lessons: typeof lessons;
  "lib/auth": typeof lib_auth;
  "lib/customFunctions": typeof lib_customFunctions;
  masteryObservations: typeof masteryObservations;
  messages: typeof messages;
  observations: typeof observations;
  observer: typeof observer;
  personas: typeof personas;
  perspectives: typeof perspectives;
  processState: typeof processState;
  processes: typeof processes;
  projectHelpers: typeof projectHelpers;
  projects: typeof projects;
  prompts: typeof prompts;
  reports: typeof reports;
  scholars: typeof scholars;
  seed: typeof seed;
  seeds: typeof seeds;
  sessionSignals: typeof sessionSignals;
  standardsImport: typeof standardsImport;
  standardsImportHelpers: typeof standardsImportHelpers;
  standardsMapper: typeof standardsMapper;
  standardsTree: typeof standardsTree;
  teacherMasteryOverrides: typeof teacherMasteryOverrides;
  tokens: typeof tokens;
  units: typeof units;
  users: typeof users;
  youtubeActions: typeof youtubeActions;
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
