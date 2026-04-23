import requests
import json

resp = requests.post(
    "http://localhost:8000/chat/test-session",
    json={"message": "What is 2 plus 2?"}
)
print(f"Status: {resp.status_code}")
print(f"Response: {resp.text}")