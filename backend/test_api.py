import requests

url = "https://openrouter.ai/api/v1/chat/completions"
headers = {
    "Authorization": "Bearer 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",
    "Content-Type": "application/json"
}
data = {
    "model": "meta-llama/llama-3.1-8b-instruct",
    "messages": [{"role": "user", "content": "Hi"}],
    "max_tokens": 50
}

response = requests.post(url, json=data, headers=headers)
print(response.status_code)
print(response.text[:500])