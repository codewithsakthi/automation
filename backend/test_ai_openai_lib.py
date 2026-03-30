from openai import OpenAI
import os

api_key = os.getenv("AI_API_KEY")
if not api_key:
    raise SystemExit("Set AI_API_KEY in your environment before running this test.")

client = OpenAI(
  base_url = "https://integrate.api.nvidia.com/v1",
  api_key = api_key
)

try:
    print("--- Testing deepseek-ai/deepseek-v3 ---")
    completion = client.chat.completions.create(
      model="deepseek-ai/deepseek-v3",
      messages=[{"role":"user","content":"hi"}],
      max_tokens=10,
      extra_body={"chat_template_kwargs": {"thinking":True}}
    )
    print(f"Success! Content: {completion.choices[0].message.content}")
except Exception as e:
    print(f"Error: {e}")

try:
    print("\n--- Testing deepseek-ai/deepseek-v3.2 ---")
    completion = client.chat.completions.create(
      model="deepseek-ai/deepseek-v3.2",
      messages=[{"role":"user","content":"hi"}],
      max_tokens=10,
      extra_body={"chat_template_kwargs": {"thinking":True}}
    )
    print(f"Success! Content: {completion.choices[0].message.content}")
except Exception as e:
    print(f"Error: {e}")
