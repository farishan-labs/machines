import type { Machine } from "./types";

export * from "./types";
export * from "./env";

export function findMachine(inventory: { machines: Machine[] }, id: string): Machine | undefined {
  return inventory.machines.find((m) => m.id === id);
}

export function machinesByRole<T extends { role: string }>(machines: T[], role: string): T[] {
  return machines.filter((m) => m.role === role);
}

export function machinesByOs<T extends { os: string }>(machines: T[], os: string): T[] {
  return machines.filter((m) => m.os === os);
}
