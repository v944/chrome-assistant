import requests
import time

time.sleep(2)

url = "http://localhost:8002/chat/test-session"
data = {
    "message": "What is this page about?",
    "page_content": "This is a test page about artificial intelligence."
}

try:
    response = requests.post(url, json=data, timeout=30)
    print(f"Status: {response.status_code}")
    print(f"Response: {response.json()}")
except Exception as e:
    print(f"Error: {e}")