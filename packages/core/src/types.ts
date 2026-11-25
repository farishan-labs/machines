export type MachineOs = "linux" | "macos" | "windows" | "other" | "android" | "ios";
export type MachineRole = "personal" | "work" | "shared";

/**
 * Free-form key/value preferences for a machine (e.g. codebase locations).
 * Keys are arbitrary (e.g. org ids provided by an orgs plugin); values are paths.
 */
export type MachinePreferences = Record<string, string>;

export interface Org {
  id: string;
  name: string;
  kind?: string;
  account?: string;
  notes?: string;
}

export type TunnelBackend = "tailscale" | "ssh" | "custom" | "none";

export interface TunnelConfig {
  backend: TunnelBackend;
  target?: string;
  command?: string;
}

export interface Machine {
  id: string;
  name: string;
  os: MachineOs;
  role: MachineRole;
  host: string;
  hostname?: string;
  owner: string;
  tags?: string[];
  tunnel?: TunnelConfig;
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
