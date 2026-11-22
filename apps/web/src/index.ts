import { loadInventory } from "@machines/core";

const port = Number(process.env.PORT ?? "7778");
const host = process.env.HOST ?? "127.0.0.1";

const inventory = loadInventory(process.env as Record<string, string | undefined>);

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
</style>
</head>
<body>
  <h1>Machines</h1>
  <div id="list"></div>
  <script>
    fetch('/api/machines').then(r=>r.json()).then(d=>{
      const el=document.getElementById('list');
      for (const m of d.machines) {
        const div=document.createElement('div');
        div.className='card';
        div.innerHTML='<strong>'+m.name+'</strong> ('+m.id+')<div class="meta">'+m.os+' · '+m.role+' · '+m.host+' · '+m.owner+'</div>';
        el.appendChild(div);
      }
      if (d.defaultMachineId) {
        const p=document.createElement('p');
        p.textContent='default: '+d.defaultMachineId;
        el.appendChild(p);
      }
    });
  </script>
</body>
</html>`;

const server = Bun.serve({
  port,
  hostname: host,
  fetch(req) {
    const url = new URL(req.url);
    if (url.pathname === "/api/machines") {
      return new Response(JSON.stringify(inventory), {
        headers: { "content-type": "application/json" },
      });
    }
    return new Response(html, { headers: { "content-type": "text/html" } });
  },
});

console.log(`machines web listening on http://${host}:${server.port}`);
