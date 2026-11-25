import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import type { MachinePreferences } from "@machines/core";
import { getPreferences, loadInventory, parseOrgsJson } from "@machines/core";

const port = Number(process.env.PORT ?? "7778");
const host = process.env.HOST ?? "127.0.0.1";

// Resolve FHL ui dist dir (built @farishan-labs/ui).
function uiDistDir(): string {
  const cands = [
    process.env.UI_DIST,
    join(homedir(), "dev", "labs", "ui", "dist"),
    join(process.cwd(), "..", "..", "..", "ui", "dist"),
  ].filter(Boolean) as string[];
  for (const c of cands) {
    try {
      readFileSync(join(c, "index.js"));
      return c;
    } catch {
      /* try next */
    }
  }
  return cands[0] ?? "";
}
const UI_DIST = uiDistDir();

function currentMachineId(): string {
  const env = { ...process.env, MACHINES_FILE: process.env.MACHINES_FILE ?? "/Users/faris/dev/machines/machines.json", PATH: `${process.env.HOME}/.local/bin:${process.env.PATH ?? ""}` };
  try {
    const out = spawnSync("machines", ["whoami"], { encoding: "utf8", env });
    const v = (out.stdout || "").trim();
    if (v && v !== "(unknown)" && v !== "No machines configured. Set MACHINES_JSON in .env") return v;
  } catch { /* ignore */ }
  // fallback: match hostname against inventory
  try {
    const inv = getInventory();
    const hn = (process.env.HOSTNAME || "").toLowerCase();
    const m = inv.machines.find((x) => (x.hostname || x.host || "").toLowerCase() === hn || x.id === hn);
    if (m) return m.id;
  } catch { /* ignore */ }
  return "";
}

