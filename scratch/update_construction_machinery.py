import pandas as pd
from pathlib import Path

ROOT = Path("/Users/67620/scrap_sector/dashboard-lapkeu")
MAP_XLSX = ROOT / "mapping_subindustri_sektor_subsektor.xlsx"

# Load mapping excel
df = pd.read_excel(MAP_XLSX)
df.columns = [c.strip() for c in df.columns]

# Print current values for 'Mesin Konstruksi & Kendaraan Berat'
mask = df['Subindustri_idx'] == 'Mesin Konstruksi & Kendaraan Berat'
if mask.any():
    row_idx = df[mask].index[0]
    print("Current values before update:")
    print(df.loc[row_idx])
    
    # Update
    df.loc[mask, 'sektor_pdb'] = 'Industri Pengolahan'
    df.loc[mask, 'subsektor_pdb'] = 'Mesin dan Perlengkapan'
    
    print("\nUpdated values:")
    print(df.loc[row_idx])
    
    # Save back
    df.to_excel(MAP_XLSX, index=False)
    print(f"\nSaved updated Excel file to {MAP_XLSX}")
else:
    print("Error: Subindustry 'Mesin Konstruksi & Kendaraan Berat' not found in mapping Excel!")
