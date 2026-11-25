#!/usr/bin/env bun
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { hostname } from "node:os";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import type { Machine, MachinePreferences } from "@machines/core";
import {
  findMachine,
  getOrgs,
  getPreferences,
  loadInventory,
  loadPlugins,
  removePreference,
  setPreference,
} from "@machines/core";

function shellQuote(s: string): string {
  return "'" + s.replace(/'/g, "'\\''") + "'";
}

function env(): Record<string, string | undefined> {
  return process.env as Record<string, string | undefined>;
}

function prefsFile(): string {
  return process.env.PREFERENCES_FILE ?? join(homedir(), ".config", "machines", "preferences.json");
}

function loadPrefsFile(): Record<string, MachinePreferences> {
  try {
    const raw = readFileSync(prefsFile(), "utf8");
    const parsed = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return {};
    const out: Record<string, MachinePreferences> = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof v === "object" && v !== null && !Array.isArray(v)) {
        const prefs: MachinePreferences = {};
        for (const [kk, vv] of Object.entries(v as Record<string, unknown>)) {
          if (typeof vv === "string") prefs[kk] = vv;
        }
        if (Object.keys(prefs).length > 0) out[k] = prefs;
      }
    }
    return out;
  } catch {
    return {};
  }
}

function savePrefsFile(data: Record<string, MachinePreferences>): void {
  const p = prefsFile();
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

const plugins = await loadPlugins(env());

function loadOrgs(): ReturnType<typeof getOrgs> {
  return getOrgs(plugins);
}

function mergePrefs(inventory: ReturnType<typeof loadInventory>): ReturnType<typeof loadInventory> {
  const filePrefs = loadPrefsFile();
  for (const m of inventory.machines) {
    const p = filePrefs[m.id];
    if (p) {
      const merged = { ...getPreferences(m), ...p };
      m.preferences = merged;
      m.prefs = merged;
      m.paths = merged;
      m.codebases = merged;
    }
  }
  if (Object.keys(filePrefs).length > 0) {
    inventory.preferences = { ...(inventory.preferences ?? {}), ...filePrefs };
  }
  return inventory;
}

function printMachine(m: Machine): void {
  console.log(`${m.id}  ${m.name}`);
  console.log(`  os:     ${m.os}`);
  console.log(`  role:   ${m.role}`);
  console.log(`  host:   ${m.host}`);
  console.log(`  owner:  ${m.owner}`);
  if (m.tags && m.tags.length > 0) console.log(`  tags:   ${m.tags.join(", ")}`);
  const prefs = getPreferences(m);
  const orgs = loadOrgs();
  if (orgs.length > 0) {
    console.log("  orgs:");
    for (const o of orgs) console.log(`    ${o.id} (${o.name}): ${prefs[o.id] ?? "(unset)"}`);
  } else if (Object.keys(prefs).length > 0) {
    console.log("  preferences:");
    for (const [k, v] of Object.entries(prefs)) console.log(`    ${k}: ${v}`);
  }
}

function printPrefs(id: string, prefs: MachinePreferences): void {
  console.log(id);
  if (Object.keys(prefs).length === 0) {
    console.log("  (no preferences set)");
    return;
  }
  for (const [k, v] of Object.entries(prefs)) console.log(`  ${k}: ${v}`);
}

const args = process.argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith("--")));
const positional = args.filter((a) => !a.startsWith("--"));
const cmd = positional[0] ?? "list";
const jsonFlag = flags.has("--json");
const plainFlag = flags.has("--plain");

const inventory = mergePrefs(loadInventory(env()));

