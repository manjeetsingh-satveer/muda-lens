# FabMuda Lens 🦖

**Track: Apex Predator, Drex vs. the Giants.**
In semiconductor manufacturing, a Lean Six Sigma black belt makes the same few decisions every week. We give those decisions to **Drex** and test it on cases with known answers against a frontier LLM (Claude Opus 5.5) and classic rule-based SPC.

## The problem

During a summer internship in power-semiconductor manufacturing I saw *muda* (waste) everywhere. Lots queued for days at litho and probe, inspections were repeated beyond the control plan, wafers were carried across the fab, and technicians quietly re-tuned recipes by hand. The data to catch all of this already exists. The hard part is the **decision**: which waste matters most, where it started, which fix to run, and whether the lots can ship.

## The decision Drex makes

Each week the line's data (12 process steps, current week vs. historical baseline) goes to Drex as the `state`, with four typed `choice` questions answered in **one pass**:

| Question | Options |
|---|---|
| `root_waste` | the 8 Lean wastes (TIMWOODS) |
| `culprit_step` | the 12 process steps (oxidation → final test) |
| `countermeasure` | CONWIP/DBR · re-center + SPC · DOE · 8D · sampling plan · standard work · AMHS re-layout |
| `disposition` | release · hold · rework |

Drex returns a choice and a **probability for each option**, which gives the engineer a calibrated confidence value instead of free text.

## The benchmark (why it's an honest test)

`bench/` builds **70 cases with known answers** (10 for each of 7 fault types: bottleneck, mean shift, extra variation, defect spike, over-inspection, manual overrides, transport). Each case contains:
- **one injected fault** at a random step, with random severity, which is the right answer
- **one decoy** problem at another step, sometimes with a *bigger raw change* than the real fault
- ±15% background noise on every step
- a plant rule that every contender is told: *product-quality risk outranks flow waste*

A case counts as correct only if **all 4 decisions** are right. The same data and option text go to every contender.

| Contender | All-4 correct | $ / 1k decisions | p50 latency |
|---|---|---|---|
| Rule-based SPC (no AI) | 67.1% | $0 | <1 ms |
| Drex | run `npm run bench` | | |
| Claude Opus 5.5 | run `npm run bench` | | |

The rules engine falls for the decoys. It gets only 3/10 mean-shift and 1/10 variance cases right, so a decision model has room to win.

## Run it

```bash
npm install
cp .env.example .env      # add DREX_BASE_URL / DREX_API_KEY (and ANTHROPIC_API_KEY for the baseline)
npm start                 # dashboard + live "Ask Drex" at http://localhost:5173
npm run bench             # full benchmark -> bench/results.json -> shown in the dashboard Arena
npm run bench:quick       # 14-case smoke run
npm test
```

You can use Drex hosted (Nace console) or with open weights run locally (`serve.py` from `nace-ai/drex-decision-models`, then `DREX_BASE_URL=http://127.0.0.1:8000`).

## What else is in the dashboard

- **Value stream map**: value-add vs. wait time and process cycle efficiency per step
- **Muda Pareto**: dollar cost of each of the 8 wastes
- **Six Sigma scorecard**: DPU, DPMO, first-pass yield, rolled throughput yield, sigma level, Cp/Cpk for each step's critical-to-quality parameter
- **Scenarios**: baseline, litho bottleneck, wire-bond defect spike, after-kaizen
- **CSV upload** for your own lot data (`lot,step,va_min,queue_min,dies_in,defects,rework,holds,transport_m,extra_inspections,manual_interventions,measured`)

> **Data note:** all data is synthetic, generated with fixed seeds. No proprietary or employer data is included.

## Structure

```
index.html            dashboard
src/engine.js         Lean + Six Sigma analytics (browser + Node)
src/app.js            UI, charts, live Drex panel, arena
server.js             static server + /api/decide proxy (keeps keys server-side)
bench/cases.js        ground-truth case generator + the 4 decision questions
bench/contenders.js   Drex, Claude, and rules clients
bench/run.js          benchmark runner -> bench/results.json
```
