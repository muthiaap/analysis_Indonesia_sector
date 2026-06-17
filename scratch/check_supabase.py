import urllib.request
import json
import ssl

url = 'https://gwen-supa-rinjani.digi46.id/rest/v1/'
anon_key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzYyNDQ4NDAwLCJleHAiOjE5MjAyMTQ4MDB9.2rAwm_i0PqGR-ohmyI7mNM1xrNLRf7R1m1EbvnSetAY'

headers = {
    'apikey': anon_key,
    'Authorization': f'Bearer {anon_key}',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
}

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

def get_table_info(table_name):
    # Try getting the exact count first
    req = urllib.request.Request(
        f"{url}{table_name}?select=poi_id&limit=1",
        headers={**headers, 'Prefer': 'count=exact'}
    )
    try:
        with urllib.request.urlopen(req, context=ctx) as response:
            content_range = response.getheader('Content-Range')
            print(f"Table {table_name} exists! Content-Range: {content_range}")
            
            # Now let's fetch a sample of 2 records
            req_data = urllib.request.Request(
                f"{url}{table_name}?select=*&limit=2",
                headers=headers
            )
            with urllib.request.urlopen(req_data, context=ctx) as data_response:
                data = json.loads(data_response.read().decode('utf-8'))
                print(f"Sample from {table_name}:")
                print(json.dumps(data, indent=2))
    except Exception as e:
        print(f"Table {table_name} failed: {e}")

possible_tables = ['poi_bank_comparison', 'pois', 'poi_data', 'h3_count']
for t in possible_tables:
    get_table_info(t)
