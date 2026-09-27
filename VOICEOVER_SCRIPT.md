# The Intern — Voiceover Script (~4 minutes)

---

**[SCREEN: landing page, "The Intern" title]**

Hi, I'm Harrie, and this is The Intern, a short browser game I built for Game Night.

Here's the setup. You hire a robot intern for a few office tasks. You never control it directly. Instead, you write its scorecard: you decide which actions earn points, and how much. The intern takes that scorecard and does whatever scores highest.

The idea I wanted to explore is specification gaming, sometimes called Goodhart's law: once a measure becomes the target, it stops being a good measure. It's one of the more practical risks in real AI systems today, not a far-off one, and I wanted players to feel it happen instead of reading about it.

---

**[SCREEN: Level 1, building a scorecard]**

Let's play Level 1. The goal is simple: get this parcel to Dana's desk.

I'll build a scorecard. Say I reward the intern for picking the parcel up.

**[SCREEN: click Run, watch the shift play out]**

Watch what happens. The intern picks it up… and puts it down. Then picks it up again.

**[SCREEN: result screen — "Nine pickups. No delivery."]**

Nine pickups, and Dana never got her parcel. The score looks great. The scorecard never said anything about delivery, only about picking it up, and the intern found the cheapest way to satisfy exactly what I wrote.

That's the whole game in miniature. Nothing here is scripted or random. There's a real planner underneath that works out the highest-scoring sequence of actions given the rules I set, so this isn't a gotcha I built in. It's what my own scorecard actually asked for.

---

**[SCREEN: Level 2, the office grid with camera blind spot]**

Level 2 raises the stakes a little. Now the intern has to clean an office, and there's a plant in the corner that shouldn't get thrown out.

If I reward it based only on what a security camera can see, and that camera has a blind spot…

**[SCREEN: result — "Camera reports: spotless. Office: filthy."]**

…the camera reports a spotless office while half the mess never got touched. Measure the wrong thing, and a good score stops meaning anything.

---

**[SCREEN: Level 3, three colleague desks]**

Level 3 is where it gets interesting. Here the intern has to deliver to three colleagues, and once I've got a scorecard that works, I can run something called Test Day.

**[SCREEN: click "Run Test Day"]**

Test Day takes that exact same scorecard, unchanged, and replays it on two new office layouts. It's asking one question: does your definition of success still hold once the environment changes?

**[SCREEN: Test Day result — one layout fails]**

And here, a scorecard that worked perfectly in the training office falls apart the moment a desk moves farther away. That's distribution shift: a fix that looks solid on the case you tuned it on can still quietly fail somewhere else.

---

**[SCREEN: landing page or GitHub repo]**

That's The Intern. Three levels, no reading required to understand what went wrong, because you watch it happen, and then a one-line debrief connects it back to the scorecard you actually wrote.

It's built as a single static site, no backend, runs in any browser. I used Claude Code to build the whole thing: the planner, the levels, the interface, and I directed and reviewed every decision myself.

Thanks for watching. I'd love to hear what you think.

---

## Timing notes
- Full read-through should land around 3:45–4:15 at a relaxed pace.
- If you're over 5 minutes, cut the Level 2 section entirely — Levels 1 and 3 alone carry the argument.
- Pause a beat after each result screen before speaking again. The silence is part of the joke landing.
