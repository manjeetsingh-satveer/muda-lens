# FabMuda Lens

**Diagnose *muda* (waste) in semiconductor manufacturing with Lean + Six Sigma.**

Built at a hackathon, inspired by an internship in power-semiconductor manufacturing, where waste showed up everywhere: lots queued for days in front of litho and probe, inspections repeated beyond the control plan, wafers carried across the fab, and operators quietly fixing recipes by hand.

FabMuda Lens takes lot-level process data, finds the waste in it and puts a dollar cost on each type, then produces a DMAIC action plan.

## What it does

| Lens | Output |
|---|---|
| **Lean – TIMWOODS** | Cost of each of the 8 wastes (Transportation, Inventory, Motion, Waiting, Over-processing, Over-production, Defects, Skills) for each process step |
| **Value Stream Map** | Value-add time vs. waiting time per step, Process Cycle Efficiency, total lead time |
| **Pareto (80/20)** | Which wastes cost the most |
| **Six Sigma** | DPU, DPMO, first-pass yield, rolled throughput yield, sigma level (1.5σ shift), Cp / Cpk on each step's critical-to-quality parameter |
| **DMAIC plan** | Rule-based fixes: CONWIP/DBR at the constraint, DOE for low-Cpk steps, sampling inspection, spaghetti diagrams, standard work |

The modeled flow is a 12-step power-device route: oxidation → photolithography → etch → implant → diffusion → metallization → wafer sort → dicing → die attach → wire bond → mold → final test.

## Run it

No build step. Open `index.html` in a browser, or:

```bash
npx serve .
```

Tests: `node test/engine.test.js`

## Demo scenarios

- **Baseline fab**: typical wait-dominated flow (PCE is low, as in most real fabs)
- **Litho bottleneck + CD drift**: the queue grows at the constraint and Cpk drops
- **Wire-bond defect spike**: a back-end quality issue that lowers RTY
- **After kaizen**: shows the improvement after fixing the problems

## Bring your own data

Upload a CSV with one row per lot per step:

```
lot,step,va_min,queue_min,dies_in,defects,rework,holds,transport_m,extra_inspections,manual_interventions,measured
```

`step` must be one of `OX, PH, ET, IM, DF, MT, WS, DC, DA, WB, MD, FT`. Click **Download sample CSV** to get a template.

> **Data note:** all bundled data is synthetic, generated in the browser with a fixed random seed. No proprietary or employer data is included.

## Structure

```
index.html          dashboard
src/engine.js       Lean + Six Sigma analysis engine (pure JS, browser + Node)
src/app.js          UI and charts (Chart.js)
test/engine.test.js sanity tests
```
