import asyncio
import httpx
import os

async def list_models():
    url = "https://integrate.api.nvidia.com/v1/models"
    api_key = os.getenv("AI_API_KEY")
    if not api_key:
        print("AI_API_KEY not set in environment.")
        return
    headers = {
        "Authorization": f"Bearer {api_key}"
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
