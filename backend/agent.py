import os
import logging
from typing import Optional

logging.basicConfig(level=logging.DEBUG)

def run_agent(
    message: str,
    page_content: str = "",
    page_details: Optional[dict] = None,
    session_history: Optional[list[dict]] = None,
) -> dict:
    from openai import OpenAI
    
    logging.info(f"=== AGENT CALLED ===")
    logging.info(f"message: {message}")
    logging.info(f"page_content length: {len(page_content)}")
    logging.info(f"page_details: {page_details}")
    logging.info(f"Headings: {len(page_details.get('headings', [])) if page_details else 0}")
    logging.info(f"Links: {len(page_details.get('links', [])) if page_details else 0}")
    
    api_key = os.getenv("OPENROUTER_API_KEY")
    if not api_key:
        logging.warning("No OPENROUTER_API_KEY found!")
        return {"response": "API key not configured", "current_status": "error"}
    
    try:
        client = OpenAI(
            base_url="https://openrouter.ai/api/v1",
            api_key=api_key
        )
        
        system_prompt = """You are a helpful browsing assistant. Answer the user's question about the current webpage.
If the user asks about page content, use the provided page data (text, headings, links, images, meta).
Be specific and reference the actual page content."""
        
        user_msg = f"Page: {page_details.get('title', 'Unknown')}\nURL: {page_details.get('url', '')}\n"
        
        if page_details:
            headings = page_details.get('headings', [])
            if headings:
                user_msg += "Headings: " + "; ".join([f"{h['level']}: {h['text']}" for h in headings[:10]]) + "\n"
            
            links = page_details.get('links', [])
            if links:
                user_msg += "Links: " + "; ".join([f"{l['text']} ({l['href']})" for l in links[:15]]) + "\n"
            
            images = page_details.get('images', [])
            if images:
                user_msg += "Images: " + "; ".join([i['alt'] or i['src'] for i in images[:10]]) + "\n"
        
        user_msg += f"\nPage text:\n{page_content[:4000]}\n\nQuestion: {message}"
        
        messages = [
            {"role": "system", "content": system_prompt}
        ]
        
        if session_history:
            for msg in session_history[-6:]:
                messages.append(msg)
        
        messages.append({"role": "user", "content": user_msg})
        
        logging.info(f"=== API CALL ===")
        logging.info(f"Model: meta-llama/llama-3.1-8b-instruct")
        logging.info(f"Messages: {messages}")
        
        response = client.chat.completions.create(
            model="meta-llama/llama-3.1-8b-instruct",
            messages=messages,
            max_tokens=250,
            temperature=0.7
        )
        
        result = response.choices[0].message.content
        logging.info(f"=== API SUCCESS ===")
        logging.info(f"Result: {result}")
        
    except Exception as e:
        logging.error(f"=== API ERROR ===")
        logging.error(f"Error: {e}")
        result = f"Error: {str(e)}"
    
    return {"response": result, "current_status": "completed"}