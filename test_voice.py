import requests
import json

resp = requests.post(
    "http://localhost:8000/chat/test",
    json={"message": "Что на странице?"}
)
print(f"Status: {resp.status_code}")
print(f"Response: {resp.text}")