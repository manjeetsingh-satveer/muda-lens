(() => {
  const F = window.FabMuda;
  const $ = id => document.getElementById(id);
  const costs = { ...F.DEFAULT_COSTS };
  const charts = {};
  let rows = [];

  const SCENARIOS = {
    baseline: { seed: 42, drift: {} },
    litho: { seed: 7, drift: { PH: { queue: 2.6, shift: 0.022, sd: 1.3, dpu: 2.2 } } },
    backend: { seed: 11, drift: { WB: { dpu: 4, sd: 1.6, shift: -1.2 }, DC: { queue: 1.8 } } },
    improved: { seed: 42, drift: Object.fromEntries(F.STEPS.map(s => [s.id, { queue: 0.45, dpu: 0.5, sd: 0.7 }])) },
  };

  const money = v => "$" + (v >= 1e6 ? (v / 1e6).toFixed(2) + "M" : v >= 1e3 ? (v / 1e3).toFixed(1) + "k" : v.toFixed(0));
  const pill = (v, good, warn, fmt = x => x.toFixed(2), higherBetter = true) => {
    const cls = higherBetter ? (v >= good ? "good" : v >= warn ? "warn" : "bad") : (v <= good ? "good" : v <= warn ? "warn" : "bad");
    return `<span class="pill ${cls}">${fmt(v)}</span>`;
  };

  Chart.defaults.color = "#8b94a3"; Chart.defaults.borderColor = "#262c36";

  function chart(id, cfg) { if (charts[id]) charts[id].destroy(); charts[id] = new Chart($(id), cfg); }

  function render(res) {
    const k = res.kpi;
    $("kpis").innerHTML = [
      ["Process cycle efficiency", pill(k.pce * 100, 25, 10, x => x.toFixed(1) + "%")],
      ["Lead time", k.leadDays.toFixed(1) + " days"],
      ["Rolled throughput yield", pill(k.rty * 100, 95, 85, x => x.toFixed(1) + "%")],
      ["DPMO (per step)", k.dpmo.toFixed(0)],
      ["Sigma level", pill(k.sigma, 4.5, 3.5, x => x.toFixed(2) + "σ")],
      ["Waste cost / lot", money(k.wastePerLot)],
      ["Constraint", res.bottleneck.name],
    ].map(([l, v]) => `<div class="kpi"><div class="l">${l}</div><div class="v">${v}</div></div>`).join("");

    const maxLead = Math.max(...res.steps.map(s => s.va + s.queue));
    $("vsm").innerHTML = res.steps.map(s => `<div class="box"><div class="n">${s.name}</div>
      VA ${(s.va / 60).toFixed(1)}h · Wait ${(s.queue / 60).toFixed(1)}h<br>PCE ${(s.pce * 100).toFixed(0)}%
      <div class="bar" style="display:flex"><i style="width:${s.va / maxLead * 100}%;background:#4fd1c5"></i><i style="width:${s.queue / maxLead * 100}%;background:#f2a33a"></i></div></div>`).join("");

    chart("pareto", { data: { labels: res.pareto.map(p => p.name), datasets: [
      { type: "bar", label: "Cost", data: res.pareto.map(p => p.value), backgroundColor: res.pareto.map(p => F.WASTES[p.key].color), yAxisID: "y" },
      { type: "line", label: "Cumulative %", data: res.pareto.map(p => p.cum * 100), borderColor: "#e6e9ef", pointRadius: 3, yAxisID: "y1" } ] },
      options: { plugins: { legend: { display: false } }, scales: { y: { ticks: { callback: money } }, y1: { position: "right", min: 0, max: 100, grid: { display: false }, ticks: { callback: v => v + "%" } } } } });

    chart("stack", { type: "bar", data: { labels: res.steps.map(s => s.id), datasets: Object.entries(F.WASTES).map(([key, w]) => ({ label: w.name, data: res.steps.map(s => s.waste[key]), backgroundColor: w.color })) },
      options: { plugins: { legend: { labels: { boxWidth: 10, font: { size: 10 } } }, tooltip: { callbacks: { title: i => res.steps[i[0].dataIndex].name } } }, scales: { x: { stacked: true }, y: { stacked: true, ticks: { callback: money } } } } });

    chart("cpk", { type: "bar", data: { labels: res.steps.map(s => s.id), datasets: [
      { label: "Cpk", data: res.steps.map(s => s.cpk), backgroundColor: res.steps.map(s => s.cpk >= 1.33 ? "#46c37b" : s.cpk >= 1 ? "#f2a33a" : "#e5484d") },
      { type: "line", label: "Target 1.33", data: res.steps.map(() => 1.33), borderColor: "#8b94a3", borderDash: [5, 5], pointRadius: 0 } ] },
      options: { plugins: { legend: { display: false }, tooltip: { callbacks: { title: i => res.steps[i[0].dataIndex].name + " — " + res.steps[i[0].dataIndex].spec.param } } } } });

    $("recs").innerHTML = res.recommendations.map(r => `<div class="rec"><b>${F.WASTES[r.waste].name}</b><span class="tag">${r.phase} · ${r.step}</span><div>${r.text}</div></div>`).join("");

    $("tbl").innerHTML = `<tr><th>Step</th><th>Area</th><th>CTQ</th><th>Mean</th><th>σ</th><th>Cp</th><th>Cpk</th><th>DPMO</th><th>FPY</th><th>Sigma</th><th>Holds</th><th>Rework</th><th>Waste $</th></tr>` +
      res.steps.map(s => `<tr><td>${s.name}</td><td>${s.area}</td><td>${s.spec.param} [${s.spec.lsl}–${s.spec.usl}]</td><td>${s.mu.toFixed(3)}</td><td>${s.s.toFixed(3)}</td>
        <td>${s.cp.toFixed(2)}</td><td>${pill(s.cpk, 1.33, 1)}</td><td>${s.dpmo.toFixed(0)}</td><td>${(s.fpy * 100).toFixed(2)}%</td><td>${s.sigma.toFixed(2)}σ</td>
        <td>${s.holds}</td><td>${s.rework}</td><td>${money(s.wasteTotal)}</td></tr>`).join("");
  }

  function run() { render(F.analyze(rows, costs)); }
  function loadScenario() { const s = SCENARIOS[$("scenario").value]; rows = F.generateLots({ lots: 200, seed: s.seed, drift: s.drift }); run(); }

  $("run").onclick = loadScenario;
  $("scenario").onchange = loadScenario;
  $("dl").onclick = () => { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([F.toCSV(rows)], { type: "text/csv" })); a.download = "fab_lots_sample.csv"; a.click(); };
  $("csv").onchange = e => { const f = e.target.files[0]; if (!f) return; f.text().then(t => { try { rows = F.fromCSV(t); run(); } catch (err) { alert(err.message); } }); };
  $("cols").textContent = F.COLS.join(", ");
  $("costs").innerHTML = Object.entries(costs).map(([k, v]) => `<label>${k}<input type="number" step="any" data-k="${k}" value="${v}"></label>`).join("");
  $("costs").oninput = e => { const k = e.target.dataset.k; if (k) { costs[k] = Number(e.target.value) || 0; run(); } };

  // ---------- Drex live decisions (needs `npm start`, which proxies the API) ----------
  const Q = ["root_waste", "culprit_step", "countermeasure", "disposition"];
  const esc = s => String(s ?? "—").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  async function decide(contenders) {
    $("drexStatus").textContent = "Deciding…";
    try {
      const r = await fetch("api/decide", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rows, contenders }) });
      if (!r.ok) throw new Error("Server returned " + r.status + ". Start it with `npm start`.");
      const out = await r.json();
      $("decide").innerHTML = `<tr><th>Contender</th>${Q.map(q => `<th>${q.replace("_", " ")}</th>`).join("")}<th>Latency</th><th>Cost</th></tr>` +
        Object.values(out).map(o => o.error ? `<tr><td>${esc(o.label)}</td><td colspan="6" style="text-align:left;color:var(--warn)">${esc(o.error)}</td></tr>` :
          `<tr><td>${esc(o.label)}</td>${Q.map(q => `<td>${esc(o.answers[q])}${o.confidence?.[q] != null ? ` <span class="sub">${(o.confidence[q] * 100).toFixed(0)}%</span>` : ""}</td>`).join("")}
           <td>${o.latencyMs} ms</td><td>$${o.costUsd.toFixed(6)}</td></tr>`).join("");
      $("drexStatus").textContent = "";
    } catch (e) { $("drexStatus").textContent = e.message.includes("fetch") ? "Live calls need the server: run `npm start`." : e.message; }
  }
  $("askDrex").onclick = () => decide(["drex"]);
  $("askAll").onclick = () => decide(["drex", "claude", "rules"]);
  fetch("api/status").then(r => r.json()).then(s => { $("drexStatus").textContent = s.drex ? `Connected: ${s.drex}` : "Drex not configured: set DREX_BASE_URL in .env"; }).catch(() => {});

  // ---------- Arena (benchmark results) ----------
  fetch("bench/results.json").then(r => r.ok ? r.json() : null).then(res => {
    if (!res) return;
    const cs = Object.entries(res.contenders);
    const kinds = Object.keys(cs.find(([, c]) => c.byKind)?.[1].byKind || {});
    $("arena").innerHTML = `<p class="sub">${res.cases} cases · generated ${new Date(res.generatedAt).toLocaleString()}</p><div class="tbl"><table>
      <tr><th>Contender</th><th>All 4 correct</th>${Q.map(q => `<th>${q.replace("_", " ")}</th>`).join("")}<th>p50 latency</th><th>$ / 1k decisions</th></tr>
      ${cs.map(([, c]) => c.skipped ? `<tr><td>${esc(c.label)}</td><td colspan="7" style="text-align:left" class="sub">not run (no API key configured)</td></tr>` :
        `<tr><td><b>${esc(c.label)}</b></td><td>${pill(c.exact * 100, 85, 70, x => x.toFixed(1) + "%")}</td>${Q.map(q => `<td>${(c.perQuestion[q] * 100).toFixed(0)}%</td>`).join("")}
         <td>${c.latencyMsP50} ms</td><td>$${c.costPer1kDecisionsUsd.toFixed(3)}</td></tr>`).join("")}
      </table></div>
      <div class="tbl" style="margin-top:10px"><table><tr><th>Accuracy by fault type</th>${kinds.map(k => `<th>${k.replace("_", " ")}</th>`).join("")}</tr>
      ${cs.filter(([, c]) => !c.skipped).map(([, c]) => `<tr><td>${esc(c.label)}</td>${kinds.map(k => `<td>${c.byKind[k].exact}/${c.byKind[k].n}</td>`).join("")}</tr>`).join("")}</table></div>`;
  }).catch(() => {});

  loadScenario();
})();
