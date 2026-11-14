(() => {
  const F = window.MudaLens;
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

  Chart.defaults.color = "#4e473f"; Chart.defaults.borderColor = "#d5c9b6"; Chart.defaults.font.family = "IBM Plex Sans, system-ui, sans-serif";

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
      <div class="bar" style="display:flex"><i style="width:${s.va / maxLead * 100}%;background:#3fc1b0"></i><i style="width:${s.queue / maxLead * 100}%;background:#f2a33a"></i></div></div>`).join("");

    chart("pareto", { data: { labels: res.pareto.map(p => p.name), datasets: [
      { type: "bar", label: "Cost", data: res.pareto.map(p => p.value), backgroundColor: res.pareto.map(p => F.WASTES[p.key].color), yAxisID: "y" },
      { type: "line", label: "Cumulative %", data: res.pareto.map(p => p.cum * 100), borderColor: "#1c1712", pointRadius: 3, yAxisID: "y1" } ] },
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
  // Recorded real Drex runs (bench/recorded.json). Replayed, clearly labelled, only when the live
  // API can't be reached: on the public site, or if the venue network blocks the API mid-demo.
  let RECORDED = {};
  fetch("bench/recorded.json").then(r => r.ok ? r.json() : {}).then(j => { RECORDED = j || {}; }).catch(() => {});
  const recNote = when => `<p class="recnote">A recorded Drex run from ${esc(new Date(when).toLocaleString())}. The live API isn’t reachable from here right now.</p>`;
  const liveFailed = e => /fetch|Failed|NetworkError|HTTP 4|HTTP 5|403|429|5\d\d|not configured|Server returned/i.test(e.message);

  async function decide(contenders) {
    $("drexStatus").textContent = "Deciding…";
    try {
      const r = await fetch("api/decide", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rows, contenders }) });
      if (!r.ok) throw new Error("Server returned " + r.status + ". Start it with `npm start`.");
      let out = await r.json(), note = "";
      if (out.drex?.error && /firewall|HTTP (403|429|5)/i.test(out.drex.error) && !contenders.includes("claude")) {
        const r2 = await fetch("api/decide", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rows, contenders: ["claude", "rules"] }) });
        if (r2.ok) { const o2 = await r2.json(); if (o2.claude?.answers) { out = { ...out, ...o2 }; note = `<p class="recnote">⚠ Drex wasn’t reachable from this network, so the frontier LLM and rules answered as a fallback.</p>`; } }
      }
      if (out.drex?.error && !out.claude?.answers) throw new Error(out.drex.error);
      renderDecide(out, note);
      $("drexStatus").textContent = "";
    } catch (e) {
      const rec = RECORDED.line?.[$("scenario").value];
      if (rec && liveFailed(e)) { renderDecide(rec.result, recNote(rec.at)); $("drexStatus").textContent = ""; return; }
      $("drexStatus").textContent = /fetch|Failed|Server returned (404|405|501)/.test(e.message) ? "This public page can’t call Drex live. Live calls run on the team laptop." : e.message;
    }
  }
  function renderDecide(out, note = "") {
      $("decide").innerHTML = `<tr><th>Contender</th>${Q.map(q => `<th>${q.replace("_", " ")}</th>`).join("")}<th>Latency</th><th>Cost</th></tr>` +
        Object.values(out).map(o => o.error ? `<tr><td>${esc(o.label)}</td><td colspan="6" style="text-align:left;color:var(--warn)">${esc(o.error)}</td></tr>` :
          `<tr><td>${esc(o.label)}</td>${Q.map(q => `<td>${esc(o.answers[q])}${o.confidence?.[q] != null ? ` <span class="sub">${(o.confidence[q] * 100).toFixed(0)}%</span>` : ""}</td>`).join("")}
           <td>${o.latencyMs} ms</td><td>$${o.costUsd.toFixed(6)}</td></tr>` +
          (o.confidence && Math.min(...Q.map(q => o.confidence[q] ?? 1)) < 0.5 ? `<tr><td colspan="7" style="text-align:left;color:var(--warn)">⚠ Low confidence on at least one decision: route to an engineer for review.</td></tr>` : "")).join("");
      $("decideNote").innerHTML = note;
  }
  $("askDrex").onclick = () => decide(["drex"]);
  $("askAll").onclick = () => decide(["drex", "claude", "rules"]);
  fetch("api/status").then(r => r.json()).then(s => { liveAvailable = !!s.drex; $("drexStatus").textContent = s.drex ? `Connected: ${s.drex}` : "Drex not configured: set DREX_BASE_URL in .env"; }).catch(() => { $("drexStatus").textContent = "Public demo: Ask Drex replays recorded live runs for each scenario."; $("photoStatus").textContent = "Public demo: pick a sample below to see Drex’s recorded answer. Your own photos need the team laptop."; });

  // ---------- Photo diagnosis (Drex Max reads images) ----------
  const photos = []; // { name, dataUrl }
  const MAX_PHOTOS = 8, MAX_SIDE = 1600, BUDGET = 3.2e6; // request body must stay under 4 MiB
  $("photoStep").innerHTML += F.STEPS.map(s => `<option value="${s.id}">${s.name}</option>`).join("");

  function shrink(file, side = MAX_SIDE, q = 0.85) {
    return new Promise((ok, fail) => {
      const img = new Image(), url = URL.createObjectURL(file);
      img.onload = () => {
        const k = Math.min(1, side / Math.max(img.width, img.height));
        const c = document.createElement("canvas"); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
        ok(c.toDataURL("image/jpeg", q));
      };
      img.onerror = () => { URL.revokeObjectURL(url); fail(new Error(`${file.name} could not be read as an image.`)); };
      img.src = url;
    });
  }
  function drawThumbs() {
    $("thumbs").innerHTML = photos.map((p, i) => `<div class="thumb"><img src="${p.dataUrl}" alt="${esc(p.name)}"><span class="n">Image ${i + 1}</span><button data-i="${i}" aria-label="Remove ${esc(p.name)}">✕</button></div>`).join("");
    $("diagnosePhotos").disabled = $("clearPhotos").disabled = !photos.length;
    const total = photos.reduce((a, p) => a + p.dataUrl.length, 0);
    $("photoStatus").textContent = photos.length ? `${photos.length} photo${photos.length > 1 ? "s" : ""} ready · ${(total / 1e6).toFixed(1)} MB` : "";
  }
  let currentSample = null, liveAvailable = false;
  async function addFiles(files) {
    currentSample = null;
    document.querySelectorAll("[data-sample],[data-photo]").forEach(b => b.setAttribute("aria-pressed", "false"));
    const ok = [...files].filter(f => /^image\/(png|jpeg|webp)$/.test(f.type));
    if (ok.length < files.length) $("photoStatus").textContent = "Skipped files that aren't PNG, JPEG or WebP.";
    for (const f of ok.slice(0, MAX_PHOTOS - photos.length)) {
      try { photos.push({ name: f.name, dataUrl: await shrink(f) }); } catch (e) { $("photoStatus").textContent = e.message; }
    }
    // keep the whole request under the API's body limit by shrinking further if needed
    for (let side = 1200; photos.reduce((a, p) => a + p.dataUrl.length, 0) > BUDGET && side >= 600; side -= 200)
      for (const p of photos) p.dataUrl = await shrink(await (await fetch(p.dataUrl)).blob(), side, 0.8);
    drawThumbs();
  }
  // Drex reads a photo as soon as it arrives; the answer scrolls into view.
  const readNow = () => { if (photos.length) $("diagnosePhotos").click(); };
  $("photos").onchange = async e => { const f = [...e.target.files]; e.target.value = ""; await addFiles(f); readNow(); };
  const drop = $("drop");
  ["dragenter", "dragover"].forEach(t => drop.addEventListener(t, e => { e.preventDefault(); drop.classList.add("over"); }));
  ["dragleave", "drop"].forEach(t => drop.addEventListener(t, e => { e.preventDefault(); drop.classList.remove("over"); }));
  drop.addEventListener("drop", async e => { await addFiles(e.dataTransfer.files); readNow(); });
  $("thumbs").onclick = e => { const i = e.target.dataset.i; if (i != null) { photos.splice(+i, 1); drawThumbs(); } };
  $("clearPhotos").onclick = () => { photos.length = 0; $("photoResult").innerHTML = ""; drawThumbs(); };

  // --- Take a photo: phone camera via capture input; laptop webcam via getUserMedia ---
  let stream = null;
  const isPhone = matchMedia("(pointer: coarse)").matches;
  const stopCam = () => { stream?.getTracks().forEach(t => t.stop()); stream = null; $("cam").hidden = true; };
  $("phoneCam").onchange = async e => { const f = [...e.target.files]; e.target.value = ""; await addFiles(f); readNow(); };
  $("takePhoto").onclick = async () => {
    if (isPhone || !navigator.mediaDevices?.getUserMedia || !isSecureContext) return $("phoneCam").click();
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment", width: { ideal: 1920 } }, audio: false });
      $("camVideo").srcObject = stream; $("cam").hidden = false; $("camMsg").textContent = "Point the camera at the part, chart or shelf, then capture.";
    } catch (e) { $("phoneCam").click(); }
  };
  $("snap").onclick = () => {
    const v = $("camVideo"); if (!v.videoWidth) return;
    const c = document.createElement("canvas"); c.width = v.videoWidth; c.height = v.videoHeight;
    c.getContext("2d").drawImage(v, 0, 0);
    c.toBlob(async b => { await addFiles([new File([b], `camera-${Date.now()}.jpg`, { type: "image/jpeg" })]); $("camMsg").textContent = "Captured. Drex is reading it."; readNow(); }, "image/jpeg", 0.9);
  };
  $("camClose").onclick = stopCam;

  // --- Sample photos (illustrations drawn in the browser, so the demo works with no real fab photos) ---
  const SAMPLES = {
    scratch: { step: "DC", note: "Seen on several dies after dicing this shift", draw(g) {
      g.fillStyle = "#23272e"; g.fillRect(0, 0, 900, 900); g.fillStyle = "#8f97a3"; g.fillRect(120, 120, 660, 660);
      g.fillStyle = "#c3c9d2"; for (let i = 0; i < 8; i++) { g.fillRect(150 + i * 78, 140, 46, 46); g.fillRect(150 + i * 78, 714, 46, 46); }
      g.strokeStyle = "#5d6672"; g.lineWidth = 2; for (let y = 230; y < 690; y += 22) { g.beginPath(); g.moveTo(200, y); g.lineTo(700, y); g.stroke(); }
      g.strokeStyle = "#eef2f6"; g.lineWidth = 6; g.beginPath(); g.moveTo(160, 290); g.bezierCurveTo(350, 380, 520, 520, 770, 650); g.stroke();
      g.strokeStyle = "#ffffff88"; g.lineWidth = 2; g.beginPath(); g.moveTo(175, 305); g.bezierCurveTo(360, 395, 525, 535, 760, 662); g.stroke();
      g.fillStyle = "#fff"; g.font = "24px sans-serif"; g.fillText("Optical inspection 50x · die R12C07", 120, 90); } },
    bond: { step: "WB", note: "Pull test failures rising on bonder 3 since Monday", draw(g) {
      g.fillStyle = "#1d2127"; g.fillRect(0, 0, 900, 900); g.fillStyle = "#6c7380"; g.fillRect(260, 260, 380, 380);
      g.fillStyle = "#d9b45a"; for (let i = 0; i < 6; i++) { g.fillRect(70, 150 + i * 110, 120, 50); g.fillRect(710, 150 + i * 110, 120, 50); }
      g.fillStyle = "#c9ced6"; for (let i = 0; i < 6; i++) { g.fillRect(280, 180 + i * 85, 28, 28); g.fillRect(592, 180 + i * 85, 28, 28); }
      g.strokeStyle = "#e9c46a"; g.lineWidth = 4;
      for (let i = 0; i < 6; i++) { g.beginPath(); g.moveTo(294, 194 + i * 85); g.quadraticCurveTo(220, 120 + i * 100, 130, 175 + i * 110); g.stroke();
        if (i === 3) continue; g.beginPath(); g.moveTo(606, 194 + i * 85); g.quadraticCurveTo(680, 120 + i * 100, 770, 175 + i * 110); g.stroke(); }
      g.beginPath(); g.moveTo(770, 505); g.quadraticCurveTo(690, 380, 650, 420); g.stroke(); // lifted bond, not attached to the die pad
      g.strokeStyle = "#ff5c5c"; g.lineWidth = 3; g.beginPath(); g.arc(640, 450, 48, 0, 7); g.stroke();
      g.fillStyle = "#fff"; g.font = "24px sans-serif"; g.fillText("Wire bond inspection 20x · unit 0412", 70, 80); } },
    wip: { step: "WS", note: "Lots waiting in front of wafer probe; testers down for calibration", draw(g) {
      g.fillStyle = "#e7e9ec"; g.fillRect(0, 0, 900, 900); g.fillStyle = "#9aa1ab";
      for (let s = 0; s < 4; s++) g.fillRect(60, 180 + s * 170, 780, 14);
      g.fillRect(60, 150, 14, 700); g.fillRect(826, 150, 14, 700);
      const cols = ["#3b6fd8", "#3b6fd8", "#d8893b", "#3b6fd8"];
      for (let s = 0; s < 4; s++) for (let i = 0; i < 9; i++) { g.fillStyle = cols[(i + s) % 4]; g.fillRect(84 + i * 84, 70 + s * 170, 70, 108); g.fillStyle = "#fff"; g.fillRect(96 + i * 84, 90 + s * 170, 46, 16); }
      g.fillStyle = "#c0392b"; g.font = "bold 26px sans-serif"; g.fillText("HOLD: awaiting wafer probe", 230, 870);
      g.fillStyle = "#222"; g.font = "22px sans-serif"; g.fillText("Rack B-4 · 36 lots · avg wait 31 h", 60, 40); } },
  };
  document.querySelectorAll("[data-sample]").forEach(b => b.onclick = async () => {
    const s = SAMPLES[b.dataset.sample], c = document.createElement("canvas"); c.width = c.height = 900; s.draw(c.getContext("2d"));
    const blob = await new Promise(r => c.toBlob(r, "image/png"));
    photos.length = 0; $("photoResult").innerHTML = "";
    await addFiles([new File([blob], `sample-${b.dataset.sample}.png`, { type: "image/png" })]);
    $("photoStep").value = s.step; $("photoNote").value = s.note;
    currentSample = b.dataset.sample; // set after addFiles, which clears it
    b.setAttribute("aria-pressed", "true");
    readNow();
  });

  // --- Real sample photos (Wikimedia Commons, see assets/samples/CREDITS.md) ---
  document.querySelectorAll("[data-photo]").forEach(b => b.onclick = async () => {
    const blob = await (await fetch(b.dataset.src)).blob();
    photos.length = 0; $("photoResult").innerHTML = "";
    await addFiles([new File([blob], b.dataset.src.split("/").pop(), { type: "image/jpeg" })]);
    $("photoStep").value = ""; $("photoNote").value = "";
    currentSample = "real-" + b.dataset.photo;
    b.setAttribute("aria-pressed", "true");
    readNow();
  });

  // --- Phone link: open the same page on a phone on this Wi-Fi to snap photos ---
  fetch("api/status").then(r => r.json()).then(s => {
    if (s.lan?.length && !isPhone) { $("phoneLink").hidden = false;
      $("phoneLink").innerHTML = `On a phone on the same Wi-Fi, open <code>${esc(s.lan[0])}</code> and tap “Take a photo”.`; }
  }).catch(() => {});

  // Bring the answer into view when it's off screen (narrow windows stack it under the photo bench).
  function showAnswer() {
    const r = $("photoResult").getBoundingClientRect();
    if (r.top > innerHeight - 120 || r.bottom < 0)
      $("photoResult").scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "center" });
  }
  const NICE = s => String(s ?? "—").replace(/_/g, " ");
  $("diagnosePhotos").onclick = async () => {
    $("diagnosePhotos").disabled = true; $("photoStatus").textContent = "";
    $("photoResult").innerHTML = `<p class="reading">Drex is reading the photo…</p>`; showAnswer();
    try {
      const r = await fetch("api/photo", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ images: photos.map(p => p.dataUrl), step: $("photoStep").value, note: $("photoNote").value }) });
      const o = await r.json().catch(() => ({ error: "Server returned " + r.status }));
      if (!r.ok || o.error) throw new Error(o.error || "Server returned " + r.status);
      renderPhoto(o); showAnswer();
      $("photoStatus").textContent = "";
    } catch (e) {
      const rec = currentSample && RECORDED.photo?.[currentSample];
      if (rec && liveFailed(e)) { renderPhoto(rec.result, recNote(rec.at)); showAnswer(); $("photoStatus").textContent = ""; }
      else { $("photoResult").innerHTML = ""; $("photoStatus").scrollIntoView({ block: "nearest" }); $("photoStatus").textContent = /fetch|Failed|Server returned (404|405|501)/.test(e.message)
        ? (RECORDED.photo ? "This public page can’t call Drex live. Pick one of the samples to see Drex’s recorded answer, or use the team laptop for your own photos."
                          : "This public page can’t call Drex live. Live photo diagnosis runs on the team laptop.")
        : e.message; }
    } finally { $("diagnosePhotos").disabled = !photos.length; }
  };
  function renderPhoto(o, note = "") {
      const card = (label, key, extra = "") => {
        const c = o.confidence[key], v = o.answers[key], desc = o.labels[key]?.[v];
        return `<div class="kpi"><div class="l">${label}</div><div class="v">${esc(NICE(v))}</div>${desc ? `<div class="d">${esc(desc)}</div>` : ""}${extra}
          ${c != null ? `<div class="conf" title="Confidence ${(c * 100).toFixed(0)}%"><i style="width:${c * 100}%"></i></div><div class="d">${(c * 100).toFixed(0)}% confident</div>` : ""}</div>`;
      };
      const low = Object.values(o.confidence).some(c => c != null && c < 0.5);
      $("photoResult").innerHTML = `<div class="verdict">
          ${card("What it shows", "subject")}${card("Defect type", "defect_type")}${card("Lean waste", "root_waste")}
          ${card("Countermeasure", "countermeasure")}${card("Lots", "disposition")}${card("Severity", "severity")}</div>
        <p class="sub" style="margin-top:10px">${esc(o.model)} · ${o.latencyMs} ms · ${o.inputTokens} tokens · $${o.costUsd.toFixed(6)}</p>
        ${low ? `<p style="color:var(--warn)">⚠ Drex is unsure about at least one answer. Send these photos to an engineer for review.</p>` : ""}${note}
        ${o.fallback === "claude" ? `<p class="recnote">⚠ Drex wasn’t reachable from this network, so ${esc(o.model)} answered the same questions as a fallback. Drex returns per-answer confidence; this fallback doesn’t.</p>` : ""}`;
  }

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
