import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { Machine, MachineInventory, MachineOs, MachinePreferences, MachineRole, Org } from "./types";

const VALID_OS: MachineOs[] = ["linux", "macos", "windows", "other", "android", "ios"];
const VALID_ROLES: MachineRole[] = ["personal", "work", "shared"];

const PREF_KEYS = ["preferences", "prefs", "paths", "codebases"] as const;

function isMachineOs(v: unknown): v is MachineOs {
  return typeof v === "string" && (VALID_OS as string[]).includes(v);
}

function isMachineRole(v: unknown): v is MachineRole {
  return typeof v === "string" && (VALID_ROLES as string[]).includes(v);
}

function parsePreferences(raw: unknown): MachinePreferences | undefined {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return undefined;
  const out: MachinePreferences = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v === "string") out[k] = v;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

function extractPreferences(r: Record<string, unknown>): MachinePreferences | undefined {
  for (const key of PREF_KEYS) {
    const p = parsePreferences(r[key]);
    if (p) return p;
  }
  return undefined;
}

function parseMachine(raw: unknown): Machine | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.id !== "string" || r.id.trim() === "") return null;
  if (typeof r.name !== "string" || r.name.trim() === "") return null;
  if (!isMachineOs(r.os)) return null;
  if (!isMachineRole(r.role)) return null;
  if (typeof r.host !== "string") return null;
  if (typeof r.owner !== "string") return null;
  const tags = Array.isArray(r.tags) ? r.tags.filter((t): t is string => typeof t === "string") : undefined;
  const hostname = typeof r.hostname === "string" ? r.hostname : undefined;
  const preferences = extractPreferences(r);
  const machine: Machine = {
    id: r.id,
    name: r.name,
    os: r.os,
    role: r.role,
    host: r.host,
    ...(hostname !== undefined ? { hostname } : {}),
    owner: r.owner,
    ...(tags !== undefined ? { tags } : {}),
    ...(preferences !== undefined
      ? { preferences, prefs: preferences, paths: preferences, codebases: preferences }
      : {}),
  };
  return machine;
}

export function parseMachinesJson(json: string): Machine[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  const out: Machine[] = [];
  for (const entry of parsed) {
    const m = parseMachine(entry);
    if (m) out.push(m);
  }
  return out;
}

function parsePreferencesMap(raw: unknown): Record<string, MachinePreferences> | undefined {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return undefined;
  const out: Record<string, MachinePreferences> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const p = parsePreferences(v);
    if (p) out[k] = p;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

export function loadInventory(env: Record<string, string | undefined>): MachineInventory {
  let raw: string;
  if (env.MACHINES_JSON !== undefined) {
    raw = env.MACHINES_JSON;
  } else {
    const filePath = env.MACHINES_FILE ?? join(homedir(), ".config", "machines", "machines.json");
    try {
      raw = readFileSync(filePath, "utf8");
    } catch {
      raw = "[]";
    }
  }
  const machines = parseMachinesJson(raw);
  const trimmed = env.DEFAULT_MACHINE?.trim();

  // Optional separate preferences map: PREFERENCES_JSON='{"thinkpad":{"personal":"~/dev"}}'
  let prefsMap: Record<string, MachinePreferences> | undefined;
  if (env.PREFERENCES_JSON) {
    try {
      prefsMap = parsePreferencesMap(JSON.parse(env.PREFERENCES_JSON));
    } catch {
      prefsMap = undefined;
    }
  }

  if (prefsMap) {
    for (const m of machines) {
      const p = prefsMap[m.id];
      if (p) {
        m.preferences = { ...(m.preferences ?? {}), ...p };
        m.prefs = m.preferences;
        m.paths = m.preferences;
        m.codebases = m.preferences;
      }
    }
  }

  const inventory: MachineInventory = { machines };
  if (trimmed) inventory.defaultMachineId = trimmed;
  if (prefsMap) inventory.preferences = prefsMap;
  return inventory;
}

export function parseOrgsJson(json: string): Org[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  const out: Org[] = [];
  for (const entry of parsed) {
    if (typeof entry !== "object" || entry === null) continue;
    const r = entry as Record<string, unknown>;
    if (typeof r.id !== "string" || r.id.trim() === "") continue;
    if (typeof r.name !== "string" || r.name.trim() === "") continue;
    const org: Org = { id: r.id, name: r.name };
    if (typeof r.kind === "string") org.kind = r.kind;
    if (typeof r.account === "string") org.account = r.account;
    if (typeof r.notes === "string") org.notes = r.notes;
    out.push(org);
  }
  return out;
}
