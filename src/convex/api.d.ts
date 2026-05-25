/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as analytics from "../analytics.js";
import type * as blacklist from "../blacklist.js";
import type * as bookingRules from "../bookingRules.js";
import type * as checkInSettings from "../checkInSettings.js";
import type * as departments from "../departments.js";
import type * as http from "../http.js";
import type * as invites from "../invites.js";
import type * as messages from "../messages.js";
import type * as notifications from "../notifications.js";
import type * as orgSettings from "../orgSettings.js";
import type * as scheduling from "../scheduling.js";
import type * as settings from "../settings.js";
import type * as staff from "../staff.js";
import type * as superadmin from "../superadmin.js";
import type * as users from "../users.js";
import type * as visitors from "../visitors.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  analytics: typeof analytics;
  blacklist: typeof blacklist;
  bookingRules: typeof bookingRules;
  checkInSettings: typeof checkInSettings;
  departments: typeof departments;
  http: typeof http;
  invites: typeof invites;
  messages: typeof messages;
  notifications: typeof notifications;
  orgSettings: typeof orgSettings;
  scheduling: typeof scheduling;
  settings: typeof settings;
  staff: typeof staff;
  superadmin: typeof superadmin;
  users: typeof users;
  visitors: typeof visitors;
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
