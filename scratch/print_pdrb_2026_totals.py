import openpyxl
from pathlib import Path

xlsx_path = Path("/Users/67620/scrap_sector/dashboard-lapkeu/PDRB_2026.xlsx")
wb = openpyxl.load_workbook(xlsx_path, read_only=True)
sheet = wb.active
for r_idx, r in enumerate(sheet.iter_rows(values_only=True)):
    if r[0] is not None:
        print(f"{r[0]}: Total PDRB={r[-1]}")
