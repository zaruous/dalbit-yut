"""Rebuild article PNGs from the transcribed report summary; requires matplotlib.

Run from any directory: python docs/blog/render-laya-figures.py
This script only creates documentation figures; it does not train or benchmark.
"""
import json
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
from matplotlib.patches import FancyBboxPatch

HERE = Path(__file__).resolve().parent
OUT = HERE / "assets"
OUT.mkdir(exist_ok=True)
DATA = json.loads((HERE / "data/laya-benchmark-summary.json").read_text())
RUNS = DATA["runs"]
NAVY, TEAL, GOLD, RED = "#172d4a", "#008577", "#b97a18", "#bd4b47"
plt.rcParams.update({"font.family": "DejaVu Sans", "font.size": 11,
                     "axes.spines.top": False, "axes.spines.right": False,
                     "axes.labelcolor": NAVY, "text.color": NAVY,
                     "axes.titleweight": "bold", "figure.facecolor": "#f8fafc",
                     "axes.facecolor": "#f8fafc", "savefig.facecolor": "#f8fafc"})

def pct(record):
    return 100 * record["wins"] / (record["wins"] + record["losses"])

for r in RUNS:
    for key, boards in [("ab", ["A", "B"]), ("sab", ["S", "A", "B"])]:
        record = r[key]
        if record is not None and all(r["boards"][b] is not None for b in boards):
            assert record["wins"] == sum(r["boards"][b]["wins"] for b in boards)
            assert record["losses"] == sum(r["boards"][b]["losses"] for b in boards)

fig, axes = plt.subplots(1, 2, figsize=(14, 6.8), gridspec_kw={"width_ratios": [1.5, 1]})
fig.suptitle("DALBIT YUT  /  Fine-tuning does not improve monotonically", x=.06, y=.96,
             ha="left", fontsize=19, fontweight="bold")
fig.text(.06, .895, "Recorded development matches vs chooseAIAction | seeds 7001-7010 | seats swapped", fontsize=11)
for ax, key, title in zip(axes, ["ab", "sab"], ["A + B boards  /  40 games per model", "S + A + B boards  /  60 games per model"]):
    runs = [r for r in RUNS if r[key] is not None]
    x = np.arange(len(runs))
    values = [pct(r[key]) for r in runs]
    ax.plot(x, values, color=TEAL, lw=2.5, marker="o", markersize=8)
    ax.axhline(50, ls="--", lw=1, color="#8c99aa", zorder=0)
    for i, (r, v) in enumerate(zip(runs, values)):
        ax.annotate(f"{v:.1f}%\n{r[key]['wins']}W-{r[key]['losses']}L", (i, v),
                    xytext=(0, 12), textcoords="offset points", ha="center", fontsize=10)
    labels = ["First\naligned" if r["id"] == "first-aligned" else r["label"].replace(" / ", "\n") for r in runs]
    ax.set_xticks(x, labels)
    ax.set_ylim(0, 100)
    ax.set_ylabel("Match win rate (%)")
    ax.set_title(title, fontsize=12, loc="left", pad=16)
    ax.grid(axis="y", alpha=.16)
    ax.set_xlim(-.4, len(runs)-.6)
fig.text(.06, .045, "100-row pilot has no reported S-board matches. Lines connect checkpoints, not equal training increments.\nSmall, reused development sample; this figure does not establish final out-of-sample strength.", fontsize=10, color="#54657a")
fig.subplots_adjust(left=.065, right=.97, bottom=.22, top=.76, wspace=.28)
fig.savefig(OUT / "laya-training-win-rate.png", dpi=160)
plt.close(fig)

fig, ax = plt.subplots(figsize=(12, 6.6))
fig.suptitle("DALBIT YUT  /  Board-level strengths change with training", x=.08, y=.95,
             ha="left", fontsize=19, fontweight="bold")
