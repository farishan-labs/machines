import { describe, expect, test } from "bun:test";
import { loadInventory, parseMachinesJson } from "./env";

describe("parseMachinesJson", () => {
  test("parses valid machines", () => {
    const json = JSON.stringify([{ id: "a", name: "A", os: "linux", role: "personal", host: "h", owner: "o" }]);
    const machines = parseMachinesJson(json);
    expect(machines.length).toBe(1);
    expect(machines[0]?.id).toBe("a");
  });

  test("drops invalid entries", () => {
    const json = JSON.stringify([
      { id: "a" },
      { id: "b", name: "B", os: "linux", role: "work", host: "h", owner: "o" },
    ]);
    const machines = parseMachinesJson(json);
    expect(machines.length).toBe(1);
    expect(machines[0]?.id).toBe("b");
  });
});

describe("loadInventory", () => {
  test("reads env", () => {
    const inv = loadInventory({ MACHINES_JSON: "[]", DEFAULT_MACHINE: "x" });
    expect(inv.machines.length).toBe(0);
    expect(inv.defaultMachineId).toBe("x");
  });
});
