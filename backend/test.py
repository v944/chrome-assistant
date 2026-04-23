import requests

url = "http://localhost:8000/chat/test"
data = {"message": "What is this page about?", "page_content": "This is a test page about artificial intelligence."}

resp = requests.post(url, json=data, timeout=30)
print(resp.json())