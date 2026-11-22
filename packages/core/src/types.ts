export type MachineOs = "linux" | "macos" | "windows" | "other";
export type MachineRole = "personal" | "work" | "shared";

export interface Machine {
  id: string;
  name: string;
  os: MachineOs;
  role: MachineRole;
  host: string;
  owner: string;
  tags?: string[];
}

export interface MachinePlan {
  machineId: string;
  mode: MachineRole;
  notes?: string;
}

export interface MachineInventory {
  machines: Machine[];
  defaultMachineId?: string;
}
