import pandas as pd
from pathlib import Path

ROOT = Path("/Users/67620/scrap_sector/dashboard-lapkeu")
MAP_XLSX = ROOT / "mapping_subindustri_sektor_subsektor.xlsx"

# 1. Load the Excel file
df = pd.read_excel(MAP_XLSX)
print("Original Columns:", df.columns.tolist())
print(f"Original Row Count: {len(df)}")

# Check some sample rows
print("\nSample rows:")
print(df.head(5))

# We need to make sure the PDB sector spelling aligns with PDRB_2026.xlsx:
# 1. 'Perdagangan Besar dan Eceran; Reparasi Mobil dan Sepeda Motor' -> 'Perdagangan Besar dan Eceran, Reparasi Mobil dan Sepeda Motor' (semicolon to comma)
# 2. 'Pertanian, Kehutanan, dan Perikanan' -> 'Pertanian, Kehutanan dan Perikanan' (remove serial comma)

# Let's perform these updates:
df['sektor_pdb'] = df['sektor_pdb'].replace({
    'Perdagangan Besar dan Eceran; Reparasi Mobil dan Sepeda Motor': 'Perdagangan Besar dan Eceran, Reparasi Mobil dan Sepeda Motor',
    'Pertanian, Kehutanan, dan Perikanan': 'Pertanian, Kehutanan dan Perikanan'
})

# Update 'Peralatan Olah Raga & Barang Hobi' mapping
# Currently, it is nan / nan. Let's map it to 'Industri Pengolahan' and 'Alat Angkutan'
mask = df['Subindustri_idx'] == 'Peralatan Olah Raga & Barang Hobi'
if mask.any():
    df.loc[mask, 'sektor_pdb'] = 'Industri Pengolahan'
    df.loc[mask, 'subsektor_pdb'] = 'Alat Angkutan'
    print("\nUpdated 'Peralatan Olah Raga & Barang Hobi' in existing row.")
else:
    # If not present (though our script said it was in mapping but was null), we add it
    new_row = {
        'Subindustri_idx': 'Peralatan Olah Raga & Barang Hobi',
        'bkpm_sector': None,
        'sektor_pdb': 'Industri Pengolahan',
        'subsektor_pdb': 'Alat Angkutan'
    }
    df = pd.concat([df, pd.DataFrame([new_row])], ignore_index=True)
    print("\nAdded 'Peralatan Olah Raga & Barang Hobi' as a new row.")

# Add missing subindustries:
# 1. 'Penyedia Jasa Kesehatan'
# 2. 'Jasa Pendidikan'

missing_additions = [
    {
        'Subindustri_idx': 'Penyedia Jasa Kesehatan',
        'bkpm_sector': None,
        'sektor_pdb': 'Jasa Kesehatan dan Kegiatan Sosial',
        'subsektor_pdb': 'Jasa Kesehatan dan Kegiatan Sosial'
    },
    {
        'Subindustri_idx': 'Jasa Pendidikan',
        'bkpm_sector': None,
        'sektor_pdb': 'Jasa Pendidikan',
        'subsektor_pdb': 'Jasa Pendidikan'
    }
]

for item in missing_additions:
    sub_name = item['Subindustri_idx']
    if not (df['Subindustri_idx'] == sub_name).any():
        df = pd.concat([df, pd.DataFrame([item])], ignore_index=True)
        print(f"Added missing subindustry: '{sub_name}'")
    else:
        print(f"Subindustry '{sub_name}' already exists in Excel. Updating its columns.")
        mask_sub = df['Subindustri_idx'] == sub_name
        df.loc[mask_sub, 'sektor_pdb'] = item['sektor_pdb']
        df.loc[mask_sub, 'subsektor_pdb'] = item['subsektor_pdb']

# Remove duplicates if any
df = df.drop_duplicates(subset=['Subindustri_idx'], keep='last')

# Save it back to Excel
df.to_excel(MAP_XLSX, index=False)
print(f"\nSaved updated mapping file to {MAP_XLSX} with {len(df)} rows.")
