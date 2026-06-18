import pandas as pd
from pathlib import Path

DETAIL_CSV = Path("/Users/67620/scrap_sector/scrap_idx/detail_perusahaan.csv")
df_comp = pd.read_csv(DETAIL_CSV)

sub_df = df_comp[df_comp['Subindustri'] == 'Peralatan Olah Raga & Barang Hobi']
print("Companies in 'Peralatan Olah Raga & Barang Hobi':")
for _, row in sub_df.iterrows():
    print(f"Ticker: {row['Kode']} | Name: {row['Nama']} | Sektor: {row['Sektor']} | Subsektor: {row['Subsektor']}")
