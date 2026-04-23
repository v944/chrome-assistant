// Extract visible text from page
(function() {
  function getPageContent() {
    const body = document.body;
    if (!body) return { text: "", title: "", url: "" };
    
    const text = body.innerText || body.textContent || "";
    return {
      text: text.slice(0, 5000),
      title: document.title || "",
      url: window.location.href || ""
    };
  }

  if (typeof chrome !== 'undefined' && chrome.runtime) {
    chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
      if (request.action === "getPageContent") {
        sendResponse(getPageContent());
      }
      return true;
    });
  }
})();