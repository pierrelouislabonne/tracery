# Tracery

**Generative geometric marks** — minimal compositions of circles, polygons and lines arranged by simple geometric rules, in the spirit of contemporary brand illustration systems.

**[→ Try it live](https://pierrelouislabonne.github.io/tracery/)**

## What it does

Each generation picks a composition rule, a shape, a random count (3–7 elements) and proportions — all driven by a visible seed, so any mark can be reproduced.

**17 composition rules:** tangent circles, concentric shapes, clover/Venn/vesica, diagonal trails, rotational stars, inscribed alternations, orbit satellites, vertical stacks, half-circle arches, grids, sun rays, striped discs, chevrons, ray fans, horizon, planet ellipses, moon phases.

**Shape vocabulary:** circle, ellipse, square, triangle, diamond, pentagon, hexagon, octagon, capsule, half-circle, line segment.

Every stroke fades progressively in opacity along the sequence, on a dark dotted-grid canvas (light theme available).

## Usage

- **Click the canvas** or hit **Générer** for a new mark
- The **seed** shown above the canvas reproduces any composition exactly
- **SVG export** outputs native primitives (`circle`, `polygon`, `line`, arc paths) — ready for Figma or per-element animation (GSAP, Webflow interactions)
- **PNG export** at 1440×1440

## Tech

A single self-contained HTML file. No dependencies, no build step. Canvas rendering with exact vector geometry, seeded PRNG (mulberry32), area-weighted optical centering.

## License

MIT
