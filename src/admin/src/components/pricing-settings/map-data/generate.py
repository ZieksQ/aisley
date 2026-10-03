"""Convert faeldon's regional lowres TopoJSON files to compact SVG paths.

Usage (from repository root):
python3 src/admin/src/components/pricing-settings/map-data/generate.py SOURCE_DIRECTORY
"""

import json
import math
import sys
from pathlib import Path


def decode_arcs(topology):
    transform = topology["transform"]
    decoded = []
    for arc in topology["arcs"]:
        x = y = 0
        points = []
        for dx, dy in arc:
            x += dx
            y += dy
            longitude = x * transform["scale"][0] + transform["translate"][0]
            latitude = y * transform["scale"][1] + transform["translate"][1]
            # Mercator coordinates, north at the top; no runtime projection library.
            points.append((math.radians(longitude), -math.log(math.tan(math.pi / 4 + math.radians(latitude) / 2))))
        decoded.append(points)
    return decoded


def main():
    source = Path(sys.argv[1])
    regions = {}
    files = sorted(source.glob("provdists-region-*.topo.0.001.json"))
    if len(files) != 17:
        raise ValueError("Expected all 17 source regional TopoJSON files")

    for file in files:
        topology = json.loads(file.read_text())
        arcs = decode_arcs(topology)
        for geometry in next(iter(topology["objects"].values()))["geometries"]:
            properties = geometry["properties"]
            code = str(properties["adm1_psgc"]).zfill(10)
            if properties["adm2_en"] in {"Negros Occidental", "Negros Oriental", "Siquijor"}:
                code = "1800000000"
            elif properties["adm2_en"] == "Sulu":
                code = "0900000000"
            polygons = [geometry["arcs"]] if geometry["type"] == "Polygon" else geometry["arcs"]
            for polygon in polygons:
                for ring in polygon:
                    points = []
                    for index in ring:
                        segment = arcs[index] if index >= 0 else list(reversed(arcs[~index]))
                        points.extend(segment if not points else segment[1:])
                    regions.setdefault(code, []).append(points)

    coordinates = [point for rings in regions.values() for ring in rings for point in ring]
    min_x, max_x = min(p[0] for p in coordinates), max(p[0] for p in coordinates)
    min_y, max_y = min(p[1] for p in coordinates), max(p[1] for p in coordinates)
    width, height, padding = 360, 480, 12
    scale = min((width - padding * 2) / (max_x - min_x), (height - padding * 2) / (max_y - min_y))
    offset_x = (width - (max_x - min_x) * scale) / 2
    offset_y = (height - (max_y - min_y) * scale) / 2
    paths = {}
    for code, rings in sorted(regions.items()):
        commands = []
        for ring in rings:
            for index, (x, y) in enumerate(ring):
                commands.append(f'{"M" if index == 0 else "L"}{(x - min_x) * scale + offset_x:.2f},{(y - min_y) * scale + offset_y:.2f}')
            commands.append("Z")
        paths[code] = "".join(commands)

    current = json.loads(Path("packages/psgc-address-data/data/list-of-all-regions.json").read_text())
    if set(paths) != {region["psgc_code"] for region in current}:
        raise ValueError("Generated paths must match the bundled PSGC region inventory")
    target = Path(__file__).with_name("region-paths.json")
    target.write_text(json.dumps(paths, indent=2) + "\n")
    print(f"Generated {len(paths)} regional paths ({target.stat().st_size:,} bytes)")


if __name__ == "__main__":
    main()
