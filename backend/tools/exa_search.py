from exa_py import Exa
import os

def search_web(query: str, num_results: int = 10) -> dict:
    """
    Search the web using EXA API for alternative information.
    """
    exa_api_key = os.getenv("EXA_API_KEY")
    if not exa_api_key:
        return {"error": "EXA_API_KEY not configured", "results": []}
    
    try:
        exa = Exa(api_key=exa_api_key)
        
        results = exa.search_and_contents(
            query,
            num_results=num_results,
            text=True
        )
        
        formatted_results = []
        for result in results.results:
            formatted_results.append({
                "title": result.title,
                "url": result.url,
                "text": result.text[:500] if result.text else ""
            })
        
        return {
            "query": query,
            "results": formatted_results,
            "count": len(formatted_results)
        }
        
    except Exception as e:
        return {"error": str(e), "results": []}

if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1:
        query = " ".join(sys.argv[1:])
        result = search_web(query)
        print(result)