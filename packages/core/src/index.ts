import type { Machine, MachinePreferences } from "./types";

export * from "./env";
export * from "./types";

export function findMachine(inventory: { machines: Machine[] }, id: string): Machine | undefined {
  return inventory.machines.find((m) => m.id === id);
}

export function machinesByRole<T extends { role: string }>(machines: T[], role: string): T[] {
  return machines.filter((m) => m.role === role);
}

export function machinesByOs<T extends { os: string }>(machines: T[], os: string): T[] {
  return machines.filter((m) => m.os === os);
}

export function getPreferences(machine: Machine | undefined | null): MachinePreferences {
  if (!machine) return {};
  return machine.preferences ?? machine.prefs ?? machine.paths ?? machine.codebases ?? {};
}

export function setPreference(machine: Machine, key: string, value: string): Machine {
  const prefs = { ...getPreferences(machine), [key]: value };
  return {
    ...machine,
    preferences: prefs,
    prefs,
    paths: prefs,
    codebases: prefs,
  };
}

export function setPreferences(machine: Machine, prefs: MachinePreferences): Machine {
  const merged = { ...getPreferences(machine), ...prefs };
  return {
    ...machine,
    preferences: merged,
    prefs: merged,
    paths: merged,
    codebases: merged,
  };
}

export function removePreference(machine: Machine, key: string): Machine {
  const prefs = { ...getPreferences(machine) };
  delete prefs[key];
  return {
    ...machine,
    preferences: prefs,
    prefs,
    paths: prefs,
    codebases: prefs,
  };
}
