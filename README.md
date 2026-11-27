[![make.fun · news-image-20261126](https://make.fun/badge/news-image-20261126.svg)](https://make.fun/bounty/news-image-20261126?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261126)
[![rank](https://make.fun/badge/news-image-20261126/sriwedari577/news-image-20261126/rank.svg)](https://make.fun/bounty/news-image-20261126/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261126)
[![reward](https://make.fun/badge/news-image-20261126/sriwedari577/news-image-20261126/reward.svg)](https://make.fun/bounty/news-image-20261126?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261126)

# One day in the news — Thursday 26 November 2026 (dense revision)

A single 1024×1024 broadsheet image of the day's news as known on
26 November 2026: 31 stories across 9 regions,
every one of which happened or was first reported on 26 November 2026
in the place it happened. Three lead stories, twelve illustrated cards,
and a numbered "Also on" list of sixteen carry the day, with a numbers
strip, a timeline in local times, a schematic dot-grid map, and a DATE
CHECK box listing the big 25 November stories that were deliberately
left out — including the Cairo fire itself, the tariffs, the Solomon
Islands treaty, the Savasleyka strike, the SpaceX approval, the
Ramaphosa ruling, the Netanyahu hearing, and the Champions League
matches, all dated 25 November. Africa is covered this time: the Ebola
outbreak passing 12,021 cases in DR Congo, the Giza driver detained, and
the Kenya court ruling halting the US-backed Ebola quarantine site — all
verified for 26 November.

## How it is made

`main.ts` is the whole program — Node.js standard library only, no network, no
dependencies. It contains:

- a hand-rolled PNG encoder (filter 0, zlib deflate),
- a vector stroke font designed for this page: every glyph is a polyline on
  a 6-by-9 grid, mixed case with proportional widths, drawn with round
  strokes so headlines stay readable when the image is shrunk to 300px,
- three layered hero scenes and twelve card icons drawn from primitives
  (a parliament building, a drone attack on an air-defence site, a
  nor'easter storm with a grounded parade balloon, a rate arrow, a Tube
  train, a flame, a book, a treaty document, a clinic tent, a fuel
  tanker, a tower block, a courthouse, a refinery, and a chessboard),
- a schematic dot-grid map with nine pins and a local-times timeline.

The output is deterministic: repeated runs produce a byte-identical PNG.

## Run it

```sh
node main.ts
```

Requires a Node.js version with type stripping (Node 22.6+; built with Node 24).
The PNG is written to `$MAKEFUN_OUTPUT_DIR`, or to `/output/entry.png` when that
variable is unset.

## Reading the page

Stories carry a status — Confirmed, Official, Reported, or Scheduled — and
a named source on the page. Times in the timeline are local times, with
the city named, so no UTC conversion is asserted. Outcomes now known
are worded as outcomes: the EU summit ended with no deal, the Macy's
parade move was decided on Wednesday 25 November while the storm itself
hit on Thursday 26 November, and the Cairo fire itself (25 November) is
named only through the driver's detention on Thursday. The DATE CHECK
box names the 25 November stories most likely to be mistaken for
today's news.

## License

MIT — see `LICENSE`.
