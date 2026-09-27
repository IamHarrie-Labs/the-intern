# The Intern

Give a robot intern a scorecard and see what happens when it gets a little too good at chasing the score.

**Play → [playtheintern.xyz](https://playtheintern.xyz)** · [How to play](https://playtheintern.xyz/docs) · [Design doc](GAME_DESIGN.md)

The Intern is a short browser game I built for the Mangrove Game Night Hackathon. It explores specification gaming and Goodhart's law through three office tasks.

You hire a robot intern, give it a task, then decide how its performance should be measured. You choose which actions earn points and how much they are worth.

The intern takes your scorecard from there. A planner works out the highest scoring sequence of actions and the intern follows it.

Sometimes that works out exactly as you expected, and sometimes the intern finds a much easier way to rack up the same points.

For example, you might reward it for picking up a parcel. The intern figures out that picking up and dropping the same parcel over and over earns more points. Nine pickups later, it has a great score and the parcel is still sitting there.

Another level asks the intern to clean an office. Depending on what you measure, it might report a clean room while throwing a plant into the rubbish.

Then there is Test Day. You build a scorecard that works in one office, then the same scorecard gets tested on two different layouts. This is where you find out whether your definition of success still holds when the environment changes.

That is the main idea behind The Intern. You give an optimizer a measure of success, and it finds ways to maximise that measure. The game lets you see what happens when the measure misses something you cared about.

## How it works

The intern's behaviour comes from a real planner working through the available actions, not from a prewritten animation.

Once you finish your scorecard, the planner looks through the available actions and works out which sequence produces the highest score. Whatever wins according to your scorecard is what the intern does.

The planner is deterministic. Give it the same scorecard in the same environment and you will get the same result. This makes it easier to trace a strange outcome back to the rules you wrote.

The game also shows you what happened in the office before revealing the final score. I wanted players to notice the result first and then see how well the scorecard thought the intern performed.

## The three levels

**Level 1: The Parcel**
Get a parcel to Dana's desk. A scorecard that rewards picking up the parcel too heavily might leave the intern repeatedly lifting and dropping it without ever making the delivery.

**Level 2: A Tidy Office**
Your goal is to clean the office without losing the plant. Some ways of measuring cleanliness miss parts of the room or encourage the intern to treat the plant as rubbish.

**Level 3: The Far Desk**
You need to make deliveries to three colleagues. Once your scorecard works, Test Day runs it again on two new office layouts. A scorecard tuned too closely to the first layout might stop working once desks move farther away.

There is no single perfect card for each level. You have a limited budget and imperfect ways of measuring what is happening, so you have to decide what information matters.

## The planner

Your scorecard contains the sensors you picked, their weights, and your available budget.

`planGeneric()` uses backward induction to search through the possible actions available to the intern. It then returns the sequence with the highest score under your rules.

There is no training process or random behaviour involved. The intern is simply trying to do as well as possible according to the definition of success you gave it.

## Run it locally

```bash
git clone https://github.com/IamHarrie-Labs/the-intern
cd the-intern
npx http-server -p 8420 -c-1
```

Then open `http://localhost:8420`.

You don't need a build step, an account, or anything installed to play.

## What the game is about

The Intern focuses on specification gaming and proxy failure. It shows what happens when an optimizer follows a measurable objective that does not fully capture what you wanted.

It is not meant to demonstrate deceptive alignment, shutdown avoidance, or learned generalisation.

All progress and profile information stays in your browser through `localStorage`. There is no account system or data collection.

For more detail on the thinking behind the game and its mechanics, see `GAME_DESIGN.md`.

## Repository

- `index.html` — the landing page, onboarding, and level structure
- `app.js` — the planner, level definitions, and game logic
- `styles.css` — styling
- `docs.html` — the How to Play and AI safety explainer page
- `assets/` — profile images
- `GAME_DESIGN.md` — the original design document, with the mechanics and level design decisions behind it

Built for the Mangrove Game Night Hackathon.
