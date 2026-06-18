import pandas as pd
import json
import os
import openpyxl

def normalize(name):
    if not name:
        return ""
    s = str(name).lower().strip()
    for prefix in ["industri ", "jasa ", "penyediaan ", "pengadaan ", "perdagangan "]:
        if s.startswith(prefix):
            s = s[len(prefix):]
    s = s.replace(" dan ", " ").replace("&", " ")
    s = "".join(c for c in s if c.isalnum() or c.isspace())
    return " ".join(s.split())

def main():
    excel_path = '/Users/67620/scrap_sector/dashboard-lapkeu/all_data_pdb_scored.xlsx'
    mapping_path = '/Users/67620/scrap_sector/dashboard-lapkeu/mapping_subindustri_sektor_subsektor.xlsx'
    
    if not os.path.exists(excel_path):
        print(f"Error: Excel file not found at {excel_path}")
        return
        
    print(f"Reading consolidated PDB scored Excel: {excel_path}")
    df = pd.read_excel(excel_path, sheet_name='Sheet1')
    
    # Filter out empty/null rows (like row 46)
    df = df.dropna(subset=['sector', 'subsector'])
    
    # Standardize string fields
    df['sector'] = df['sector'].astype(str).str.strip().str.replace(";", ",", regex=False).str.replace(", dan ", " dan ", regex=False)
    df['subsector'] = df['subsector'].astype(str).str.strip()
    
    # Group siblings (all subsectors belonging to the same parent sector)
    siblings_map = {}
    for idx, row in df.iterrows():
        sect = row['sector']
        sub = row['subsector']
        if sect not in siblings_map:
            siblings_map[sect] = []
        if sub not in siblings_map[sect]:
            siblings_map[sect].append(sub)
            
    # Load and build IDX sub-industry mapping dictionary
    pdb_to_idx = {}
    if os.path.exists(mapping_path):
        print(f"Loading IDX mapping Excel: {mapping_path}")
        wb_mapping = openpyxl.load_workbook(mapping_path, read_only=True)
        sheet_mapping = wb_mapping['Sheet1']
        mapping_rows = []
        for row in list(sheet_mapping.iter_rows(values_only=True))[1:]:
            if row[0] is not None and row[3] is not None:
                mapping_rows.append((str(row[0]).strip(), str(row[3]).strip()))
                
        # Group IDX sub-industries by normalized PDB subsector names
        normalized_mapping = {}
        for sub_idx, sub_pdb in mapping_rows:
            norm = normalize(sub_pdb)
            if norm not in normalized_mapping:
                normalized_mapping[norm] = []
            if sub_idx not in normalized_mapping[norm]:
                normalized_mapping[norm].append(sub_idx)
                
        # Alias overrides for minor spelling mismatches
        aliases = {
            normalize("Perdagangan Besar dan Eceran (bukan mobil dan motor)"): normalize("Perdagangan Besar dan Eceran, Bukan Mobil dan Sepeda Motor"),
            normalize("Pergudangan, Pos, dan Kurir"): normalize("Pergudangan dan Jasa Penunjang Angkutan; Pos dan Kurir"),
        }
        
        # Build final pdb_to_idx dictionary
        for _, row in df.iterrows():
            sub_name = row['subsector']
            norm_scored = normalize(sub_name)
            
            matched_norm = None
            if norm_scored in normalized_mapping:
                matched_norm = norm_scored
            elif norm_scored in aliases and aliases[norm_scored] in normalized_mapping:
                matched_norm = aliases[norm_scored]
            else:
                # Fuzzy normalized substring matching
                for k in normalized_mapping.keys():
                    if norm_scored in k or k in norm_scored:
                        matched_norm = k
                        break
                        
            if matched_norm:
                pdb_to_idx[sub_name] = normalized_mapping[matched_norm]
            else:
                pdb_to_idx[sub_name] = []
        print(f"Successfully processed {len(pdb_to_idx)} mapping matches.")
    else:
        print(f"Warning: IDX Mapping Excel not found at {mapping_path}. Leaving sub-industries empty.")
        
    # Process each subsector row as an independent scored PDB item
    records = []
    for idx, row in df.iterrows():
        sect_name = row['sector']
        sub_name = row['subsector']
        
        # Calculate continuously graded regulatory score out of 10
        # insentif (30%), prioritas (30%), oss (20%), plafon (20%)
        fiskal = float(row['skor_insentif_fiskal']) if pd.notnull(row['skor_insentif_fiskal']) else 0.0
        prioritas = float(row['skor_prioritas']) if pd.notnull(row['skor_prioritas']) else 0.0
        oss = float(row['skor_oss_kemudahan']) if pd.notnull(row['skor_oss_kemudahan']) else 0.0
        plafon = float(row['skor_plafon_kredit']) if pd.notnull(row['skor_plafon_kredit']) else 0.0
        
        skor_regulasi_10 = (fiskal * 0.3) + (prioritas * 0.3) + (oss * 0.2) + (plafon * 0.2)
        
        # Sibling subsectors
        siblings = siblings_map.get(sect_name, [sub_name])
        
        # Safe string values for evaluation & news
        alasan_eval = str(row['alasan_evaluasi']).strip() if pd.notnull(row['alasan_evaluasi']) else "Tidak ada analisis evaluasi."
        berita = str(row['berita_terkait']).strip() if pd.notnull(row['berita_terkait']) else ""
        
        record = {
            "sector": sect_name,
            "subsector": sub_name,
            
            # HK (Harga Konstan) data
            "hk2025Q1": float(row['HK 2025 Q1']) if pd.notnull(row['HK 2025 Q1']) else 0.0,
            "hk2025Q2": float(row['HK 2025 Q2']) if pd.notnull(row['HK 2025 Q2']) else 0.0,
            "hk2025Q3": float(row['HK 2025 Q3']) if pd.notnull(row['HK 2025 Q3']) else 0.0,
            "hk2025Q4": float(row['HK 2025 Q4']) if pd.notnull(row['HK 2025 Q4']) else 0.0,
            "hk2025Tahunan": float(row['HK 2025 Tahunan']) if pd.notnull(row['HK 2025 Tahunan']) else 0.0,
            "hk2026Q1": float(row['HK 2026 Q1']) if pd.notnull(row['HK 2026 Q1']) else 0.0,
            
            # HB (Harga Berlaku) data
            "hb2025Q1": float(row['HB2025 Q1']) if pd.notnull(row['HB2025 Q1']) else 0.0,
            "hb2025Q2": float(row['HB2025 Q2']) if pd.notnull(row['HB2025 Q2']) else 0.0,
            "hb2025Q3": float(row['HB2025 Q3']) if pd.notnull(row['HB2025 Q3']) else 0.0,
            "hb2025Q4": float(row['HB2025 Q4']) if pd.notnull(row['HB2025 Q4']) else 0.0,
            "hb2025Tahunan": float(row['HB 2025 Tahunan']) if pd.notnull(row['HB 2025 Tahunan']) else 0.0,
            "hb2026Q1": float(row['HB 2026 Q1']) if pd.notnull(row['HB 2026 Q1']) else 0.0,
            
            # Metrics
            "bobotUkuran": (float(row['Bobot PDB Ukuran Sektor']) / 100.0) if pd.notnull(row['Bobot PDB Ukuran Sektor']) else 0.0,
            "yoyGrowth": float(row['YoY Growth Sector']) if pd.notnull(row['YoY Growth Sector']) else 0.0,
            
            # Regulatory scores (1-10)
            "insentifFiskalScore": fiskal,
            "renstraPrioritasScore": prioritas,
            "ossIzinScore": oss,
            "plafonKreditScore": plafon,
            "skorRegulasiMaks10": skor_regulasi_10,
            
            # Binary fallback
            "insentifFiskal": 1 if fiskal >= 6.0 else 0,
            "renstraPrioritas": 1 if prioritas >= 6.0 else 0,
            "ossIzin": 1 if oss >= 6.0 else 0,
            "plafonKredit": 1 if plafon >= 6.0 else 0,
            
            # Explanations
            "penjelasanInsentifFiskal": str(row['alasan_insentif_fiskal']).strip() if pd.notnull(row['alasan_insentif_fiskal']) else "-",
            "penjelasanRenstraPrioritas": str(row['alasan_prioritas']).strip() if pd.notnull(row['alasan_prioritas']) else "-",
            "penjelasanOssIzin": str(row['alasan_oss']).strip() if pd.notnull(row['alasan_oss']) else "-",
            "penjelasanPlafonKredit": str(row['alasan_plafon_kredit']).strip() if pd.notnull(row['alasan_plafon_kredit']) else "-",
            
            # Explanations & news
            "alasanEvaluasi": alasan_eval,
            "beritaTerkait": berita,
            
            # Sibling subsectors
            "subsectors": siblings,
            
            # Mapped IDX sub-industries
            "idxSubindustries": pdb_to_idx.get(sub_name, [])
        }
        records.append(record)
        
    output_dir = '/Users/67620/scrap_sector/dashboard-lapkeu/dashboard/public'
    os.makedirs(output_dir, exist_ok=True)
    output_path = os.path.join(output_dir, 'pdb_data.json')
    
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(records, f, indent=2, ensure_ascii=False)
        
    print(f"Successfully processed {len(records)} subsector records from consolidated sheet.")
    print(f"Output saved to {output_path}")

if __name__ == '__main__':
    main()