fig.text(.08, .88, "20 games per measured board and checkpoint | opponent: chooseAIAction", fontsize=11)
runs = RUNS[1:]
x = np.arange(len(runs))
width = .23
for j, (board, color) in enumerate(zip(["S", "A", "B"], [NAVY, TEAL, GOLD])):
    positions = x + (j-1)*width
    for i, r in enumerate(runs):
        record = r["boards"][board]
        if record is None:
            ax.text(positions[i], 5, "N/A", ha="center", fontsize=9, color="#65758a")
            continue
        value = pct(record)
        ax.bar(positions[i], value, width=width*.9, color=color,
               label=f"Board {board}" if i == 1 else None, zorder=3)
        ax.text(positions[i], value+2, f"{value:.0f}%", ha="center", fontsize=10)
ax.set_xticks(x, [r["label"] for r in runs])
ax.set_ylim(0, 100)
ax.set_ylabel("Match win rate (%)")
ax.grid(axis="y", alpha=.16, zorder=0)
ax.legend(frameon=False, ncol=3, loc="upper right")
fig.text(.08, .045, "N/A = no reported measurement, not a 0% win rate. Source: docs/laya-experiment.md (2026-10-29).", fontsize=10, color="#54657a")
fig.subplots_adjust(left=.08, right=.97, top=.79, bottom=.17)
fig.savefig(OUT / "laya-board-win-rate.png", dpi=160)
plt.close(fig)

fig, ax = plt.subplots(figsize=(14, 8))
ax.set_xlim(0, 14); ax.set_ylim(0, 8); ax.axis("off")
ax.text(.4, 7.45, "DALBIT YUT  /  From game states to a deployed decision model", fontsize=20, fontweight="bold")
ax.text(.4, 6.95, "Offline: simulate and label decisions. Online: choose from legal candidates.", fontsize=12, color="#54657a")
def box(x, y, title, body, color=TEAL):
    ax.add_patch(FancyBboxPatch((x, y), 3.75, 1.6, boxstyle="round,pad=.10,rounding_size=.12",
                               edgecolor="#d4dce6", facecolor="white", lw=1.2))
    ax.text(x+.18, y+1.22, title, fontsize=13, fontweight="bold", color=color)
    ax.text(x+.18, y+.89, body, fontsize=11, va="top", linespacing=1.5)
def arrow(a, b):
    ax.annotate("", xy=b, xytext=a, arrowprops={"arrowstyle": "-|>", "color": "#667a90", "lw": 1.7})
box(.5, 4.65, "01  Game engine", "S / A / B map routes\nAll pieces, WAIT / FIN\nStored rolls + turn")
box(5.1, 4.65, "02  Candidate shortlist", "2-4 legal actions\nIncludes baseline choice\nResulting states + risks")
box(9.7, 4.65, "03  Rollout teacher", "Apply each candidate\nBaseline AI plays both sides\nPaired random dice trials")
arrow((4.35,5.45),(4.95,5.45)); arrow((8.95,5.45),(9.55,5.45))
box(9.7, 1.9, "04  JSONL labels", "state + questions\nexpected + soft targets\nSeparate evidence files")
box(5.1, 1.9, "05  Laya fine-tuning", "First -> 100 -> 500 -> 1500\nSave checkpoint snapshots\nEvaluate vs baseline")
box(.5, 1.9, "06  Runtime inference", "Browser -> HF Space\nSelect a candidate ID\nGame engine applies action", NAVY)
arrow((11.575,4.55),(11.575,3.65)); arrow((9.55,2.7),(8.95,2.7)); arrow((4.95,2.7),(4.35,2.7))
ax.text(.5, .92, "Base model: convaiinnovations/laya     |     Deployment target: callakrsos/dalbit-yut-laya-1500", fontsize=12, fontweight="bold")
ax.text(.5, .38, "Runtime failures fall back to the built-in AI. This is rollout-guided supervised learning, not an online RL update loop.", fontsize=11, color="#54657a")
fig.subplots_adjust(left=0, right=1, top=1, bottom=0)
fig.savefig(OUT / "laya-training-pipeline.png", dpi=150)
plt.close(fig)
print("Generated 3 figures from", HERE / "data/laya-benchmark-summary.json")
