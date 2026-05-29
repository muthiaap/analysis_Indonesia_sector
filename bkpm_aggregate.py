#!/usr/bin/env python3
"""
Agregasi laba IDX (all_lk.csv) ke 10 sektor BKPM via bkpm_subindustri_primary.csv.
Output: CSV + JSON untuk join dengan bkpm-data.xlsx.
"""
from __future__ import annotations

import json
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parent
ALL_LK = ROOT / "all_lk.csv"
PRIMARY_MAP = ROOT / "bkpm_subindustri_primary.csv"
BKPM_XLSX = ROOT / "dashboard/public/bkpm-data.xlsx"
OUT_CSV_YEAR = ROOT / "bkpm_netincome_by_year.csv"
OUT_CSV_JOIN = ROOT / "bkpm_province_sector_join.csv"
OUT_JSON = ROOT / "dashboard/public/bkpm_netincome.json"

BKPM_SECTORS = [
    "ENERGI",
    "KEUANGAN",
    "KONSTRUKSI",
    "PARIWISATA",
    "PENGANGKUTAN",
    "PERDAGANGAN",
    "PERIKANAN",
    "PERINDUSTRIAN",
    "PERTAMBANGAN",
    "PERTANIAN",
]

NO_BKPM_SUBINDUSTRI = ["Jasa Pendidikan", "Penyedia Jasa Kesehatan"]


def parse_value(val):
    if pd.isna(val) or val == "-" or val == "":
        return None
    s = str(val).strip().replace(",", "")
    negative = s.startswith("(") and s.endswith(")")
    if negative:
        s = s[1:-1]
    is_percent = "%" in s
    s = s.replace("%", "")
    multiplier = 1
    if s.endswith("T"):
        multiplier = 1e12
        s = s[:-1]
    elif s.endswith("B"):
        multiplier = 1e9
        s = s[:-1]
    elif s.endswith("M"):
        multiplier = 1e6
        s = s[:-1]
    try:
        num = float(s) * multiplier
        if negative:
            num = -num
        if is_percent:
            num /= 100.0
        return num
    except ValueError:
        return None


def load_annual_long() -> pd.DataFrame:
    df = pd.read_csv(ALL_LK, dtype=str)
    year_cols = [c for c in df.columns if c.isdigit()]
    for col in year_cols:
        df[col] = df[col].apply(parse_value)

    annual = df[df["Period"] == "Annualised"].copy()
    long = annual.melt(
        id_vars=["Ticker", "Sektor", "Subsektor", "Industri", "Subindustri", "Period"],
        value_vars=year_cols,
        var_name="Year",
        value_name="NetIncome",
    )
    long["Year"] = long["Year"].astype(int)
    return long[long["NetIncome"].notna()]


def aggregate_by_bkpm(annual_long: pd.DataFrame, primary: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame]:
    tagged = annual_long.merge(primary, on="Subindustri", how="inner")

    by_year = (
        tagged.groupby(["bkpm_sector", "Year"], as_index=False)["NetIncome"]
        .sum()
        .sort_values(["bkpm_sector", "Year"])
    )

    years = sorted(y for y in tagged["Year"].unique() if y <= 2025)
    latest = max(years) if years else None
    prev = latest - 1 if latest else None

    latest_rows = []
    if latest is not None:
        pivot = by_year.pivot(index="bkpm_sector", columns="Year", values="NetIncome")
        for sector in BKPM_SECTORS:
            if sector not in pivot.index:
                continue
            curr = pivot.loc[sector, latest] if latest in pivot.columns else None
            previous = pivot.loc[sector, prev] if prev in pivot.columns else None
            if pd.notna(curr):
                gr = None
                imp = None
                if pd.notna(previous) and previous != 0:
                    gr = (curr - previous) / abs(previous)
                    imp = curr - previous
                latest_rows.append(
                    {
                        "bkpm_sector": sector,
                        "Year": int(latest),
                        "NetIncome": float(curr),
                        "PrevNetIncome": float(previous) if pd.notna(previous) else None,
                        "GrowthRate": float(gr) if gr is not None else None,
                        "Improvement": float(imp) if imp is not None else None,
                    }
                )

    latest_df = pd.DataFrame(latest_rows)
    return by_year, latest_df


