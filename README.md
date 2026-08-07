# Tracery

**Generative geometric marks** — minimal compositions of circles, polygons and lines arranged by simple geometric rules, in the spirit of contemporary brand illustration systems.

**[→ Try it live](https://pierrelouislabonne.github.io/tracery/)**

## What it does

Each generation picks a composition rule, a shape, a random count (3–7 elements) and proportions — all driven by a visible seed, so any mark can be reproduced.

**17 composition rules:** tangent circles, concentric shapes, clover/Venn/vesica, diagonal trails, rotational stars, inscribed alternations, orbit satellites, vertical stacks, half-circle arches, grids, sun rays, striped discs, chevrons, ray fans, horizon, planet ellipses, moon phases.

**Shape vocabulary:** circle, ellipse, square, triangle, diamond, pentagon, hexagon, octagon, capsule, half-circle, line segment.

Every stroke fades progressively in opacity along the sequence, on a dark dotted-grid canvas (light theme available).

## Usage

- **Click the canvas** or hit **Generate** for a new mark
- The **seed** shown above the canvas reproduces any composition exactly
- **SVG export** outputs native primitives (`circle`, `polygon`, `line`, arc paths) — ready for Figma or per-element animation (GSAP, Webflow interactions)

## API

Tracery can be driven programmatically — by a script, or by an AI agent generating marks on your behalf. Nothing to install: the published page *is* the API.

### For AI agents

The mark is drawn client-side into a `<canvas>`, so **fetching the URL returns an empty shell** — there is no mark in the HTTP response. Driving Tracery takes a real browser (Playwright, Puppeteer, a browser-automation tool), not an HTTP client.

1. Open the page with your parameters.
2. Wait for `document.documentElement.dataset.traceryReady === '1'` — the first mark is drawn and `window.tracery` is callable.
3. Call `tracery.toSVG()` for the vector, or screenshot `<canvas id="c">` to just look at it. `tracery.state().url` reproduces the mark later.

Use `toSVG()`, not `download()` — the latter triggers a browser download that lands outside an agent's reach.

[`llms.txt`](llms.txt) is the same brief in a form you can hand straight to a model.

### URL parameters

Every parameter is optional. Omitted, each keeps its default.

```
https://pierrelouislabonne.github.io/tracery/?seed=8421&rule=orbit&dark=0&grid=0
```

| Parameter | Values | Default |
|---|---|---|
| `seed` | integer | random |
| `rule` | `auto` or a rule key | `auto` |
| `dark` | `1` / `0` | `1` |
| `grid` | `1` / `0` | `1` |
| `fade` | `1` / `0` | `1` |

### Rule keys

Pick from the intent, or leave `auto` and let the seed decide.

| Key | Composition | Reads as |
|---|---|---|
| `tangent` | shrinking shapes sharing one tangency line | growth, hierarchy |
| `concentric` | nested copies of one shape around a center | focus, depth |
| `clover` | 2–5 overlapping circles around a center | union, community, vesica |
| `trail` | one shape repeated along a diagonal | motion, speed, extrusion |
| `rotation` | a polygon copied at rotated angles | energy, symmetry, star |
| `inscribed` | circles and polygons alternately inscribed | structure, nesting |
| `orbit` | small satellites spaced on a large circle | system, network, ecosystem |
| `stack` | different shapes resting on one another | assembly, balance |
| `arches` | nested half-shapes on a shared baseline | arch, shelter, sunset |
| `grid` | 2×2 or 3×3 of one shape, often interlocking | modularity, repetition |
| `rays` | a central shape ringed by short radial segments | sun, radiance, broadcast |
| `hatching` | chords filling a shape, or parallel bands | texture, layers, data |
| `chevrons` | stacked Vs, alone or flanking a shape | direction, progress, signal |
| `fan` | segments converging on a point | convergence, beam, focus |
| `horizon` | a half-shape over receding lines | landscape, calm, sun on water |
| `ellipses` | a circle flattened into narrowing ellipses | planet, sphere, rotation |
| `phases` | one shape repeated along the vertical axis | cycle, sequence, moon phases |

### `window.tracery`

```js
tracery.generate({ seed, rule, dark, grid, fade })  // render; returns state()
tracery.toSVG()                                     // SVG string
tracery.state()                                     // seed, rule, toggles, permalink
tracery.rules()                                     // the 17 rule keys
tracery.geometry()                                  // raw shapes, alphas, dashes
tracery.download()                                  // trigger the SVG download
```

`generate()` without a seed draws one at random and returns it, so any mark can be reproduced later. All arguments are optional; unspecified options keep their current value.

```js
const { seed, rule, url } = tracery.generate({ rule: 'orbit', dark: false });
const svg = tracery.toSVG();
```

### Notes

`state()` returns both `rule` — the rule actually used — and `ruleInput`, which is `auto` when the rule was left to chance. **Reproduce with `ruleInput`, not `rule`:** under `auto` the seed also drives the rule pick, so replaying a seed with the resolved rule yields a different mark. The `url` field always carries the correct combination.

Exported SVGs have a **transparent background**, which is what you want when placing a mark on a surface you control. Bear in mind that a dark-theme mark is drawn in near-white strokes: standalone, on a light page, it will be invisible. Use `dark=0` for marks that need to stand on their own.

The dotted grid, when enabled, **is part of the export**: with `grid=1` (the default) the SVG includes the backdrop dots. Set `grid=0` — or untick Grid — before exporting if you want the mark alone.

## Tech

A single self-contained HTML file. No dependencies, no build step. Canvas rendering with exact vector geometry, seeded PRNG (mulberry32), area-weighted optical centering.

## License

MIT
