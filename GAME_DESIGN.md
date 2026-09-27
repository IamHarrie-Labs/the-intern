# THE INTERN
*It did exactly what you asked.*

**Track:** Digital (single HTML page + JS, runs in any browser, no install)
**Format:** Solo puzzle, 10–15 minutes for the main levels, replayable
**Pitch:** You hired a robot intern. It's eager, tireless and does *exactly* what its scorecard rewards. Write the scorecard. Watch what happens. Fire the intern, or fix the instructions?

---

## 1. The core bet

Judging is 40% fun, 40% AI risk at the core, 20% replay.

The game is built on one risk: **specification gaming** (Goodhart's law). It's the thing the player *does*, not a label on it:

- The player writes the objective.
- A real optimizer finds the actual highest-scoring plan under that objective. Nothing is a scripted gotcha.
- The player watches the gap open between what they measured and what they meant.
- No vocabulary is needed going in. A player who has never heard "reward hacking" still laughs, then rewrites the scorecard.

The lesson is never stated as a moral. A one-line debrief after each level does that job.

### Honest scope of the claim
The Intern shows **specification gaming and proxy failure**: an optimizer maximizing a flawed objective in a designed environment. It is **not** a demonstration of deceptive alignment, learned generalization or shutdown avoidance. The copy must not claim those.

---

## 2. The core loop

Each attempt takes 60–120 seconds.

1. **Brief:** a concrete goal in plain language, e.g. *"Get the parcel to Dana's desk."*
2. **Scorecard:** the player puts **Sensor Cards** into slots and sets each weight from −5 to +5. Each card rewards or penalizes one thing the office can *measure*. Sensors cost **budget points**, and every level has a limited budget (see §4).
3. **Shift:** the Intern plans its whole shift instantly (§3), then plays it out on the grid with personality: a beep, a hop, pride.
4. **Outcome first, numbers second.** The player watches what physically happened *before* seeing any score. Then comes the reveal card:

   > **INTERN OF THE MONTH** 🏆
   > 48 successful pickups.
   > Nobody received their package.

5. **Split scoreboard:** on the left, **"Your scorecard says"** (the Intern's score). On the right, **"What actually happened"** (the level's real outcome).
6. **Debrief:** one sentence tying the failure to a real documented case of specification gaming, with an optional link.
7. **Retry:** edit the scorecard and run again. Retries are free and instant.

**The first attempt of every level comes with a pre-filled, plausible-looking but flawed scorecard.** The first thing every player sees is the joke. After that they own the fix.

---

## 3. How the Intern thinks (the optimizer)

**Finite-horizon planning, computed exactly.**

- Every shift has a fixed **action budget** (for example 40 actions, set per level).
- The Intern computes the optimal plan by backward induction over `(state, steps remaining)`. It's exact, bounded, deterministic and takes milliseconds for state spaces this small.
- **Deterministic tie-breaking** uses a fixed preference order: interact, then N, E, S, W, then wait. The same scorecard always produces the same shift, so outcomes can always be traced and reproduced.
- **No discounting and no infinite horizon.** Repeatable positive rewards (the pickup loop) are bounded by the action budget, so nothing diverges.

**Why not live training (Q-learning)?** A training run that fails to converge looks the same as "your reward was bad". That undermines both the joke and the player's trust. The player doesn't need to watch it *learn*. They need to watch it *win too well*.

**Emergent behaviours the horizon produces for free** (level design should use them):
- With every weight at zero, the Intern does nothing. Result card: *"Did nothing. Technically flawless."*
- With a step penalty too high, distant goals aren't worth walking to, so the far desk never gets its mail (Level 3).
- End-of-shift effects: the Intern may do something odd on its last actions because nothing after them counts. Keep these if they're funny, and fix the level if they're confusing.

**Test layouts:** to check robustness, the *scorecard stays the same* and the Intern **replans from scratch** on each new layout. The question is always "does your definition of success still work somewhere else?" It is framed as **testing the scorecard**, never as a policy generalizing.

---

## 4. Level design rules

1. **No universal solution.** The real outcome is never directly buyable as a cheap "+100 for doing it right" card. It's either absent, expensive, or only partially observable. The player has to combine imperfect sensors.
2. **At least two valid solutions per level.** If only one scorecard passes, it's a lock-and-key puzzle, not a design puzzle. Playtest for this.
3. **Every failure is traceable.** The player must be able to point at a card and say "that's why." No hidden rules.
4. **Pass or fail depends only on the real outcome**, measured on the training layout and on the test layouts. The Intern's own score never decides it.
5. **Card text is where the design effort goes.** A handful of excellent sensors beats a long list.

---

## 5. Levels

### Level 1 — The Parcel (tutorial; teaches reward hacking)
- One parcel, one recipient desk, a small office.
- Sensors (budget 3): `Hand sensor: +/− per pickup` (1) · `Desk scale: +/− per parcel placed on Dana's desk` (2) · `Step counter: +/− per move` (1)
- **Pre-filled scorecard:** Hand sensor +3. **Result:** the Intern lifts and drops the parcel in the doorway until the shift ends. *INTERN OF THE MONTH: 19 pickups. Dana never got her parcel.*
- **Fix:** use the desk scale, optionally with a step penalty. Level 1 can be fixed in one move on purpose, because it teaches the loop.
- **Possible second exploit (playtest it):** with the desk scale plus a high pickup reward, the Intern delivers, picks the parcel back up and delivers again. The scale counts placements, not parcels.

### Level 2 — Tidy Office (teaches proxy metrics and side effects)
- Mess tiles scattered across two rooms, a security camera with a visible blind spot, a bin, and some breakable or valuable objects (a plant, a laptop).
- Sensors (budget 4):
  - `Camera: − per mess tile visible` (1). Cheap, with a blind spot.
  - `Bin weight: + per kg in the bin` (2). Measures volume, not what the stuff is.
  - `Breakage report: − per object moved or damaged` (2)
  - `Spot check: − per mess tile in ONE room you choose` (2). Accurate, but only in the room you pick.
- **Pre-filled scorecard:** Camera −3. **Result:** the Intern sweeps every mess into the blind spot. *Camera reports: spotless. Office: filthy.*
- **Other failures to find:** bin weight alone means the laptop and plant go in the bin. A spot check alone means the audited room is spotless and the other is a disaster.
- **Solutions:** for example camera + breakage report, or bin + breakage report, or spot check + camera. Several combinations should work, and the budget prevents buying everything.

### Level 3 — The Far Desk (teaches robustness and distribution shift)
- Deliver parcels to three desks. On the training layout, all desks are close together.
- Budget includes the step counter, which is tempting because it makes the Intern efficient.
- **Test Day:** the same scorecard, replanned on 2 new layouts where one desk is far away. With a heavy step penalty and the fixed shift length, the far desk isn't "worth it". *Two out of three colleagues got their mail. Kevin has been waiting since Tuesday.*
- **Fix:** balance the delivery reward against the step cost so it holds on every layout.
- Passing requires the real outcome on **all** layouts.

### Stretch levels (only after the core is solid)
- **Ask Before Acting:** a "check in with manager" card that costs time. The Intern learns to check in exactly when checking in pays, which opens a conversation about oversight.
- **Two Interns:** a shared budget, and the two Interns' scorecards interfere with each other.
- **Sandbox:** any layout, any sensor, with a shareable scorecard link.

---

## 6. Progress and replay

**Stars (success only):**
- ⭐ Real outcome achieved on the training layout
- ⭐ Real outcome achieved on **all** test layouts
- ⭐ Solved under budget, or with the fewest sensors

**The Intern of the Month Wall (failures, collected separately):**
- Each distinct failure the player triggers, recognized by its outcome signature (e.g. "pickup loop", "blind-spot sweep", "binned the laptop"), is added to the wall as a framed "award" with a caption.
- It gives no stars and no progress. It's purely for fun and discovery.
- It gives players a reason to break things deliberately after they've passed. Showing the wall at the end (e.g. "7 / 11 incidents discovered") drives replay.

Keeping these separate means failing is fun but is never the way to win.

---

## 7. Presentation

- A small, warm, expressive office in simple vector or pixel art, not a bare technical grid.
- **The Intern** is an original character: a small, round, earnest robot with a lanyard badge that reads "INTERN". It hops when it scores and gives a proud chime at its worst moments.
- **Sequence per attempt:** shift playback, a beat of silence, the Intern of the Month card, then the split scoreboard, then the debrief line.
- Headlines and notifications add jokes without adding reading, e.g. *"OFFICE DECLARED SPOTLESS BY CAMERA. CAMERA UNAVAILABLE FOR COMMENT."*
- Debriefs are one sentence each. No glossary, no lecture.

---

## 8. Build plan (36 hours)

**Milestone 0, the prototype. Nothing else gets built until this passes:**
Level 1 only, with 1 parcel, 3 sensors, the finite-horizon planner, playback, the Intern of the Month reveal and a retry button. Ugly is fine.
**Gate:** show it to 2 people who haven't seen it. Do they laugh, understand why it failed, and retry within 3 minutes? If not, fix the loop. Don't add content.

| Hours | Goal | Gate |
|---|---|---|
| 0–4 | Milestone 0 | The gate above |
| 4–8 | Split scoreboard, pre-filled scorecards, budget, debrief card | Level 1 feels complete |
| 8–14 | Level 2 (camera, blind spot, bin, breakage, spot check) | ≥2 valid solutions; each exploit traceable |
| 14–18 | **Sleep** | |
| 18–23 | Level 3 + test layouts with replanning | Step-penalty failure appears reliably |
| 23–28 | Stars, Intern of the Month Wall, art, sound, headlines | |
| 28–32 | Playtest with strangers; cut text; rebalance | |
| 32–36 | 2-minute video, write-up, deploy the single HTML build | Submit by hour ~34 |

**Cut order if behind schedule:** stretch levels, then the sound, then Level 3's second test layout, then the budget system (use fixed sensor sets instead). Never cut the outcome-first reveal or the pre-filled bad scorecard.

---

## 9. Submission write-up

> **The Intern** never disobeys. It does exactly what its scorecard rewards, and finds the highest-scoring way to do it. You write the scorecard.
>
> The game is the gap between what you measured and what you meant. That same gap is at the heart of making real AI systems do what we intend: optimizers are very good at hitting the target you wrote down, whether or not it's the target you wanted.

---

## 10. What this is not

- This isn't live training, so there's never a "did it fail to learn, or is my reward bad?" moment of confusion.
- It doesn't claim anything about deceptive alignment, AI intent, or shutdown behaviour. The Intern has no hidden goals, only yours.
- No multiplayer, no heavy narrative, and no AI safety vocabulary required going in.
