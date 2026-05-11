import pandas as pd
import json
import os

def parse_value(val):
    if pd.isna(val) or val == '-' or val == '':
        return None
    s = str(val).strip()
    s = s.replace(',', '')
    negative = False
    if s.startswith('(') and s.endswith(')'):
        negative = True
        s = s[1:-1]
    is_percent = '%' in s
    s = s.replace('%', '')
    multiplier = 1
    if s.endswith('T'):
        multiplier = 1e12
        s = s[:-1]
    elif s.endswith('B'):
        multiplier = 1e9
        s = s[:-1]
    elif s.endswith('M'):
        multiplier = 1e6
        s = s[:-1]
    try:
        num = float(s) * multiplier
        if negative:
            num = -num
        if is_percent:
            num = num / 100.0
        return num
    except:
        return None

print("Reading CSV...")
df = pd.read_csv('/Users/bni/Documents/lk-perusahaan/all_lk.csv', dtype=str)
print(f"Shape: {df.shape}")

year_cols = [c for c in df.columns if c.isdigit()]
print(f"Year columns: {year_cols}")

for col in year_cols:
    df[col] = df[col].apply(parse_value)

# Filter Annualised net income
annual = df[df['Period'] == 'Annualised'].copy()
print(f"Annual rows: {len(annual)}, Tickers: {annual['Ticker'].nunique()}")

# Melt
annual_long = annual.melt(
    id_vars=['Ticker', 'Sektor', 'Subsektor', 'Industri', 'Subindustri', 'Period'],
    value_vars=year_cols,
    var_name='Year',
    value_name='NetIncome'
)
annual_long['Year'] = annual_long['Year'].astype(int)
annual_long = annual_long[annual_long['NetIncome'].notna()]
print(f"Annual long rows: {len(annual_long)}")

# Sector totals by year
sector_year = annual_long.groupby(['Sektor', 'Year'])['NetIncome'].sum().reset_index()
sector_pivot = sector_year.pivot(index='Sektor', columns='Year', values='NetIncome')
print("Sector pivot:")
print(sector_pivot)

# YoY improvement by sector
improvement_data = []
sectors = sector_pivot.index.tolist()
years = sorted([int(c) for c in sector_pivot.columns])
# Exclude 2026 since it's only Q1-annualized, not full year actual
years = [y for y in years if y <= 2025]
for year in years[1:]:
    prev_year = year - 1
    if prev_year not in sector_pivot.columns:
        continue
    for sector in sectors:
        curr = sector_pivot.loc[sector, year]
        prev = sector_pivot.loc[sector, prev_year]
        if pd.notna(curr) and pd.notna(prev):
            improvement_data.append({
                'Sektor': sector,
                'Year': year,
                'Improvement': curr - prev,
                'Current': curr,
                'Previous': prev,
                'GrowthRate': (curr - prev) / abs(prev) if prev != 0 else None
            })

# Total profit by sector and year (for stacked chart)
total_by_sector = []
for _, row in sector_year.iterrows():
    if int(row['Year']) <= 2025:
        total_by_sector.append({
            'Sektor': row['Sektor'],
            'Year': int(row['Year']),
            'NetIncome': row['NetIncome']
        })

# Top companies by latest year
latest_year = max(years)
company_latest = annual_long[annual_long['Year'] == latest_year].copy()
company_latest_sorted = company_latest.sort_values('NetIncome', ascending=False)
top_companies = []
for _, row in company_latest_sorted.head(20).iterrows():
    top_companies.append({
        'Ticker': row['Ticker'],
        'Sektor': row['Sektor'],
        'NetIncome': row['NetIncome']
    })

# Sector latest totals
sector_latest = annual_long[annual_long['Year'] == latest_year].groupby('Sektor')['NetIncome'].sum().reset_index()
sector_latest = sector_latest.sort_values('NetIncome', ascending=False)

# Sector growth rates (latest vs previous available)
sector_growth = []
prev_year = latest_year - 1
for sector in sectors:
    curr = sector_pivot.loc[sector, latest_year] if latest_year in sector_pivot.columns else None
    prev = sector_pivot.loc[sector, prev_year] if prev_year in sector_pivot.columns else None
    if pd.notna(curr) and pd.notna(prev) and prev != 0:
        sector_growth.append({
            'Sektor': sector,
            'GrowthRate': (curr - prev) / abs(prev),
            'Current': curr,
            'Previous': prev,
            'Improvement': curr - prev
        })

