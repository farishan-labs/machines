import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import type { MachinePreferences } from "@machines/core";
import { getPreferences, loadInventory, parseOrgsJson } from "@machines/core";

const port = Number(process.env.PORT ?? "7778");
const host = process.env.HOST ?? "127.0.0.1";

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

function orgsFile(): string {
  return (
    process.env.ORGS_FILE ?? process.env.USER_MD_ORGS_FILE ?? join(homedir(), "dev", "labs", "user-md", "orgs.json")
  );
}

function loadOrgs(): ReturnType<typeof parseOrgsJson> {
  try {
    return parseOrgsJson(readFileSync(orgsFile(), "utf8"));
  } catch {
    return [];
  }
}

function mergePrefs(inv: ReturnType<typeof loadInventory>): ReturnType<typeof loadInventory> {
  const filePrefs = loadPrefsFile();
  for (const m of inv.machines) {
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
    inv.preferences = { ...(inv.preferences ?? {}), ...filePrefs };
  }
  return inv;
}

function getInventory() {
  return mergePrefs(loadInventory(process.env as Record<string, string | undefined>));
}

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Machines</title>
<style>
  body { font-family: system-ui, sans-serif; margin: 2rem; }
  .card { border: 1px solid #ddd; border-radius: 8px; padding: 1rem; margin-bottom: 1rem; }
  .meta { color: #555; font-size: 0.9rem; }
  .prefs { margin-top: 0.5rem; }
  .pref { display: flex; align-items: center; gap: 0.5rem; margin: 0.25rem 0; font-size: 0.9rem; }
  .pref-key { font-weight: 600; }
  .pref-val { color: #333; }
  .pref button { cursor: pointer; }
  .addpref { display: flex; gap: 0.5rem; margin-top: 0.5rem; flex-wrap: wrap; }
  .addpref input { padding: 0.25rem 0.5rem; }
  .error { color: #c00; margin: 0.5rem 0; }
</style>
</head>
<body>
  <h1>Machines</h1>
  <div id="error" class="error"></div>
  <div id="list"></div>
  <script>
    async function load() {
      const [mRes, oRes] = await Promise.all([fetch('/api/machines'), fetch('/api/orgs')]);
      const d = await mRes.json();
      const orgs = await oRes.json();
      const el = document.getElementById('list');
      el.innerHTML = '';
      for (const m of d.machines) {
        const div = document.createElement('div');
        div.className = 'card';
        const prefs = m.preferences || m.prefs || m.paths || m.codebases || {};
        let prefsHtml = '<div class="prefs">';
        const orgList = (orgs && orgs.length) ? orgs : Object.keys(prefs).map(k=>({id:k,name:k}));
        for (const o of orgList) {
          const val = prefs[o.id] || '';
          prefsHtml += '<div class="pref"><span class="pref-key">'+o.name+':</span><input data-id="'+m.id+'" data-key="'+o.id+'" class="orgval" value="'+val+'" placeholder="path" /><button data-id="'+m.id+'" data-key="'+o.id+'" class="saveorg">Save</button></div>';
        }
        // also show any prefs not in orgs
        for (const [k, v] of Object.entries(prefs)) {
          if (!orgList.some(o=>o.id===k)) {
            prefsHtml += '<div class="pref"><span class="pref-key">'+k+':</span><span class="pref-val">'+v+'</span><button data-id="'+m.id+'" data-key="'+k+'" class="del">✕</button></div>';
          }
        }
        prefsHtml += '</div>';
        prefsHtml += '<div class="addpref"><input placeholder="key" class="k" /><input placeholder="value (path)" class="v" /><button class="add" data-id="'+m.id+'">Add</button></div>';
        div.innerHTML = '<strong>'+m.name+'</strong> ('+m.id+')<div class="meta">'+m.os+' · '+m.role+' · '+m.host+' · '+m.owner+'</div>'+prefsHtml;
        el.appendChild(div);
      }
      // wire save org
      document.querySelectorAll('.saveorg').forEach(btn => {
        btn.addEventListener('click', async () => {
          const id = btn.dataset.id; const key = btn.dataset.key;
          const card = btn.closest('.card');
          const input = card.querySelector('input.orgval[data-key="'+key+'"]');
          const value = input.value.trim();
          if (!value) return;
          await fetch('/api/prefs', { method: 'POST', headers: {'content-type':'application/json'}, body: JSON.stringify({ id, key, value }) });
          load();
        });
      });
      if (d.defaultMachineId) {
        const p = document.createElement('p');
        p.textContent = 'default: ' + d.defaultMachineId;
        el.appendChild(p);
      }
      // wire delete
      document.querySelectorAll('.del').forEach(btn => {
        btn.addEventListener('click', async () => {
          const id = btn.dataset.id; const key = btn.dataset.key;
          await fetch('/api/prefs', { method: 'DELETE', headers: {'content-type':'application/json'}, body: JSON.stringify({ id, key }) });
          load();
        });
      });
      // wire add
      document.querySelectorAll('.add').forEach(btn => {
        btn.addEventListener('click', async () => {
          const id = btn.dataset.id;
          const card = btn.closest('.card');
          const k = card.querySelector('.k').value.trim();
          const v = card.querySelector('.v').value.trim();
          if (!k || !v) return;
          await fetch('/api/prefs', { method: 'POST', headers: {'content-type':'application/json'}, body: JSON.stringify({ id, key: k, value: v }) });
          load();
        });
      });
    }
    load();
  </script>
</body>
</html>`;

const server = Bun.serve({
  port,
  hostname: host,
  async fetch(req) {
    const url = new URL(req.url);
    if (url.pathname === "/api/machines") {
      return new Response(JSON.stringify(getInventory()), {
        headers: { "content-type": "application/json" },
      });
    }
    if (url.pathname === "/api/orgs") {
      return new Response(JSON.stringify(loadOrgs()), {
        headers: { "content-type": "application/json" },
      });
    }
    if (url.pathname === "/api/prefs") {
      try {
        const body = (await req.json()) as { id?: string; key?: string; value?: string };
        const id = body.id;
        if (!id)
          return new Response(JSON.stringify({ error: "missing id" }), {
            status: 400,
            headers: { "content-type": "application/json" },
          });
        const filePrefs = loadPrefsFile();
        if (req.method === "DELETE") {
          if (body.key && filePrefs[id]) {
            delete filePrefs[id][body.key];
            if (Object.keys(filePrefs[id]).length === 0) delete filePrefs[id];
            savePrefsFile(filePrefs);
          }
        } else if (req.method === "POST") {
          if (!body.key || body.value === undefined) {
            return new Response(JSON.stringify({ error: "missing key/value" }), {
              status: 400,
              headers: { "content-type": "application/json" },
            });
          }
          filePrefs[id] = { ...(filePrefs[id] ?? {}), [body.key]: body.value };
          savePrefsFile(filePrefs);
        }
        return new Response(JSON.stringify({ ok: true }), { headers: { "content-type": "application/json" } });
      } catch (e) {
        return new Response(JSON.stringify({ error: String(e) }), {
          status: 400,
          headers: { "content-type": "application/json" },
        });
      }
    }
    return new Response(html, { headers: { "content-type": "text/html" } });
  },
});

console.log(`machines web listening on http://${host}:${server.port}`);
