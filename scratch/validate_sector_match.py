import pandas as pd
import openpyxl
from pathlib import Path

map_path = "/Users/67620/scrap_sector/dashboard-lapkeu/mapping_subindustri_sektor_subsektor.xlsx"
pdrb_path = "/Users/67620/scrap_sector/dashboard-lapkeu/PDRB_2026.xlsx"

df_map = pd.read_excel(map_path)
unique_map_sectors = df_map['sektor_pdb'].dropna().unique()

wb = openpyxl.load_workbook(pdrb_path, read_only=True)
headers = [str(h).strip() for h in next(wb.active.iter_rows(values_only=True))]
pdrb_sectors = headers[1:-1] # columns between Provinsi and Total

print("Unique PDB sectors in Mapping:", sorted(unique_map_sectors))
print("\nUnique PDB sectors in PDRB 2026 Columns:", sorted(pdrb_sectors))

print("\nMismatch check:")
for s in unique_map_sectors:
    if s not in pdrb_sectors:
        print(f"  Mapping Sector '{s}' NOT found in PDRB 2026 columns!")
for s in pdrb_sectors:
    if s not in unique_map_sectors:
        print(f"  PDRB 2026 Column '{s}' NOT found in Mapping sectors!")
