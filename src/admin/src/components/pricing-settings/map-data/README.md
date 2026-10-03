# Philippine pricing region paths

`region-paths.json` is a generated SVG path inventory derived from the 17 files in
[faeldon/philippines-json-maps, 2023/topojson/regions/lowres](https://github.com/faeldon/philippines-json-maps/tree/8eeead560246863c8c820c31ca6fbca81a279477/2023/topojson/regions/lowres).
Source revision: `8eeead560246863c8c820c31ca6fbca81a279477`. The upstream MIT license
is preserved in `LICENSE`.

The generator decodes TopoJSON arcs, projects longitude/latitude to Mercator,
fits all islands into a `360 × 480` SVG coordinate space, and rounds to two decimal
places. All geometry is bundled locally; the browser requests no map service.
There are no new frontend dependencies.

The source geometry reflects December 2023 administrative boundaries. For the
app's bundled PSGC inventory, Negros Occidental, Negros Oriental, and Siquijor are
grouped under Negros Island Region (`1800000000`), and Sulu under Zamboanga
Peninsula (`0900000000`). Other source region memberships remain intact.
These simplified shapes assist surcharge selection; they do not establish legal
boundaries, routing, or delivery coverage. Authoritative selection names and codes
continue to come from `@aisley/psgc-address-data`.

To regenerate, download the 17 `provdists-region-*.topo.0.001.json` files from the
pinned upstream directory into a scratch directory inside this repository, then
run from the repository root:

```sh
python3 src/admin/src/components/pricing-settings/map-data/generate.py SOURCE_DIRECTORY
```

The generator checks that its resulting inventory matches the bundled PSGC regions.
Do not commit the scratch source downloads.
