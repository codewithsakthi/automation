import asyncio
import httpx
import json

async def test():
    url = "https://integrate.api.nvidia.com/v1/chat/completions"
    headers = {
        "Authorization": "Bearer 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",
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

    print("--- TESTING DEEPSEEK-V3 STREAMING (HTTPX) ---")
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            async with client.stream("POST", url, headers=headers, json=payload) as resp:
                resp.raise_for_status()
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
                            print(f"[THINKING]: {reasoning}", end="", flush=True)
                        content = delta.get("content")
                        if content:
                            print(content, end="", flush=True)
                    except:
                        continue
    except Exception as e:
        print(f"\nError: {e}")
        
    print("\n--- TEST COMPLETE ---")

if __name__ == "__main__":
    asyncio.run(test())
