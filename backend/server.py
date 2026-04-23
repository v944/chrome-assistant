import os
import json
import asyncio
from dotenv import load_dotenv
from contextlib import asynccontextmanager

load_dotenv()

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import HTMLResponse
from pydantic import BaseModel
from typing import Optional, Dict, Any
import agent as langgraph_agent


# Session storage (in-memory)
sessions: Dict[str, Dict[str, Any]] = {}


class ChatRequest(BaseModel):
    message: str
    page_content: Optional[str] = ""
    page_details: Optional[dict] = None


class ChatResponse(BaseModel):
    response: str
    status: str


async def get_or_create_session(session_id: str) -> dict:
    """Get or create a session."""
    if session_id not in sessions:
        sessions[session_id] = {
            "history": [],
            "lock": asyncio.Lock()
        }
    return sessions[session_id]


async def broadcast_status(websocket: WebSocket, status: str):
    """Send status update to client."""
    try:
        await websocket.send_json({"type": "status", "status": status})
    except:
        pass


async def process_message(
    session_id: str,
    message: str,
    page_content: str,
    page_details: Optional[dict],
    websocket: WebSocket
):
    """Process message and stream results."""
    import copy
    
    session = await get_or_create_session(session_id)
    
    async with session["lock"]:
        await broadcast_status(websocket, "thinking")
        
        result = langgraph_agent.run_agent(
            message=message,
            page_content=page_content or "",
            page_details=page_details,
            session_history=copy.deepcopy(session["history"])
        )
        
        await broadcast_status(websocket, result["current_status"])
        
        # Save to history
        session["history"].append({"role": "user", "content": message})
        session["history"].append({"role": "assistant", "content": result["response"]})
        
        # Keep only last 10 message pairs
        if len(session["history"]) > 20:
            session["history"] = session["history"][-20:]
    
    await websocket.send_json({
        "type": "response",
        "content": result["response"]
    })


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    print("Starting Chrome Assistant API...")
    yield
    # Shutdown
    sessions.clear()
    print("Shutting down...")


app = FastAPI(lifespan=lifespan)


@app.get("/")
async def root():
    return {"message": "Chrome Assistant API"}


@app.post("/chat/{session_id}", response_model=ChatResponse)
async def chat(session_id: str, request: ChatRequest):
    """Chat endpoint (REST)."""
    result = langgraph_agent.run_agent(
        message=request.message,
        page_content=request.page_content or "",
        page_details=request.page_details
    )
    
    return ChatResponse(
        response=result.get("response", ""),
        status=result.get("current_status", "completed")
    )


@app.websocket("/ws/{session_id}")
async def websocket_chat(websocket: WebSocket, session_id: str):
    """WebSocket endpoint for streaming status updates."""
    await websocket.accept()
    
    try:
        while True:
            data = await websocket.receive_json()
            message = data.get("message", "")
            page_content = data.get("page_content", "")
            page_details = data.get("page_details")
            
            await process_message(
                session_id,
                message,
                page_content,
                page_details,
                websocket
            )
    except WebSocketDisconnect:
        pass


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", "8000"))
    uvicorn.run(app, host="0.0.0.0", port=port)