function tailscaleStatus(): { self: string; peers: { name: string; online: boolean; ip: string }[] } {
  const env = { ...process.env, PATH: `/usr/local/bin:/opt/homebrew/bin:${process.env.PATH ?? ""}` };
  try {
    const out = spawnSync("tailscale", ["status", "--json"], { encoding: "utf8", env });
    if (out.status !== 0) return { self: "", peers: [] };
    const d = JSON.parse(out.stdout || "{}");
    const self = (d.Self && (d.Self.HostName || d.Self.DNSName || "")) || "";
    const peers: { name: string; online: boolean; ip: string }[] = [];
    const peerObj = d.Peer || {};
    for (const p of Object.values(peerObj) as any[]) {
      peers.push({
        name: String(p.HostName || p.DNSName || "").replace(/\.$/, ""),
        online: !!p.Online,
        ip: String((p.TailscaleIPs && p.TailscaleIPs[0]) || ""),
      });
    }
    return { self, peers };
  } catch {
    return { self: "", peers: [] };
  }
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
<link rel="stylesheet" href="/ui/tokens.css" />
<link rel="stylesheet" href="/ui/baseline.css" />
<style>
  .skip { position: absolute; left: -9999px; top: 0; background: var(--ui-color-accent-default,#2563eb); color: var(--ui-color-accent-fg,#fff); padding: var(--ui-space-2,0.5rem) var(--ui-space-3,0.75rem); border-radius: var(--ui-radius-md,0.375rem); z-index: 1000; }
  .skip:focus { left: var(--ui-space-6,1.5rem); top: var(--ui-space-6,1.5rem); }
  body { font-family: var(--ui-font-family-sans, system-ui); margin: 0; padding: var(--ui-space-6, 1.5rem); background: var(--ui-color-bg-default, #fff); color: var(--ui-color-fg-default, #09090b); -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; box-sizing: border-box; }
  *, *::before, *::after { box-sizing: border-box; }
  .shell { display: grid; gap: var(--ui-space-4, 1rem); max-width: 100%; }
  main { display: grid; gap: var(--ui-space-4, 1rem); }
  header h1 { font-size: var(--ui-font-size-2xl, 1.5rem); margin: 0 0 var(--ui-space-2, 0.5rem); }
  #list { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: var(--ui-space-4, 1rem); }
  @media (min-width: 1024px) { #list { grid-template-columns: repeat(4, 1fr); } }
  .card-current { outline: 2px solid var(--ui-color-accent-default, #2563eb); outline-offset: 2px; }
  .meta { color: var(--ui-color-fg-muted, #71717a); font-size: var(--ui-font-size-sm, 0.875rem); }
  .prefs { margin-top: var(--ui-space-3, 0.75rem); display: grid; gap: var(--ui-space-2, 0.5rem); }
  .pref { display: flex; align-items: center; gap: var(--ui-space-2, 0.5rem); font-size: var(--ui-font-size-sm, 0.875rem); flex-wrap: nowrap; }
  .pref input.orgval { flex: 1 1 0; min-width: 0; width: 0; }
  .pref-key { font-weight: 600; min-width: 6rem; }
  .pref-val { color: var(--ui-color-fg-default, #09090b); }
  .addpref { display: flex; gap: var(--ui-space-2, 0.5rem); margin-top: var(--ui-space-3, 0.75rem); flex-wrap: wrap; }
  .addpref input, input.orgval, input.k, input.v { padding: var(--ui-space-1, 0.25rem) var(--ui-space-2, 0.5rem); border: 1px solid var(--ui-color-border-default, #e4e4e7); border-radius: var(--ui-radius-md, 0.375rem); background: var(--ui-color-bg-default, #fff); color: var(--ui-color-fg-default, #09090b); font-family: inherit; }
  input:focus-visible, button:focus-visible { outline: 2px solid var(--ui-color-accent-default, #2563eb); outline-offset: 2px; }
  .error { color: var(--ui-color-danger-default, #dc2626); margin: var(--ui-space-2, 0.5rem) 0; }
  ui-card { display: block; }
  .ts-panel { display: grid; gap: var(--ui-space-2, 0.5rem); padding: var(--ui-space-4, 1rem); border: 1px solid var(--ui-color-border-default, #e4e4e7); border-radius: var(--ui-radius-lg, 0.5rem); background: var(--ui-color-bg-muted, #f4f4f5); }
  .ts-row { display: flex; align-items: center; gap: var(--ui-space-2, 0.5rem); font-size: var(--ui-font-size-sm, 0.875rem); }
  .dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }
  .dot.on { background: var(--ui-color-success-default, #16a34a); }
  .dot.off { background: var(--ui-color-danger-default, #dc2626); }
  .dot.unknown { background: var(--ui-color-fg-muted, #71717a); }
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after { transition: none !important; animation: none !important; }
  }
</style>
</head>
<body>
  <a class="skip" href="#list">Skip to machines</a>
  <div class="shell">
    <header><h1>Machines</h1></header>
    <div id="error" class="error" role="alert" aria-live="assertive"></div>
    <main id="main">
      <section aria-label="Tailscale status" id="ts-section"></section>
      <div id="list" tabindex="-1"></div>
    </main>
  </div>
  <script type="module" src="/ui/index.js"></script>
  <script>
    function esc(v){ return String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
    function equalizeCardHeights() {
      const cards = Array.from(document.querySelectorAll('ui-card'));
      if (!cards.length) return;
      cards.forEach(c => { c.style.height = 'auto'; });
      const max = Math.max(...cards.map(c => c.getBoundingClientRect().height));
      cards.forEach(c => { c.style.height = max + 'px'; });
    }
    async function load() {
      const [mRes, oRes, tsRes] = await Promise.all([fetch('/api/machines'), fetch('/api/orgs'), fetch('/api/tailscale')]);
      const d = await mRes.json();
      const orgs = await oRes.json();
      const ts = await tsRes.json();
      const el = document.getElementById('list');
      el.innerHTML = '';
      const cur = d.currentMachineId || '';
      const tsMap = {};
      (ts.peers || []).forEach(p => { tsMap[String(p.name).toLowerCase()] = !!p.online; });
      if (ts.self) tsMap[String(ts.self).toLowerCase()] = true;
      function isOnline(m) {
        const keys = [m.id, m.host, m.hostname, (m.tunnel && m.tunnel.target) || ''].map(x=>String(x||'').toLowerCase());
        for (const k of keys) { if (k && Object.prototype.hasOwnProperty.call(tsMap, k)) return tsMap[k]; }
        return null;
      }
      // tailscale panel
      const tsSection = document.getElementById('ts-section');
      tsSection.innerHTML = '';
      const panel = document.createElement('div');
      panel.className = 'ts-panel';
      panel.setAttribute('role','region');
      panel.setAttribute('aria-label','Tailscale status');
      const title = document.createElement('div');
      title.innerHTML = '<strong>Tailscale</strong> <span class="meta">self: ' + esc(ts.self || 'unknown') + '</span>';
      panel.appendChild(title);
      const ul = document.createElement('ul');
      ul.style.listStyle = 'none'; ul.style.padding = '0'; ul.style.margin = '0';
      (ts.peers || []).forEach(p => {
        const li = document.createElement('li');
        li.className = 'ts-row';
        const dot = document.createElement('span');
        dot.className = 'dot ' + (p.online ? 'on' : 'off');
        dot.setAttribute('aria-hidden','true');
        li.appendChild(dot);
        li.appendChild(document.createTextNode(p.name + (p.ip ? '  ' + p.ip : '') + (p.online ? '  (online)' : '  (offline)')));
        ul.appendChild(li);
      });
      panel.appendChild(ul);
      tsSection.appendChild(panel);

      if (!d.machines || d.machines.length === 0) {
        const es = document.createElement('ui-empty-state');
        es.setAttribute('title', 'No machines');
        es.setAttribute('description', 'Configure MACHINES_FILE to get started.');
        el.appendChild(es);
        return;
      }
      for (const m of d.machines) {
        const card = document.createElement('ui-card');
        if (m.id === cur) card.classList.add('card-current');
        const prefs = m.preferences || m.prefs || m.paths || m.codebases || {};
        const orgList = (orgs && orgs.length) ? orgs : Object.keys(prefs).map(k=>({id:k,name:k}));
        let prefsHtml = '<div class="prefs">';
        for (const o of orgList) {
          const val = prefs[o.id] || '';
          prefsHtml += '<div class="pref"><span class="pref-key">'+esc(o.name)+':</span><input data-id="'+esc(m.id)+'" data-key="'+esc(o.id)+'" class="orgval" value="'+esc(val)+'" placeholder="path" aria-label="'+esc(o.name)+' path for '+esc(m.name)+'" /><ui-button variant="secondary" size="sm" label="Save" data-id="'+esc(m.id)+'" data-key="'+esc(o.id)+'" class="saveorg"></ui-button></div>';
        }
        for (const [k, v] of Object.entries(prefs)) {
          if (!orgList.some(o=>o.id===k)) {
            prefsHtml += '<div class="pref"><span class="pref-key">'+esc(k)+':</span><span class="pref-val">'+esc(v)+'</span><ui-button variant="ghost" size="sm" label="✕" data-id="'+esc(m.id)+'" data-key="'+esc(k)+'" class="del" aria-label="Delete '+esc(k)+'"></ui-button></div>';
          }
        }
        prefsHtml += '</div>';
        prefsHtml += '<div class="addpref"><input placeholder="key" class="k" aria-label="Preference key" /><input placeholder="value (path)" class="v" aria-label="Preference value (path)" /><ui-button variant="primary" size="sm" label="Add" data-id="'+esc(m.id)+'" class="add"></ui-button></div>';
        const online = isOnline(m);
        const statusBadge = online === null ? '' : (online ? '<ui-badge variant="success">online</ui-badge>' : '<ui-badge variant="danger">offline</ui-badge>');
        const currentBadge = (m.id === cur) ? '<ui-badge variant="success">This machine</ui-badge> ' : '';
        card.innerHTML = '<span slot="header"><strong>'+esc(m.name)+'</strong> ('+esc(m.id)+') ' + currentBadge + statusBadge + '</span><div class="meta">'+esc(m.os)+' · '+esc(m.role)+' · '+esc(m.host)+' · '+esc(m.owner)+'</div>'+prefsHtml;
        el.appendChild(card);
      }
      equalizeCardHeights();
      document.querySelectorAll('.saveorg').forEach(btn => {
        btn.addEventListener('click', async () => {
          const id = btn.dataset.id; const key = btn.dataset.key;
          const card = btn.closest('ui-card');
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
      document.querySelectorAll('.del').forEach(btn => {
        btn.addEventListener('click', async () => {
          const id = btn.dataset.id; const key = btn.dataset.key;
          await fetch('/api/prefs', { method: 'DELETE', headers: {'content-type':'application/json'}, body: JSON.stringify({ id, key }) });
          load();
        });
      });
      document.querySelectorAll('.add').forEach(btn => {
        btn.addEventListener('click', async () => {
          const id = btn.dataset.id;
          const card = btn.closest('ui-card');
          const k = card.querySelector('.k').value.trim();
          const v = card.querySelector('.v').value.trim();
          if (!k || !v) return;
          await fetch('/api/prefs', { method: 'POST', headers: {'content-type':'application/json'}, body: JSON.stringify({ id, key: k, value: v }) });
          load();
        });
      });
    }
    load();
    window.addEventListener('resize', equalizeCardHeights);
  </script>
</body>
</html>`;
const server = Bun.serve({
  port,
  hostname: host,
  async fetch(req) {
    const url = new URL(req.url);
    if (url.pathname.startsWith("/ui/")) {
      const rel = url.pathname.slice("/ui/".length);
      if (rel.includes("..")) return new Response("Forbidden", { status: 403 });
      const file = Bun.file(join(UI_DIST, rel));
      if (await file.exists()) {
        const type = rel.endsWith(".css") ? "text/css; charset=utf-8"
          : rel.endsWith(".js") ? "text/javascript; charset=utf-8"
          : rel.endsWith(".json") ? "application/json; charset=utf-8"
          : "application/octet-stream";
        return new Response(file, { headers: { "content-type": type, "cache-control": "no-cache" } });
      }
      return new Response("Not Found", { status: 404 });
    }
    if (url.pathname === "/api/machines") {
      const inv = getInventory();
      const payload = { ...inv, currentMachineId: currentMachineId() };
      return new Response(JSON.stringify(payload), {
        headers: { "content-type": "application/json" },
      });
    }
    if (url.pathname === "/api/tailscale") {
      return new Response(JSON.stringify(tailscaleStatus()), {
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
