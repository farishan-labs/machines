import type { Machine, MachineInventory, MachineOs, MachineRole } from "./types";

const VALID_OS: MachineOs[] = ["linux", "macos", "windows", "other"];
const VALID_ROLES: MachineRole[] = ["personal", "work", "shared"];

function isMachineOs(v: unknown): v is MachineOs {
  return typeof v === "string" && (VALID_OS as string[]).includes(v);
}

function isMachineRole(v: unknown): v is MachineRole {
  return typeof v === "string" && (VALID_ROLES as string[]).includes(v);
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
  return {
    id: r.id,
    name: r.name,
    os: r.os,
    role: r.role,
    host: r.host,
    owner: r.owner,
    ...(tags !== undefined ? { tags } : {}),
  };
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

export function loadInventory(env: Record<string, string | undefined>): MachineInventory {
  const raw = env.MACHINES_JSON ?? "[]";
  const machines = parseMachinesJson(raw);
  const trimmed = env.DEFAULT_MACHINE?.trim();
  if (trimmed) {
    return { machines, defaultMachineId: trimmed };
  }
  return { machines };
}
