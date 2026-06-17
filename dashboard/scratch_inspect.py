import json

with open('public/data.json', 'r') as f:
    data = json.load(f)
    print("sectorProfitByYear keys:", list(data.get('sectorProfitByYear', {}).keys())[:3])
    sample_key = list(data.get('sectorProfitByYear', {}).keys())[0]
    print(f"sectorProfitByYear['{sample_key}'] structure:", data['sectorProfitByYear'][sample_key])
