from openai import OpenAI
import os

client = OpenAI(
  base_url = "https://integrate.api.nvidia.com/v1",
  api_key = "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"
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
