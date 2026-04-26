import os
import logging
import time
from typing import Optional

logging.basicConfig(level=logging.DEBUG)

# Search cache: {query: (timestamp, results)}
SEARCH_CACHE = {}
CACHE_TTL = 300  # 5 minutes

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
    logging.info(f"session_history: {len(session_history) if session_history else 0} messages")
    
    # Check for repeat/history commands
    message_lower = message.lower()
    if "повтори" in message_lower or "ещё раз" in message_lower or "снова" in message_lower:
        if session_history and len(session_history) > 0:
            last_user_msg = None
            for msg in reversed(session_history):
                if msg.get("role") == "user":
                    last_user_msg = msg.get("content", "")
                    break
            if last_user_msg:
                message = last_user_msg
                message_lower = message.lower()
    
    api_key = os.getenv("OPENROUTER_API_KEY")
    if not api_key:
        logging.warning("No OPENROUTER_API_KEY found!")
        return {"response": "API key not configured", "current_status": "error"}
    
    # Check if user wants to open a URL
    message_lower = message.lower()
    needs_open = any(word in message_lower for word in [
        "открой", "open", "перейди", "go to", "открыть"
    ])
    
    # Check if we need to search - more triggers
    search_triggers = [
        "поиск", "search", "найди в интернете", "google", "найди",
        "альтернатив", "related", "other similar",
        "more info", "more about", "similar to", "web search",
        "загугли", "в интернете", "в сети",
        "повтори", "снова", "ещё раз"
    ]
    needs_search = any(word in message_lower for word in search_triggers)
    
    # First call - determine if we need to search
    try:
        client = OpenAI(
            base_url="https://openrouter.ai/api/v1",
            api_key=api_key
        )
        
        # Build context
        user_msg = ""
        
        if page_details and (page_content or page_details.get('links')):
            user_msg = f"Page: {page_details.get('title', 'Unknown')}\nURL: {page_details.get('url', '')}\n"
            
            links = page_details.get('links', [])
            if links:
                user_msg += "\nAvailable URLs on this page:\n"
                for l in links[:50]:
                    href = l.get('href')
                    if href and href != '#' and href.startswith('http'):
                        user_msg += f"{href}\n"
        
        if page_content:
            user_msg += f"\nPage content:\n{page_content[:4000]}\n"
        
        user_msg += f"\n\nUser question: {message}\n\n"
        user_msg += 'CRITICAL: You must ONLY use URLs that appear in "Available URLs on this page:" section.\n'
        user_msg += 'If a URL is not in the list, say "Я не могу найти такую ссылку."\n'
        user_msg += 'If user asks to search - respond: "SEARCH_NEEDED: <query>"\n'
        user_msg += 'If user asks to open URL - respond: "OPEN_URL: <url from list>"\n'
        user_msg += 'Otherwise answer using page content only.'
        
        response = client.chat.completions.create(
            model="meta-llama/llama-3.1-8b-instruct",
            messages=[
                {"role": "system", "content": "You are a helpful browsing assistant. Answer in Russian. Use page content to answer. Check if user wants to search the web."}
            ] + ([{"role": "user", "content": user_msg}] if user_msg else [{"role": "user", "content": message}]),
            max_tokens=100,
            temperature=0.3
        )
        
        llm_response = response.choices[0].message.content
        logging.info(f"=== FIRST RESPONSE ===")
        logging.info(f"Response: {llm_response}")
        
        # Check if search is needed - separate from page content
        if needs_search:
            search_query = message
            category = None
            
            # Extract actual query - remove search trigger words
            for word in ["загугли", "поиск", "search", "google", "найди в интернете", "в интернете", "в сети"]:
                search_query = search_query.replace(word, "").strip()
            
            # Extract category
            if any(w in message_lower for w in ["картинк", "фото", "image", " foto"]):
                category = "image"
            elif any(w in message_lower for w in ["видео", "youtube", "видеок", "video"]):
                category = "video"
            elif any(w in message_lower for w in ["новост", "новости", "news"]):
                category = "news"
            
            # Check if user wants alternatives - use separate search for alternatives
            is_alternatives = any(w in message_lower for w in ["альтернатив", "другие", "ещё", "alternative", "аналог", "конкурент"])
            if is_alternatives:
                search_query = f"best alternatives to {search_query}"
            
            if not search_query or len(search_query) < 3:
                if page_details and page_details.get('title'):
                    search_query = page_details.get('title', '')
            
            logging.info(f"=== WEB SEARCH (no page context): {search_query} ===")
            logging.info(f"=== CATEGORY: {category} ===")
            
            # Check cache first
            cache_key = search_query.lower()
            if cache_key in SEARCH_CACHE:
                cached_time, cached_results = SEARCH_CACHE[cache_key]
                if time.time() - cached_time < CACHE_TTL:
                    search_results = cached_results
                    logging.info(f"=== USING CACHED RESULTS ===")
                else:
                    del SEARCH_CACHE[cache_key]
            
