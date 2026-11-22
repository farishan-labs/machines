import { invoke } from "@tauri-apps/api/core";
import { useEffect, useState } from "react";
import { emptyMachine, type Machine } from "./types";
import "./App.css";

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="field">
      <span>{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

export default function App() {
  const [machines, setMachines] = useState<Machine[]>([]);
  const [editing, setEditing] = useState<Machine | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [collectHost, setCollectHost] = useState("");
  const [collecting, setCollecting] = useState(false);
  const [error, setError] = useState("");

  const refresh = async () => {
    try {
      const list = await invoke<Machine[]>("list_machines");
      setMachines(list);
    } catch (e) {
      setError(String(e));
    }
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: run once on mount
  useEffect(() => {
    refresh();
  }, []);

  const startNew = () => {
    setEditing(emptyMachine());
    setIsNew(true);
  };

  const startEdit = (m: Machine) => {
    setEditing({ ...m });
    setIsNew(false);
  };

  const cancel = () => {
    setEditing(null);
    setIsNew(false);
  };

  const save = async () => {
    if (!editing) return;
    try {
      if (isNew) {
        await invoke("create_machine", { m: editing });
      } else {
        await invoke("update_machine", { m: editing });
      }
      setEditing(null);
      setIsNew(false);
      await refresh();
    } catch (e) {
      setError(String(e));
    }
  };

  const remove = async (id?: number) => {
    if (!id) return;
    if (!confirm("Delete this machine?")) return;
    try {
      await invoke("delete_machine", { id });
      await refresh();
    } catch (e) {
      setError(String(e));
    }
  };

  const collect = async () => {
    if (!collectHost.trim()) return;
    setCollecting(true);
    setError("");
    try {
      const m = await invoke<Machine>("collect_machine", { host: collectHost.trim() });
      setEditing(m);
      setIsNew(true);
    } catch (e) {
      setError(String(e));
    } finally {
      setCollecting(false);
    }
  };

  const setField = (k: keyof Machine, v: string) => {
    if (!editing) return;
    setEditing({ ...editing, [k]: v });
  };

  return (
    <main className="container">
      <h1>Machines</h1>
      {error && <div className="error">{error}</div>}

      {!editing && (
        <>
          <div className="toolbar">
            <button type="button" onClick={startNew}>
              + New machine
            </button>
            <div className="collect">
              <input
                placeholder="ssh host (e.g. vps) or 'local'"
                value={collectHost}
                onChange={(e) => setCollectHost(e.target.value)}
              />
              <button type="button" onClick={collect} disabled={collecting}>
                {collecting ? "Collecting…" : "Auto-collect via SSH"}
              </button>
            </div>
          </div>

          <table className="list">
            <thead>
              <tr>
                <th>Name</th>
                <th>Host</th>
                <th>Hardware model</th>
                <th>OS</th>
                <th>Memory</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {machines.map((m) => (
                <tr key={m.id}>
                  <td>{m.name}</td>
                  <td>{m.host}</td>
                  <td>{m.hardware_model}</td>
                  <td>{m.os_name}</td>
                  <td>{m.memory}</td>
                  <td className="actions">
                    <button type="button" onClick={() => startEdit(m)}>
                      Edit
                    </button>
                    <button type="button" className="danger" onClick={() => remove(m.id)}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {machines.length === 0 && (
                <tr>
                  <td colSpan={6} className="empty">
                    No machines yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </>
      )}

      {editing && (
        <div className="form">
          <h2>{isNew ? "New machine" : "Edit machine"}</h2>
          <div className="grid">
            <Field label="Name" value={editing.name} onChange={(v) => setField("name", v)} />
            <Field label="Host (SSH)" value={editing.host} onChange={(v) => setField("host", v)} />
            <Field
              label="Hardware vendor"
              value={editing.hardware_vendor}
              onChange={(v) => setField("hardware_vendor", v)}
            />
            <Field
              label="Hardware model"
              value={editing.hardware_model}
              onChange={(v) => setField("hardware_model", v)}
            />
            <Field label="Processor" value={editing.processor} onChange={(v) => setField("processor", v)} />
            <Field label="Memory" value={editing.memory} onChange={(v) => setField("memory", v)} />
            <Field label="Graphics" value={editing.graphics} onChange={(v) => setField("graphics", v)} />
            <Field label="Disk capacity" value={editing.disk_capacity} onChange={(v) => setField("disk_capacity", v)} />
            <Field label="OS name" value={editing.os_name} onChange={(v) => setField("os_name", v)} />
            <Field label="OS type" value={editing.os_type} onChange={(v) => setField("os_type", v)} />
            <Field label="GNOME version" value={editing.gnome_version} onChange={(v) => setField("gnome_version", v)} />
            <Field
              label="Windowing system"
              value={editing.windowing_system}
              onChange={(v) => setField("windowing_system", v)}
            />
            <Field label="Kernel" value={editing.kernel} onChange={(v) => setField("kernel", v)} />
            <Field label="Notes" value={editing.notes} onChange={(v) => setField("notes", v)} />
          </div>
          <div className="toolbar">
            <button type="button" onClick={save}>
              Save
            </button>
            <button type="button" className="secondary" onClick={cancel}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