def companies_by_bkpm(annual_long: pd.DataFrame, primary: pd.DataFrame, latest_year: int, prev_year: int) -> dict:
    tagged = annual_long.merge(primary, on="Subindustri", how="inner")
    out = {}
    for sector in BKPM_SECTORS:
        sub = tagged[tagged["bkpm_sector"] == sector]
        curr = sub[sub["Year"] == latest_year].groupby("Ticker", as_index=False)["NetIncome"].sum()
        prev = (
            sub[sub["Year"] == prev_year]
            .groupby("Ticker")["NetIncome"]
            .sum()
            .to_dict()
        )
        rows = []
        for _, row in curr.sort_values("NetIncome", ascending=False).iterrows():
            ticker = row["Ticker"]
            c = row["NetIncome"]
            p = prev.get(ticker)
            rows.append(
                {
                    "Ticker": ticker,
                    "NetIncome": float(c),
                    "PrevNetIncome": float(p) if p is not None and pd.notna(p) else None,
                    "GrowthRate": float((c - p) / abs(p)) if p and p != 0 else None,
                }
            )
        out[sector] = rows
    return out


def build_province_join(by_year: pd.DataFrame, bkpm: pd.DataFrame, latest_year: int) -> pd.DataFrame:
    """Explode provinsi × sektor BKPM, lampirkan laba IDX nasional per sektor (tahun terbaru)."""
    latest_profit = by_year[by_year["Year"] == latest_year].set_index("bkpm_sector")["NetIncome"]

    rows = []
    for _, prov in bkpm.iterrows():
        province = prov.get("province", prov.get("Province"))
        for raw in str(prov["sectors"]).split(","):
            sector = raw.strip().upper()
            if not sector:
                continue
            rows.append(
                {
                    "province": province,
                    "bkpm_sector": sector,
                    "idx_netincome_latest": latest_profit.get(sector),
                    "idx_netincome_year": latest_year,
                    "Peluang": prov.get("Peluang"),
                    "PDRB_2024": prov.get("PDRB 2024"),
                    "Realisasi_Investasi": prov.get("Realisasi Investasi"),
                    "Kawasan_Industri": prov.get("Kawasan Industri"),
                }
            )
    return pd.DataFrame(rows)


def main():
    print("Loading all_lk.csv …")
    annual_long = load_annual_long()
    primary = pd.read_csv(PRIMARY_MAP)

    print("Aggregating by BKPM sector …")
    by_year, latest_df = aggregate_by_bkpm(annual_long, primary)
    by_year.to_csv(OUT_CSV_YEAR, index=False)
    print(f"  → {OUT_CSV_YEAR}")

    years = sorted(int(y) for y in by_year["Year"].unique() if y <= 2025)
    latest_year = max(years)
    prev_year = latest_year - 1

    profit_by_year = [
        {"bkpm_sector": r.bkpm_sector, "Year": int(r.Year), "NetIncome": float(r.NetIncome)}
        for r in by_year[by_year["Year"] <= 2025].itertuples()
    ]

    companies = companies_by_bkpm(annual_long, primary, latest_year, prev_year)

    mapped_subs = set(primary["Subindustri"])
    all_subs = set(annual_long["Subindustri"].dropna().unique())
    unmapped = sorted(all_subs - mapped_subs - set(NO_BKPM_SUBINDUSTRI))

    payload = {
        "bkpmSectors": BKPM_SECTORS,
        "years": years,
        "latestYear": latest_year,
        "profitByYear": profit_by_year,
        "profitLatest": latest_df.to_dict(orient="records"),
        "companiesByBkpmSector": companies,
        "mappedSubindustriCount": len(mapped_subs),
        "excludedSubindustri": NO_BKPM_SUBINDUSTRI,
        "unmappedSubindustri": unmapped,
        "note": "Laba IDX agregat nasional per sektor BKPM. Join provinsi via bkpm_sector.",
    }

    OUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    with open(OUT_JSON, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False)
    print(f"  → {OUT_JSON}")

    if BKPM_XLSX.exists():
        bkpm = pd.read_excel(BKPM_XLSX)
        join_df = build_province_join(by_year, bkpm, latest_year)
        join_df.to_csv(OUT_CSV_JOIN, index=False)
        print(f"  → {OUT_CSV_JOIN} ({len(join_df)} rows)")

    print("\nRingkasan laba terbaru per sektor BKPM:")
    for r in latest_df.itertuples():
        gr = f"{r.GrowthRate * 100:.1f}%" if r.GrowthRate is not None else "n/a"
        print(f"  {r.bkpm_sector:16} {r.NetIncome / 1e12:>8.2f} T  YoY {gr}")


if __name__ == "__main__":
    main()