# Perform EXA search if not cached
            search_results = None
            try:
                from exa_py import Exa
                exa_api_key = os.getenv("EXA_API_KEY")
                if exa_api_key:
                    exa = Exa(api_key=exa_api_key)
                    search_results = exa.search_and_contents(search_query, text=True, num_results=10)
                    SEARCH_CACHE[cache_key] = (time.time(), search_results)
                
                search_context = f"\n\n=== WEB SEARCH RESULTS for: {search_query} ===\n"
                for r in search_results.results:
                    search_context += f"\n- {r.title}\n  {r.url}\n"
                    if r.text:
                        search_context += f"  {r.text[:300]}...\n"
                
                user_msg_final = f"Web search results:\n{search_context}\n\nQuestion: {message}\n\n"
                user_msg_final += "Напиши ответ с описанием.\n"
                user_msg_final += "Добавь в конце: 'Нажми на любую ссылку ниже, чтобы открыть.'\n"
                
                response2 = client.chat.completions.create(
                    model="meta-llama/llama-3.1-8b-instruct",
                    messages=[
                        {"role": "system", "content": "Отвечай на русском языке. Пиши простые URL без [текст](url)."}
                    ] + ([{"role": "user", "content": user_msg_final}]),
                    max_tokens=400,
                    temperature=0.7
                )
                
                final_result = response2.choices[0].message.content
                logging.info(f"=== FINAL RESPONSE WITH SEARCH ===")
                return {
                    "response": final_result,
                    "current_status": "completed",
                    "category": category,
                    "search_results": [
                        {"title": r.title, "url": r.url} for r in search_results.results
                    ]
                }
            except Exception as search_err:
                logging.error(f"Search error: {search_err}")
                return {"response": "Ошибка поиска. " + str(search_err), "current_status": "completed"}
        
        # Check if LLM detected search need
        elif llm_response and "SEARCH_NEEDED:" in llm_response:
            search_query = llm_response.split("SEARCH_NEEDED:")[-1].strip()
            logging.info(f"=== NEEDS SEARCH: {search_query} ===")
            
            # Perform EXA search
            try:
                from exa_py import Exa
                exa_api_key = os.getenv("EXA_API_KEY")
                if exa_api_key:
                    exa = Exa(api_key=exa_api_key)
                    search_results = exa.search_and_contents(
                        search_query,
                        num_results=8,
                        text=True
                    )
                    
                    search_context = f"\n\n=== WEB SEARCH RESULTS for: {search_query} ===\n"
                    for r in search_results.results:
                        search_context += f"\n- {r.title}\n  {r.url}\n"
                        if r.text:
                            search_context += f"  {r.text[:300]}...\n"
                    
                    # Second call with search results
                    user_msg_final = f"Page content:\n{page_content[:3000]}\n{search_context}\n\nQuestion: {message}\n\n"
                    user_msg_final += "CRITICAL: Copy URLs EXACTLY as shown. Never add '-reviews' or modify URLs.\n"
                    
                    response2 = client.chat.completions.create(
                        model="meta-llama/llama-3.1-8b-instruct",
                        messages=[
                            {"role": "system", "content": "Ты помощник для браузера. Отвечай на русском. Пиши ПРОСТЫЕ URL без форматирования markdown."}
                        ] + ([{"role": "user", "content": user_msg_final}]),
                        max_tokens=400,
                        temperature=0.7
                    )
                    
                    final_result = response2.choices[0].message.content
                    logging.info(f"=== FINAL RESPONSE WITH SEARCH ===")
                    return {
                        "response": final_result,
                        "current_status": "completed",
                        "search_results": [
                            {"title": r.title, "url": r.url} for r in search_results.results
                        ]
                    }
            except Exception as search_err:
                logging.error(f"Search error: {search_err}")
                return {"response": "Ошибка поиска. " + str(search_err), "current_status": "completed"}
        
        # Check if need to open URL
        if llm_response and "OPEN_URL:" in llm_response:
            url_to_open = llm_response.split("OPEN_URL:")[-1].strip().split("\n")[0].strip()
            url_to_open = url_to_open.strip('<>"\'')
            logging.info(f"=== NEEDS TO OPEN: {url_to_open} ===")
            return {
                "response": f"Открываю: {url_to_open}",
                "current_status": "completed",
                "open_url": url_to_open
            }
        
        # No search needed, return normal response
        return {"response": llm_response, "current_status": "completed"}
        
    except Exception as e:
        logging.error(f"=== API ERROR ===")
        logging.error(f"Error: {e}")
        result = f"Error: {str(e)}"
    
    return {"response": result, "current_status": "completed"}