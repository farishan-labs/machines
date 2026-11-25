import { existsSync, readdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import type { Org } from "./types";

export interface MachinePluginManifest {
  name: string;
  version?: string;
  provides?: string[];
  entry?: string;
}

export interface MachinePlugin {
  name: string;
  version?: string;
  provides?: string[];
  orgs?: () => Org[];
}

function defaultPluginsDir(env: Record<string, string | undefined>): string {
  return env.MACHINES_PLUGINS_DIR ?? join(homedir(), ".config", "machines", "plugins");
}

function candidateDirs(env: Record<string, string | undefined>): string[] {
  const dirs: string[] = [];
  const fromEnv = env.MACHINES_PLUGINS;
  if (fromEnv) {
    for (const p of fromEnv.split(",")) {
      const t = p.trim();
      if (t) dirs.push(resolve(t));
    }
  }
  const base = defaultPluginsDir(env);
  if (existsSync(base)) {
    try {
      for (const name of readdirSync(base)) {
        const full = join(base, name);
        dirs.push(full);
      }
    } catch {
      // ignore
    }
  }
  return dirs;
}

function readManifest(dir: string): MachinePluginManifest | null {
  const mf = join(dir, "machines-plugin.json");
  if (!existsSync(mf)) return null;
  try {
    const raw = JSON.parse(readFileSync(mf, "utf8")) as Record<string, unknown>;
    if (typeof raw.name !== "string" || raw.name.trim() === "") return null;
    const manifest: MachinePluginManifest = { name: raw.name };
    if (typeof raw.version === "string") manifest.version = raw.version;
    if (Array.isArray(raw.provides)) manifest.provides = raw.provides.filter((x): x is string => typeof x === "string");
    if (typeof raw.entry === "string") manifest.entry = raw.entry;
    return manifest;
  } catch {
    return null;
  }
}

function entryPath(dir: string, manifest: MachinePluginManifest): string {
  if (manifest.entry) return resolve(dir, manifest.entry);
  for (const f of ["index.ts", "index.js", "index.mjs", "index.cjs"]) {
    const p = join(dir, f);
    if (existsSync(p)) return p;
  }
  return join(dir, "index.js");
}

export async function loadPlugins(env: Record<string, string | undefined>): Promise<MachinePlugin[]> {
  const out: MachinePlugin[] = [];
  const seen = new Set<string>();
  for (const dir of candidateDirs(env)) {
    if (seen.has(dir)) continue;
    seen.add(dir);
    const manifest = readManifest(dir);
    if (!manifest) continue;
    const ep = entryPath(dir, manifest);
    if (!existsSync(ep)) continue;
    try {
      const mod = (await import(`file://${ep}`)) as Record<string, unknown>;
      const cand = (mod.default ?? mod.plugin ?? mod) as Record<string, unknown>;
      const plugin: MachinePlugin = {
        name: typeof cand.name === "string" ? cand.name : manifest.name,
      };
      const v = typeof cand.version === "string" ? cand.version : manifest.version;
      if (v) plugin.version = v;
      const prov = Array.isArray(cand.provides) ? (cand.provides as string[]) : manifest.provides;
      if (prov) plugin.provides = prov;
      if (typeof cand.orgs === "function") plugin.orgs = cand.orgs as () => Org[];
      out.push(plugin);
    } catch {
      // skip broken plugins
    }
  }
  return out;
}

export function getOrgs(plugins: MachinePlugin[]): Org[] {
  for (const p of plugins) {
    if (p.provides?.includes("orgs") && typeof p.orgs === "function") {
      try {
        const r = p.orgs();
        if (Array.isArray(r)) return r;
      } catch {
        // ignore
      }
    }
  }
  return [];
}
