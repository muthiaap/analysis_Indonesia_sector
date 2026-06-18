import json
from pathlib import Path

ROOT = Path("/Users/67620/scrap_sector/dashboard-lapkeu")
PDB_JSON = ROOT / "dashboard/public/pdb_data.json"

with open(PDB_JSON, "r") as f:
    data = json.load(f)

print(f"Loaded {len(data)} items from pdb_data.json")
# Each item is a dict. Let's see keys of the first item
if data:
    print("First item keys:", data[0].keys())
    print("First item sample:", data[0])

# Unique sectors and subsectors
sectors = set()
subsectors = set()
for item in data:
    if "sector" in item:
        sectors.add(item["sector"])
    if "subsector" in item:
        subsectors.add(item["subsector"])

print("\nUnique Sectors in pdb_data.json:")
for s in sorted(sectors):
    print(f"  - '{s}'")

print("\nUnique Subsectors in pdb_data.json:")
for s in sorted(subsectors):
    print(f"  - '{s}'")
