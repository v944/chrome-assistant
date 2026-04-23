import uvicorn
import os
from dotenv import load_dotenv

load_dotenv()

if __name__ == "__main__":
    import server
    uvicorn.run(server.app, host="0.0.0.0", port=8000)