if (cmd === "list") {
  if (inventory.machines.length === 0) {
    console.log("No machines configured. Set MACHINES_JSON in .env");
    process.exit(0);
  }
  if (jsonFlag) {
    console.log(JSON.stringify(inventory, null, 2));
    process.exit(0);
  }
  if (plainFlag) {
    for (const m of inventory.machines) {
      console.log(`${m.id}\t${m.name}\t${m.os}\t${m.role}`);
    }
    process.exit(0);
  }
  for (const m of inventory.machines) printMachine(m);
  if (inventory.defaultMachineId) {
    console.log(`\ndefault: ${inventory.defaultMachineId}`);
  }
} else if (cmd === "show") {
  const id = positional[1];
  if (!id) {
    console.error("usage: machines show <id>");
    process.exit(1);
  }
  const m = findMachine(inventory, id);
  if (!m) {
    console.error(`machine not found: ${id}`);
    process.exit(1);
  }
  if (jsonFlag) {
    console.log(JSON.stringify(m, null, 2));
    process.exit(0);
  }
  if (plainFlag) {
    console.log(`${m.id}\t${m.name}\t${m.os}\t${m.role}`);
    process.exit(0);
  }
  printMachine(m);
} else if (cmd === "whoami") {
  const hn = hostname().toLowerCase();
  const m = inventory.machines.find(
    (x) => (x.host ?? "").toLowerCase() === hn || (x.hostname ?? "").toLowerCase() === hn,
  );
  console.log(m ? m.id : "(unknown)");
} else if (cmd === "default") {
  if (inventory.defaultMachineId) {
    console.log(inventory.defaultMachineId);
  } else {
    console.log("(none)");
  }
} else if (cmd === "prefs" || cmd === "preferences") {
  const sub = args[1];
  if (sub === "set") {
    const id = args[2];
    const key = args[3];
    const value = args[4];
    if (!id || !key || value === undefined) {
      console.error("usage: machines prefs set <id> <key> <value>");
      process.exit(1);
    }
    const m = findMachine(inventory, id);
    if (!m) {
      console.error(`machine not found: ${id}`);
      process.exit(1);
    }
    const updated = setPreference(m, key, value);
    const filePrefs = loadPrefsFile();
    filePrefs[id] = { ...(filePrefs[id] ?? {}), [key]: value };
    savePrefsFile(filePrefs);
    printPrefs(id, getPreferences(updated));
  } else if (sub === "unset" || sub === "remove" || sub === "delete") {
    const id = args[2];
    const key = args[3];
    if (!id || !key) {
      console.error("usage: machines prefs unset <id> <key>");
      process.exit(1);
    }
    const m = findMachine(inventory, id);
    if (!m) {
      console.error(`machine not found: ${id}`);
      process.exit(1);
    }
    const filePrefs = loadPrefsFile();
    if (filePrefs[id]) {
      delete filePrefs[id][key];
      if (Object.keys(filePrefs[id]).length === 0) delete filePrefs[id];
      savePrefsFile(filePrefs);
    }
    const updated = removePreference(m, key);
    printPrefs(id, getPreferences(updated));
  } else if (sub === "list" || sub === "all") {
    for (const m of inventory.machines) printPrefs(m.id, getPreferences(m));
  } else {
    // treat sub as machine id
    const id = sub;
    if (!id) {
      for (const m of inventory.machines) printPrefs(m.id, getPreferences(m));
      process.exit(0);
    }
    const m = findMachine(inventory, id);
    if (!m) {
      console.error(`machine not found: ${id}`);
      process.exit(1);
    }
    printPrefs(id, getPreferences(m));
  }
} else if (cmd === "orgs") {
  const orgs = loadOrgs();
  if (orgs.length === 0) {
    console.log("No orgs found. Set ORGS_FILE or create ~/dev/labs/user-md/orgs.json");
    process.exit(0);
  }
  for (const o of orgs) console.log(`${o.id}  ${o.name}${o.kind ? `  (${o.kind})` : ""}`);
} else if (cmd === "check" || cmd === "ping") {
  const targetId = positional[1];
  const toCheck = targetId ? [targetId] : inventory.machines.map((m) => m.id);
  const results: any[] = [];
  for (const id of toCheck) {
    const m = findMachine(inventory, id);
    if (!m) {
      results.push({ id, reachable: false, error: "machine not found" });
      continue;
    }
    const backend = m.tunnel?.backend ?? "ssh";
    const target = m.tunnel?.target ?? m.host;
    const start = Date.now();
    let reachable = false;
    let ip: string | undefined;
    let error: string | undefined;
    try {
      if (backend === "none") {
        reachable = true;
      } else if (backend === "tailscale") {
        const out = execSync(`tailscale ping --c 1 ${shellQuote(target)}`, { timeout: 10000, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
        reachable = true;
        const m2 = out.match(/\(([\d.]+)\)/);
        if (m2) ip = m2[1];
      } else if (backend === "ssh") {
        execSync(`ssh -o BatchMode=yes -o ConnectTimeout=5 ${shellQuote(target)} true`, { timeout: 10000, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
        reachable = true;
      } else if (backend === "custom") {
        const cmdStr = (m.tunnel?.command ?? "").replace(/\{target\}/g, target);
        execSync(cmdStr, { timeout: 10000, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], shell: "/bin/sh" });
        reachable = true;
      } else {
        error = `unknown backend: ${backend}`;
      }
    } catch (e: any) {
      reachable = false;
      error = (e?.stderr || e?.message || String(e)).toString().trim().slice(0, 200);
    }
    const latency = Date.now() - start;
    results.push({
      id: m.id,
      name: m.name,
      backend,
      target,
      reachable,
      ...(ip ? { ip } : {}),
      latency_ms: reachable ? latency : undefined,
      ...(error ? { error } : {}),
    });
  }
  if (jsonFlag) {
    console.log(JSON.stringify(results.length === 1 && targetId ? results[0] : results, null, 2));
    process.exit(0);
  }
  for (const r of results) {
    const status = r.reachable ? "OK" : "FAIL";
    console.log(`${r.id}: ${status} (${r.backend} -> ${r.target})${r.latency_ms !== undefined ? ` ${r.latency_ms}ms` : ""}${r.ip ? ` ip=${r.ip}` : ""}${r.error ? ` - ${r.error}` : ""}`);
  }
} else if (cmd === "doctor") {
  console.log(`machines file: ${process.env.MACHINES_FILE ?? "(default ~/.config/machines/machines.json)"}`);
  console.log(`machines: ${inventory.machines.length}`);
  console.log(`default: ${inventory.defaultMachineId ?? "(none)"}`);
  console.log(`whoami: ${(() => {
    const hn = hostname().toLowerCase();
    const m = inventory.machines.find((x) => (x.host ?? "").toLowerCase() === hn || (x.hostname ?? "").toLowerCase() === hn);
    return m ? m.id : "(unknown)";
  })()}`);
  console.log(`plugins: ${process.env.MACHINES_PLUGINS_DIR ?? "(default ~/.config/machines/plugins)"}`);
} else {
  console.error(`unknown command: ${cmd}`);
  console.error("commands: list, show <id>, whoami, default, prefs [id|set|unset|list], orgs, doctor, check [id]");
  process.exit(1);
}
