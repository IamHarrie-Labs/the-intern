# The Intern

**Give a robot a scorecard. Watch it win too well.**

**Play → [the-intern-six.vercel.app](https://the-intern-six.vercel.app)** · [How to play](https://the-intern-six.vercel.app/docs) · [Design doc](GAME_DESIGN.md)

Mangrove Game Night Hackathon · AI safety, played rather than explained

---

You hire a robot intern for three office tasks. You never move it yourself: you write its scorecard, choosing what earns points and how much, and a real optimizer works out whichever sequence of actions scores highest under exactly what you wrote. You watch what actually happened in the office before you see the score, so the gap between the two shows up on its own.

Reward pickups instead of delivery, and the intern lifts the parcel and drops it nine times, scoring great, while the recipient never gets it. Reward whatever a camera can see, and it reports a spotless office while a plant gets thrown out with the rubbish. Tune a scorecard until it finally works, then run "Test Day," and watch it fail the moment the office layout changes.

This is specification gaming and Goodhart's law: once a measure becomes the target, it stops being a good measure. The game never states that as a moral. It's the mechanic.

## What makes it different

1. **The optimizer is real, not scripted.** Every outcome comes from an exact finite-horizon planner (backward induction over `state × steps remaining`), not a canned animation. Whatever scores highest under your scorecard is what plays out, including exploits the level designer didn't plan for. ([`app.js`](app.js) — `planGeneric`, line 13)

2. **It's deterministic on purpose.** No randomness, no training run that might fail to converge. The same scorecard always produces the same shift, so a bad result is always evidence you can trace back to a specific card, never bad luck.

3. **The outcome comes before the score.** Every result screen shows what physically happened in the office first, then the number the scorecard produced, then a one-line debrief tying the two together. The player feels the gap before they read an explanation of it.

4. **Test Day checks robustness, not memorization.** Level 3's scorecard gets replanned from scratch on two new office layouts, unchanged. The question it asks is always "does your definition of success still work somewhere else," never "did the intern learn a general policy." ([`app.js`](app.js) — `L3_LAYOUTS`, line 209)

5. **Every level has more than one honest solution.** None of the three levels has a single "+100 for doing it right" card. The real outcome is either unmeasurable directly, expensive to check, or only partly observable, so the player has to combine imperfect sensors and a limited budget.

## How a scorecard becomes a plan

```
your scorecard (which sensors, what weight, budget)
        │
        ▼
planGeneric(): backward induction over (state, steps remaining)
        │   deterministic tie-break: interact › N › E › S › W › wait
        │   bounded, exact, no discounting, no infinite horizon
        ▼
the highest-scoring action sequence under your scorecard, played out
        │
        ▼
result: what actually happened → what the scorecard says → why they diverged
```

## The three levels

| Level | Goal | What breaks a naive scorecard |
|---|---|---|
| 1 · The Parcel | Get the parcel to Dana's desk | Rewarding pickups instead of delivery: the intern lifts and drops it forever |
| 2 · A Tidy Office | Clean every mess spot without losing the plant | A camera with a blind spot reports "clean" while half the room is untouched, or a bin sensor throws out the plant along with the mess |
| 3 · The Far Desk | Deliver to three colleagues, then hold up on Test Day | A step penalty tuned for one office layout makes the far desk "not worth the walk" the moment the layout changes |

## Try it yourself

No build step, no dependencies, no account:

```bash
git clone https://github.com/IamHarrie-Labs/the-intern
cd the-intern
npx http-server -p 8420 -c-1
# open http://localhost:8420
```

## What The Intern does not claim

- It demonstrates **specification gaming and proxy failure**: an optimizer maximizing a flawed objective in a small, designed environment.
- It is **not** a demonstration of deceptive alignment, learned generalization, or shutdown avoidance, and the game's copy is written to avoid implying those.
- Progress and profile data live in the browser's `localStorage` only. There is no account, no server, and no data collection.

Full reasoning behind these design choices: [GAME_DESIGN.md](GAME_DESIGN.md).

## Repository

```
index.html     landing page, onboarding, and the three level shells
app.js         the planner, all three level definitions, and UI wiring
styles.css     all styling
docs.html      the "How to play" / AI safety explainer page
assets/        avatar images used in the profile picker
GAME_DESIGN.md the original design document: mechanics, level design rules, build plan
```

Built for a hackathon deadline. Not a general framework, just this game.
