import json
from pathlib import Path

ROOT = Path("/Users/67620/scrap_sector/dashboard-lapkeu")
PDB_JSON = ROOT / "dashboard/public/pdb_data.json"

with open(PDB_JSON, "r") as f:
    data = json.load(f)

sector_to_sub = {}
for item in data:
    sec = item.get("sector")
    sub = item.get("subsector")
    if sec and sub:
        if sec not in sector_to_sub:
            sector_to_sub[sec] = set()
        sector_to_sub[sec].add(sub)

print("Sectors and their Subsectors in pdb_data.json:")
print("=" * 60)
for sec in sorted(sector_to_sub.keys()):
    print(f"Sector: '{sec}'")
    for sub in sorted(sector_to_sub[sec]):
        print(f"  - '{sub}'")
