export type MachineOs = "linux" | "macos" | "windows" | "other";
export type MachineRole = "personal" | "work" | "shared";

/**
 * Free-form key/value preferences for a machine (e.g. codebase locations).
 * Keys are arbitrary (e.g. "personal", "work", "xs", "fhl"); values are paths.
 */
export type MachinePreferences = Record<string, string>;

export interface Org {
  id: string;
  name: string;
  kind?: string;
  account?: string;
  notes?: string;
}

export interface Machine {
  id: string;
  name: string;
  os: MachineOs;
  role: MachineRole;
  host: string;
  owner: string;
  tags?: string[];
  preferences?: MachinePreferences;
  // aliases for convenience / compatibility
  prefs?: MachinePreferences;
  paths?: MachinePreferences;
  codebases?: MachinePreferences;
}

export interface MachinePlan {
  machineId: string;
  mode: MachineRole;
  notes?: string;
  preferences?: MachinePreferences;
}

export interface MachineInventory {
  machines: Machine[];
  defaultMachineId?: string;
  preferences?: Record<string, MachinePreferences>;
}
