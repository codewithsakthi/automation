import asyncio
import httpx
import json
import os
import traceback

async def test():
    url = "https://integrate.api.nvidia.com/v1/chat/completions"
    api_key = os.getenv("AI_API_KEY")
    if not api_key:
        raise SystemExit("Set AI_API_KEY in your environment before running this test.")
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }
    payload = {
        "model": "deepseek-ai/deepseek-v3.2",
        "messages": [{"role": "user", "content": "Hi, what is SPARK?"}],
        "temperature": 1,
        "max_tokens": 100,
        "extra_body": {"chat_template_kwargs": {"thinking": True}},
        "stream": True
    }

    print("--- TESTING DEEPSEEK-V3 STREAMING (HTTPX DEBUG) ---")
    try:
        async with httpx.AsyncClient(timeout=60) as client:
            async with client.stream("POST", url, headers=headers, json=payload) as resp:
                print(f"Status Code: {resp.status_code}")
                if resp.status_code != 200:
                    print(f"Error Body: {await resp.aread()}")
                    return
                
                async for line in resp.aiter_lines():
                    if not line or not line.startswith("data: "):
                        continue
                    raw = line[6:].strip()
                    if raw == "[DONE]":
                        break
                    try:
                        chunk = json.loads(raw)
                        delta = chunk["choices"][0].get("delta", {})
                        reasoning = delta.get("reasoning_content")
                        if reasoning:
                            print(f"[REASONING]: {reasoning}", end="", flush=True)
                        content = delta.get("content")
                        if content:
                            print(content, end="", flush=True)
                    except Exception as e:
                        print(f"\n[Parse Error]: {e}")
                        continue
    except Exception as e:
        print(f"\n[Request Error]: {e}")
        traceback.print_exc()
        
    print("\n--- TEST COMPLETE ---")

if __name__ == "__main__":
    asyncio.run(test())
