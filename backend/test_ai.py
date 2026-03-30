import asyncio
from openai import AsyncOpenAI

async def test():
    client = AsyncOpenAI(
        base_url = "https://integrate.api.nvidia.com/v1",
        api_key = "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"
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
