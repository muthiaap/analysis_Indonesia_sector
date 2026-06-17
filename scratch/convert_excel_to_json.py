import pandas as pd
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
EXCEL_PATH = Path('/Users/67620/scrap_sector/gmaps_category_mapped.xlsx')
OUT_JSON = ROOT / 'dashboard/public/gmaps_category_mapping.json'

def main():
    if not EXCEL_PATH.exists():
        print(f"Error: {EXCEL_PATH} not found.")
        return
        
    df = pd.read_excel(EXCEL_PATH)
    print("Excel columns:", df.columns.tolist())
    print("Shape:", df.shape)
    
    # Standardize column names to lowercase/stripped
    df.columns = [c.strip().lower() for c in df.columns]
    
    # We expect 'category_gmaps' (or 'category') and 'sektor_pdb' (or 'sector')
    cat_col = 'category_gmaps' if 'category_gmaps' in df.columns else df.columns[0]
    pdb_col = 'sektor_pdb' if 'sektor_pdb' in df.columns else df.columns[1]
    
    print(f"Mapping from '{cat_col}' to '{pdb_col}'")
    
    # Create the mapping dictionary: lowercase category -> PDB sector
    mapping = {}
    for _, row in df.iterrows():
        cat = str(row[cat_col]).strip().lower()
        pdb = str(row[pdb_col]).strip() if pd.notna(row[pdb_col]) else None
        if cat and pdb:
            mapping[cat] = pdb
            
    print(f"Total mapped categories: {len(mapping)}")
    
    with open(OUT_JSON, 'w', encoding='utf-8') as f:
        json.dump(mapping, f, ensure_ascii=False, indent=2)
    print(f"Saved JSON mapping to {OUT_JSON}")

if __name__ == '__main__':
    main()
