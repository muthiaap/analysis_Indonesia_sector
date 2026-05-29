import openpyxl
from pathlib import Path

xlsx_path = Path("/Users/67620/scrap_sector/dashboard-lapkeu/pdrb-data.xlsx")
wb = openpyxl.load_workbook(xlsx_path, read_only=True)
sheet = wb.active
for r_idx, r in enumerate(sheet.iter_rows(values_only=True)):
    if r[0] is not None:
        print(f"{r[0]}: 2023={r[1]}, 2024={r[2]}, 2025={r[3]}")
