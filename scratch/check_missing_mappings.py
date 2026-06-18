import pandas as pd
import openpyxl
from pathlib import Path

ROOT = Path("/Users/67620/scrap_sector/dashboard-lapkeu")
DETAIL_CSV = Path("/Users/67620/scrap_sector/scrap_idx/detail_perusahaan.csv")
MAP_XLSX = ROOT / "mapping_subindustri_sektor_subsektor.xlsx"
PDRB_XLSX = ROOT / "PDRB_2026.xlsx"

# 1. Load companies data
df_comp = pd.read_csv(DETAIL_CSV)
print(f"Loaded {len(df_comp)} companies from {DETAIL_CSV}")
print("Unique Sektor in companies:", df_comp['Sektor'].unique())

# 2. Load mapping
df_map = pd.read_excel(MAP_XLSX)
df_map.columns = [c.strip() for c in df_map.columns]
print(f"Loaded {len(df_map)} mapping rows from {MAP_XLSX}")

# 3. Load PDRB columns
wb_pdrb = openpyxl.load_workbook(PDRB_XLSX, read_only=True)
pdrb_cols = [str(h).strip() for h in next(wb_pdrb.active.iter_rows(values_only=True))][1:-1]
print(f"Loaded {len(pdrb_cols)} PDRB sector columns from {PDRB_XLSX}")

# Check unmapped subindustries
comp_subindustries = set(df_comp['Subindustri'].dropna().unique())
map_subindustries = set(df_map['Subindustri_idx'].dropna().unique())

missing_sub = comp_subindustries - map_subindustries
print(f"\nSubindustries in companies but MISSING from mapping ({len(missing_sub)}):")
for s in sorted(missing_sub):
    # Find one example company for context
    example = df_comp[df_comp['Subindustri'] == s].iloc[0]
    print(f"  - '{s}' | IDX Sektor: '{example['Sektor']}' | Subsektor: '{example['Subsektor']}'")

# Check rows in mapping with empty sektor_pdb or subsektor_pdb
null_pdb = df_map[df_map['sektor_pdb'].isna() | df_map['subsektor_pdb'].isna()]
if len(null_pdb) > 0:
    print(f"\nMapping rows with empty/null sektor_pdb or subsektor_pdb ({len(null_pdb)}):")
    for _, row in null_pdb.iterrows():
        print(f"  - Subindustri_idx: '{row['Subindustri_idx']}' | sektor_pdb: '{row['sektor_pdb']}' | subsektor_pdb: '{row['subsektor_pdb']}'")
else:
    print("\nNo rows in mapping have null/empty PDB sector or subsector! Good.")

# Check spelling mismatches between mapped sektor_pdb and PDRB columns
mapped_pdb_sectors = set(df_map['sektor_pdb'].dropna().unique())
print("\nMapped PDB Sectors validation against PDRB Columns:")
for s in sorted(mapped_pdb_sectors):
    if s not in pdrb_cols:
        # Check if a close match exists
        close_matches = [p for p in pdrb_cols if p.lower().replace(",", "").replace(";", "").replace(" ", "") == s.lower().replace(",", "").replace(";", "").replace(" ", "")]
        if close_matches:
            print(f"  - '{s}' NOT found in PDRB, but close match found: '{close_matches[0]}'")
        else:
            print(f"  - '{s}' NOT found in PDRB columns and NO close match found!")

# Check if there are PDRB columns that have no companies mapping to them
print("\nPDRB columns with no mapping:")
for col in sorted(pdrb_cols):
    matched_rows = df_map[df_map['sektor_pdb'] == col]
    # Check close matches too
    close_rows = df_map[df_map['sektor_pdb'].apply(lambda x: str(x).lower().replace(",", "").replace(";", "").replace(" ", "") == col.lower().replace(",", "").replace(";", "").replace(" ", "") if pd.notna(x) else False)]
    if len(matched_rows) == 0 and len(close_rows) == 0:
        print(f"  - '{col}' (No subindustries map to this PDRB sector)")
