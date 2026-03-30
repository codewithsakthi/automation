import asyncio
import httpx
import json

AI_API_URL = "https://integrate.api.nvidia.com/v1"
AI_API_KEY = "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"
AI_MODEL = "deepseek-ai/deepseek-v3"

async def test_ai():
    url = f"{AI_API_URL.rstrip('/')}/chat/completions"
    headers = {
        "Authorization": f"Bearer {AI_API_KEY}",
        "Content-Type": "application/json"
    }
    
    # Try with thinking
    payload = {
        "model": AI_MODEL,
        "messages": [{"role": "user", "content": "ping"}],
        "max_tokens": 100,
        "temperature": 0.6,
        "top_p": 0.95,
        "stream": False,
        "extra_body": {"chat_template_kwargs": {"thinking": True}}
    }
    
    print(f"--- Testing with thinking=True ---")
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(url, headers=headers, json=payload)
            print(f"Status: {resp.status_code}")
            if resp.status_code != 200:
                print(f"Error Body: {resp.text}")
            else:
                print(f"Success: {json.dumps(resp.json(), indent=2)[:200]}...")
    except Exception as e:
        print(f"Exception Type: {type(e).__name__}")
        print(f"Exception Message: {str(e)}")
        # If it's a ConnectError, check DNS/Proxy
        
    # Try without thinking
    print(f"\n--- Testing with thinking=False ---")
    if "extra_body" in payload: payload.pop("extra_body")
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(url, headers=headers, json=payload)
            print(f"Status: {resp.status_code}")
            if resp.status_code != 200:
                print(f"Error Body: {resp.text}")
            else:
                print(f"Success!")
                print(f"Response: {json.dumps(resp.json(), indent=2)[:200]}...")
    except Exception as e:
        print(f"Exception Type: {type(e).__name__}")
        print(f"Exception Message: {str(e)}")

if __name__ == "__main__":
    asyncio.run(test_ai())
