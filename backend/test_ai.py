import asyncio
import os
from openai import AsyncOpenAI

async def test():
    api_key = os.getenv("AI_API_KEY")
    if not api_key:
        raise SystemExit("Set AI_API_KEY in your environment before running this test.")

    client = AsyncOpenAI(
        base_url = "https://integrate.api.nvidia.com/v1",
        api_key = api_key
    )

    print("--- TESTING DEEPSEEK-V3 STREAMING ---")
    completion = await client.chat.completions.create(
        model="deepseek-ai/deepseek-v3.2",
        messages=[{"role":"user","content":"Hi, what is SPARK?"}],
        temperature=1,
        max_tokens=100,
        extra_body={"chat_template_kwargs": {"thinking":True}},
        stream=True
    )

    async for chunk in completion:
        if not chunk.choices:
            continue
        reasoning = getattr(chunk.choices[0].delta, "reasoning_content", None)
        if reasoning:
            print(f"[THINKING]: {reasoning}", end="", flush=True)
        content = chunk.choices[0].delta.content
        if content:
            print(content, end="", flush=True)
    print("\n--- TEST COMPLETE ---")

if __name__ == "__main__":
    asyncio.run(test())
