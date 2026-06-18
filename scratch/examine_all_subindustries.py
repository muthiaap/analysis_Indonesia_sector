import pandas as pd
from pathlib import Path

ROOT = Path("/Users/67620/scrap_sector/dashboard-lapkeu")
DETAIL_CSV = Path("/Users/67620/scrap_sector/scrap_idx/detail_perusahaan.csv")
MAP_XLSX = ROOT / "mapping_subindustri_sektor_subsektor.xlsx"
REPORT_FILE = ROOT / "scratch/subindustries_report.txt"

df_comp = pd.read_csv(DETAIL_CSV)
df_map = pd.read_excel(MAP_XLSX)
df_map.columns = [c.strip() for c in df_map.columns]

# Check unique subindustries and count of companies in each
sub_counts = df_comp['Subindustri'].value_counts(dropna=False)

# Merge to see current mapping
merged = pd.DataFrame({'Subindustri': sub_counts.index, 'Count': sub_counts.values})
merged = merged.merge(df_map, left_on='Subindustri', right_on='Subindustri_idx', how='left')

with open(REPORT_FILE, "w", encoding="utf-8") as f:
    f.write("All Subindustries in Companies with Mapping Status:\n")
    f.write(f"{'Subindustri':<50} | {'Count':<5} | {'Sektor IDX':<25} | {'sektor_pdb':<35} | {'subsektor_pdb'}\n")
    f.write("-" * 150 + "\n")
    for _, r in merged.iterrows():
        # Find IDX Sektor of this subindustry from companies
        sub = r['Subindustri']
        idx_sektor = ""
        if pd.notna(sub):
            subset = df_comp[df_comp['Subindustri'] == sub]
            if len(subset) > 0:
                idx_sektor = str(subset.iloc[0]['Sektor'])
        
        f.write(f"{str(sub):<50} | {r['Count']:<5} | {idx_sektor:<25} | {str(r['sektor_pdb']):<35} | {str(r['subsektor_pdb'])}\n")
print(f"Report written to {REPORT_FILE}")
