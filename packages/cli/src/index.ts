import { loadInventory, findMachine } from "@machines/core";
import type { Machine } from "@machines/core";

function env(): Record<string, string | undefined> {
  return process.env as Record<string, string | undefined>;
}

function printMachine(m: Machine): void {
  console.log(`${m.id}  ${m.name}`);
  console.log(`  os:     ${m.os}`);
  console.log(`  role:   ${m.role}`);
  console.log(`  host:   ${m.host}`);
  console.log(`  owner:  ${m.owner}`);
  if (m.tags && m.tags.length > 0) console.log(`  tags:   ${m.tags.join(", ")}`);
}

const args = process.argv.slice(2);
const cmd = args[0] ?? "list";

const inventory = loadInventory(env());

if (cmd === "list") {
  if (inventory.machines.length === 0) {
    console.log("No machines configured. Set MACHINES_JSON in .env");
    process.exit(0);
  }
  for (const m of inventory.machines) printMachine(m);
  if (inventory.defaultMachineId) {
    console.log(`\ndefault: ${inventory.defaultMachineId}`);
  }
} else if (cmd === "show") {
  const id = args[1];
  if (!id) {
    console.error("usage: machines show <id>");
    process.exit(1);
  }
  const m = findMachine(inventory, id);
  if (!m) {
    console.error(`machine not found: ${id}`);
    process.exit(1);
  }
  printMachine(m);
} else if (cmd === "default") {
  if (inventory.defaultMachineId) {
    console.log(inventory.defaultMachineId);
  } else {
    console.log("(none)");
  }
} else {
  console.error(`unknown command: ${cmd}`);
  console.error("commands: list, show <id>, default");
  process.exit(1);
}
