const assert = require("node:assert");
const F = require("../src/engine.js");

// sigma level sanity: 3.4 DPMO ≈ 6σ, 66,807 DPMO ≈ 3σ
assert(Math.abs(F.sigmaLevel(3.4) - 6) < 0.01, "6 sigma");
assert(Math.abs(F.sigmaLevel(66807) - 3) < 0.01, "3 sigma");

const base = F.analyze(F.generateLots({ seed: 42 }));
const better = F.analyze(F.generateLots({ seed: 42, drift: Object.fromEntries(F.STEPS.map(s => [s.id, { queue: 0.45, dpu: 0.5, sd: 0.7 }])) }));
assert(base.kpi.pce > 0 && base.kpi.pce < 1);
assert(better.kpi.pce > base.kpi.pce, "kaizen raises PCE");
assert(better.kpi.rty > base.kpi.rty, "kaizen raises RTY");
assert(better.grand < base.grand, "kaizen lowers waste cost");
assert(base.recommendations.length >= 3);

const litho = F.analyze(F.generateLots({ seed: 7, drift: { PH: { queue: 2.6, shift: 0.022, sd: 1.3 } } }));
assert.strictEqual(litho.steps.find(s => s.id === "PH").cpk, litho.worstCpk.cpk, "litho drift is worst Cpk");

const rows = F.generateLots({ lots: 5 });
assert.deepStrictEqual(F.fromCSV(F.toCSV(rows)).length, rows.length, "CSV round-trip");

console.log("All tests passed. Baseline PCE", (base.kpi.pce * 100).toFixed(1) + "%", "sigma", base.kpi.sigma.toFixed(2));
