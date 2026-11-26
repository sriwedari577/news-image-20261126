[![make.fun · news-image-20261126](https://make.fun/badge/news-image-20261126.svg)](https://make.fun/bounty/news-image-20261126?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261126)
[![rank](https://make.fun/badge/news-image-20261126/sriwedari577/news-image-20261126/rank.svg)](https://make.fun/bounty/news-image-20261126/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261126)
[![reward](https://make.fun/badge/news-image-20261126/sriwedari577/news-image-20261126/reward.svg)](https://make.fun/bounty/news-image-20261126?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261126)

# One day in the news — Thursday 26 November 2026

A single 1024×1024 broadsheet image of the day's news as known early on
26 November 2026 (late morning in Canberra and Sydney, just after midnight
in London): 14 stories, every one of which happened, was first reported,
or was scheduled to occur on 26 November 2026 in the place it happened,
drawn entirely in code. Three lead stories, six illustrated cards, and an
"Also on" list carry the day, with a numbers strip, a timeline in local
times, a schematic dot-grid map, and a DATE CHECK box listing the big
25 November stories that were deliberately left out — the previous draft
had mistaken twelve 25 November stories for 26 November news, and the
revision removed all of them after an independent re-check of every story
against its source.

## How it is made

`main.ts` is the whole program — Node.js standard library only, no network, no
dependencies. It contains:

- a hand-rolled PNG encoder (filter 0, zlib deflate),
- a vector stroke font designed for this page: every glyph is a polyline on
  a 6-by-10 grid, mixed case with proportional widths and a heavy display
  weight, so headlines stay readable when the image is shrunk to 300px,
- ten layered scenes drawn from primitives (gradient skies, buildings,
  charts, a train, a ferry, a chessboard, and other identifiable objects),
- a schematic dot-grid map with six pins.

The output is deterministic: repeated runs produce a byte-identical PNG.

## Run it

```sh
node main.ts
```

Requires a Node.js version with type stripping (Node 22.6+; built with Node 24).
The PNG is written to `$MAKEFUN_OUTPUT_DIR`, or to `/output/entry.png` when that
variable is unset.

## Reading the page

Stories carry a status — Confirmed or Reported — and a named source, in the
hero and card captions. Times in the timeline are local times, with the
city named, so no UTC conversion is asserted. Scheduled events (the EU
summit, the Tube walkout, the ferry stoppage, Chess Game 3) are worded as
occurring on 26 November, with no result claimed before it happens. The
DATE CHECK box names the 25 November stories most likely to be mistaken
for today's news, and states plainly that no verified 26-November hook was
found for East Asia, Africa, the Middle East or South America at the time
of building.

## License

MIT — see `LICENSE`.