# Subindustry growth rates (latest vs previous)
subindustry_year = annual_long.groupby(['Sektor', 'Subindustri', 'Year'])['NetIncome'].sum().reset_index()
subindustry_pivot = subindustry_year.pivot(index=['Sektor', 'Subindustri'], columns='Year', values='NetIncome')
subindustry_growth = []
for (sector, subindustry), row in subindustry_pivot.iterrows():
    curr = row.get(latest_year, None)
    prev = row.get(prev_year, None)
    if pd.notna(curr) and pd.notna(prev) and prev != 0:
        subindustry_growth.append({
            'Sektor': sector,
            'Subindustri': subindustry,
            'GrowthRate': (curr - prev) / abs(prev),
            'Current': curr,
            'Previous': prev,
            'Improvement': curr - prev
        })
subindustry_growth = sorted(subindustry_growth, key=lambda x: x['GrowthRate'], reverse=True)

# Subindustry latest totals for detail table
subindustry_latest = []
for (sector, subindustry), row in subindustry_pivot.iterrows():
    curr = row.get(latest_year, None)
    prev = row.get(prev_year, None)
    if pd.notna(curr):
        subindustry_latest.append({
            'Sektor': sector,
            'Subindustri': subindustry,
            'NetIncome': curr,
            'PrevNetIncome': prev if pd.notna(prev) else None,
            'GrowthRate': (curr - prev) / abs(prev) if pd.notna(prev) and prev != 0 else None,
            'Improvement': curr - prev if pd.notna(prev) else None
        })
subindustry_latest = sorted(subindustry_latest, key=lambda x: x['NetIncome'], reverse=True)

# Companies per subindustry for drill-down
subindustries = annual_long['Subindustri'].dropna().unique()
companies_by_subindustry = {}
for subindustry in subindustries:
    sub_companies = annual_long[
        (annual_long['Subindustri'] == subindustry) & (annual_long['Year'] == latest_year)
    ].sort_values('NetIncome', ascending=False)
    prev_companies = annual_long[
        (annual_long['Subindustri'] == subindustry) & (annual_long['Year'] == prev_year)
    ][['Ticker', 'NetIncome']].set_index('Ticker')['NetIncome'].to_dict()
    companies_by_subindustry[subindustry] = []
    for _, row in sub_companies.iterrows():
        ticker = row['Ticker']
        curr = row['NetIncome']
        prev = prev_companies.get(ticker)
        companies_by_subindustry[subindustry].append({
            'Ticker': ticker,
            'NetIncome': curr,
            'PrevNetIncome': prev if pd.notna(prev) else None,
            'GrowthRate': (curr - prev) / abs(prev) if prev and prev != 0 else None,
            'Subsektor': row['Subsektor'],
            'Industri': row['Industri'],
            'Sektor': row['Sektor']
        })

# Save JSON for dashboard
# Companies per sector for drill-down (latest + prev year)
companies_by_sector = {}
for sector in sectors:
    sector_companies = annual_long[
        (annual_long['Sektor'] == sector) & (annual_long['Year'] == latest_year)
    ].sort_values('NetIncome', ascending=False)
    prev_companies = annual_long[
        (annual_long['Sektor'] == sector) & (annual_long['Year'] == prev_year)
    ][['Ticker', 'NetIncome']].set_index('Ticker')['NetIncome'].to_dict()
    companies_by_sector[sector] = []
    for _, row in sector_companies.iterrows():
        ticker = row['Ticker']
        curr = row['NetIncome']
        prev = prev_companies.get(ticker)
        companies_by_sector[sector].append({
            'Ticker': ticker,
            'NetIncome': curr,
            'PrevNetIncome': prev if pd.notna(prev) else None,
            'GrowthRate': (curr - prev) / abs(prev) if prev and prev != 0 else None,
            'Subsektor': row['Subsektor'],
            'Industri': row['Industri']
        })

output = {
    'years': years,
    'latestYear': int(latest_year),
    'sectors': sectors,
    'sectorProfitByYear': total_by_sector,
    'sectorImprovement': improvement_data,
    'topCompanies': top_companies,
    'sectorLatest': sector_latest.to_dict('records'),
    'sectorGrowth': sector_growth,
    'companiesBySector': companies_by_sector,
    'companiesBySubindustry': companies_by_subindustry,
    'subindustryGrowth': subindustry_growth,
    'subindustryLatest': subindustry_latest
}

out_path = '/Users/bni/Documents/lk-perusahaan/dashboard_data.json'
with open(out_path, 'w') as f:
    json.dump(output, f)
print(f"Saved to {out_path}")

# Also save sector-year pivot as flat records for easy charting
sector_pivot_records = []
for _, row in sector_pivot.reset_index().iterrows():
    for year in years:
        if year in row and pd.notna(row[year]):
            sector_pivot_records.append({
                'Sektor': row['Sektor'],
                'Year': int(year),
                'NetIncome': row[year]
            })

output['sectorProfitPivot'] = sector_pivot_records
with open(out_path, 'w') as f:
    json.dump(output, f)
print(f"Updated {out_path}")
