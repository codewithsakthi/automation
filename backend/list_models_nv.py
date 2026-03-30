import asyncio
import httpx

async def list_models():
    url = "https://integrate.api.nvidia.com/v1/models"
    headers = {
        "Authorization": "Bearer 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"
    }
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.get(url, headers=headers)
            print(f"Status: {resp.status_code}")
            if resp.status_code == 200:
                models = resp.json()
                for m in models.get('data', []):
                    print(f" - {m.get('id')}")
            else:
                print(f"Error: {resp.text}")
        except Exception as e:
            print(f"Exception: {e}")

if __name__ == "__main__":
    asyncio.run(list_models())
