import requests
import json
import io

try:
    response = requests.get("http://127.0.0.1:8000/openapi.json")
    if response.status_code == 200:
        with open("v3_openapi.json", "w", encoding="utf-8") as f:
            json.dump(response.json(), f, indent=2)
        print("Successfully saved openapi.json")
    else:
        print(f"Failed to fetch openapi.json: {response.status_code}")
except Exception as e:
    print(f"Error: {e}")
