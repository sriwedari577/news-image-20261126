[![make.fun · news-image-20261126](https://make.fun/badge/news-image-20261126.svg)](https://make.fun/bounty/news-image-20261126?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261126)
[![rank](https://make.fun/badge/news-image-20261126/sriwedari577/news-image-20261126/rank.svg)](https://make.fun/bounty/news-image-20261126/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261126)
[![reward](https://make.fun/badge/news-image-20261126/sriwedari577/news-image-20261126/reward.svg)](https://make.fun/bounty/news-image-20261126?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261126)

# One day in the news — Thursday 26 November 2026 (dense revision)

A single 1024×1024 broadsheet image of the day's news as known on
26 November 2026: 31 stories across 7 regions,
every one of which happened, was first reported, or was scheduled to
occur on 26 November 2026 in the place it happened. Three lead stories,
twelve illustrated cards, and a numbered "Also on" list of sixteen carry
the day, with a numbers strip, a timeline in local times, a schematic
dot-grid map, and a DATE CHECK box listing the big 25 November stories
that were deliberately left out — including the veterans apology, the
4.9% CPI release, the duty-of-care law, the Solomon Islands treaty, the
Cairo fire, the Savasleyka strike, the SpaceX Starmind approval, the
Ramaphosa ruling, the Netanyahu judges' recommendation, the US tariff
proposals, and the Champions League matches, all dated 25 November. No
verified 26-November hook was found for Africa, and that gap is stated
plainly in the image.

## How it is made

`main.ts` is the whole program — Node.js standard library only, no network, no
dependencies. It contains:

- a hand-rolled PNG encoder (filter 0, zlib deflate),
- a vector stroke font designed for this page: every glyph is a polyline on
  a 6-by-9 grid, mixed case with proportional widths, drawn with round
  strokes so headlines stay readable when the image is shrunk to 300px,
- three layered hero scenes and twelve card icons drawn from primitives
  (a parliament building, a rising chart, a Tube train, a rate
  arrow, EU stars, a flame, a leaf, an oil barrel, waves, a storm cloud,
  a treaty document, a chessboard, a book, a market chart, and servers),
- a schematic dot-grid map with seven pins and a local-times timeline.

The output is deterministic: repeated runs produce a byte-identical PNG.

## Run it

```sh
node main.ts
```

Requires a Node.js version with type stripping (Node 22.6+; built with Node 24).
The PNG is written to `$MAKEFUN_OUTPUT_DIR`, or to `/output/entry.png` when that
variable is unset.

## Reading the page

Stories carry a status — Confirmed or Reported — and a named source in the
research record. Times in the timeline are local times, with the city named,
so no UTC conversion is asserted. Scheduled events (the EU summit, the Tube
walkout, Chess Game 3, the ECLAC lecture, the Correios strike) are worded as
occurring on 26 November, with no result claimed before it happens. The
DATE CHECK box names the 25 November stories most likely to be mistaken
for today's news.

## License

MIT — see `LICENSE`.
