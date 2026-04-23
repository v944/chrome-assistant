import os
import sys
import time

# Start the server in a separate process
if __name__ == "__main__":
    import subprocess
    import requests
    
    # Start server
    proc = subprocess.Popen(
        [sys.executable, "server.py"],
        cwd=os.path.dirname(__file__) or ".",
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT
    )
    
    # Wait for server to start
    print("Waiting for server...")
    time.sleep(8)
    
    # Test the endpoint
    try:
        url = "http://localhost:8002/chat/test"
        data = {
            "message": "Hello, what is this page about?",
            "page_content": "Test page content about AI."
        }
        
        response = requests.post(url, json=data, timeout=30)
        print(f"Status: {response.status_code}")
        print(f"Response: {response.json()}")
    except Exception as e:
        print(f"Error: {e}")
    finally:
        proc.terminate()