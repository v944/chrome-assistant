function getStructuredData() {
  const body = document.body;
  if (!body) return { 
    text: "", 
    title: "", 
    url: "",
    headings: [],
    links: [],
    meta: {},
    products: []
  };

  const getText = (el) => el.innerText || el.textContent || "";
  
  const headings = [];
  body.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach(el => {
    const text = getText(el).trim();
    if (text) headings.push({ level: el.tagName, text });
  });

  const links = [];
  body.querySelectorAll('a[href]').forEach(el => {
    const href = el.getAttribute('href');
    const text = getText(el).trim();
    if (href && text && !href.match(/\.(png|jpg|jpeg|gif|svg|webp|ico|bmp|tiff)(\?|$|#)/i)) {
      if (!href.startsWith('#') && !href.startsWith('javascript:')) {
        links.push({ href, text });
      }
    }
  });

  const meta = {};
  document.querySelectorAll('meta').forEach(el => {
    const name = el.getAttribute('name') || el.getAttribute('property');
    const content = el.getAttribute('content');
    if (name && content) meta[name] = content;
  });

  let mainText = "";
  
  const selectors = [
    'article', 'main', '.content', '.post', '[data-test-id="project-grid"]',
    '[class*="project"]', '[class*="card"]', '[class*="item"]', '.cover',
    '[role="main"]', '.profile', '.portfolio'
  ];
  
  let foundContent = null;
  for (const sel of selectors) {
    const el = body.querySelector(sel);
    if (el) {
      const text = getText(el);
      if (text.length > 200) {
        foundContent = text;
        break;
      }
    }
  }
  
  if (foundContent) {
    mainText = foundContent.slice(0, 10000);
  } else {
    mainText = getText(body).slice(0, 8000);
  }

  const imagePatterns = [
    /image\.png/gi, /image\.jpg/gi, /image\.jpeg/gi, /image\.gif/gi, /image\.svg/gi,
    /data:image[^\s]*/gi, /\.png[^\s]*/gi, /\.jpg[^\s]*/gi, /\.jpeg[^\s]*/gi,
    /\.gif[^\s]*/gi, /\.svg[^\s]*/gi, /\.webp[^\s]*/gi,
    /https?:\/\/[^\s]*\.(png|jpg|jpeg|gif|svg|webp|ico)[^\s]*/gi
  ];
  
  for (const pattern of imagePatterns) {
    mainText = mainText.replace(pattern, '');
  }

  let products = [];
  
  const scripts = document.querySelectorAll('script[type="application/ld+json"]');
  scripts.forEach(script => {
    try {
      const data = JSON.parse(script.textContent);
      if (data && data['@type'] === 'ItemList' && data.itemListElement) {
        data.itemListElement.forEach(item => {
          if (item.item && item.item.offers && item.item.offers.url) {
            let description = item.item.description || "";
            description = description.replace(/image\.png/gi, '');
            description = description.replace(/image\.jpg/gi, '');
            description = description.replace(/image\.jpeg/gi, '');
            description = description.replace(/image\.gif/gi, '');
            description = description.replace(/image\.svg/gi, '');
            description = description.replace(/https?:\/\/[^\s]*(?:png|jpg|jpeg|gif|svg|webp)[^\s]*/gi, '');
            description = description.replace(/data:image[^\s]*/gi, '');
            
            products.push({
              name: item.item.name,
              url: item.item.offers.url,
              price: item.item.offers.price,
              description: description
            });
          }
        });
      }
    } catch (e) {}
  });

  return {
    text: mainText,
    title: document.title || "",
    url: window.location.href || "",
    headings: headings.slice(0, 20),
    links: links.slice(0, 100),
    meta: meta,
    products: products.slice(0, 30)
  };
}

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  console.log("Background received message:", request.action);
  
  if (request.action === "openTabs") {
    if (request.urls && Array.isArray(request.urls)) {
      request.urls.forEach(function(url) {
        chrome.tabs.create({ url: url, active: false });
      });
    }
    sendResponse({ success: true });
    return true;
  }
  
  if (request.action === "startListening") {
    startSpeechRecognition(sendResponse);
    return true;
  }
  if (request.action === "stopListening") {
    stopSpeechRecognition();
    sendResponse({ success: true });
    return true;
  }
  if (request.action === "getPageContent") {
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
      if (tabs[0]?.id) {
        const tabId = tabs[0].id;
        
        function tryGetContent(attempts) {
          if (attempts <= 0) {
            sendResponse({ text: "", title: "", url: "", headings: [], links: [], meta: {}, products: [] });
            return;
          }
          
          chrome.scripting.executeScript({
            target: { tabId: tabId },
            func: function() {
              return {
                text: (document.body ? (document.body.innerText || document.body.textContent || "").slice(0, 10000) : ""),
                title: document.title || "",
                url: window.location.href || "",
                isLoaded: document.querySelectorAll('[data-test-id="project-grid"] a').length > 0 || 
                          document.querySelectorAll('.project-grid a').length > 0 ||
                          document.querySelectorAll('[class*="project"]').length > 3
              };
            }
          }).then(function(results) {
            if (results && results[0] && results[0].result) {
              const data = results[0].result;
              if (data.isLoaded || attempts <= 1) {
                chrome.scripting.executeScript({
                  target: { tabId: tabId },
                  func: getStructuredData
                }).then(function(finalResults) {
                  if (finalResults && finalResults[0] && finalResults[0].result) {
                    sendResponse(finalResults[0].result);
                  } else {
                    sendResponse({ text: data.text, title: data.title, url: data.url, headings: [], links: [], meta: {}, products: [] });
                  }
                }).catch(function() {
                  sendResponse({ text: data.text, title: data.title, url: data.url, headings: [], links: [], meta: {}, products: [] });
                });
              } else {
                setTimeout(function() { tryGetContent(attempts - 1); }, 1000);
              }
            } else {
              sendResponse({ text: "", title: "", url: "", headings: [], links: [], meta: {}, products: [] });
            }
          }).catch(function() {
            sendResponse({ text: "", title: "", url: "", headings: [], links: [], meta: {}, products: [] });
          });
        }
        
        tryGetContent(4);
      } else {
        sendResponse({ text: "", title: "", url: "", headings: [], links: [], meta: {}, products: [] });
      }
    });
    return true;
  }
});

let currentRecognition = null;
let currentTabId = null;

function startSpeechRecognition(sendResponse) {
  console.log("startSpeechRecognition called");
  
  chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
    if (!tabs[0]?.id) {
      sendResponse({ error: "no-tab" });
      return;
    }
    
    currentTabId = tabs[0].id;
    
    chrome.scripting.executeScript({
      target: { tabId: currentTabId },
      func: function() {
        if (window.speechRecognitionActive) {
          window.speechRecognitionActive.stop();
          window.speechRecognitionActive = null;
        }
        
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        
        if (!SpeechRecognition) {
          chrome.runtime.sendMessage({ action: "speechError", error: "not-supported" });
          return;
        }
        
        window.speechRecognitionActive = new SpeechRecognition();
        window.speechRecognitionActive.continuous = true;
        window.speechRecognitionActive.interimResults = true;
        window.speechRecognitionActive.lang = "ru-RU";
        
        window.speechRecognitionActive.onstart = function() {
          chrome.runtime.sendMessage({ action: "speechStarted" });
        };
        
        window.speechRecognitionActive.onresult = function(event) {
          const transcript = Array.from(event.results)
            .map(function(result) { return result[0].transcript; })
            .join("");
          chrome.runtime.sendMessage({ action: "speechResult", transcript: transcript });
        };
        
        window.speechRecognitionActive.onerror = function(event) {
          chrome.runtime.sendMessage({ action: "speechError", error: event.error });
          window.speechRecognitionActive = null;
        };
        
        window.speechRecognitionActive.onend = function() {
          chrome.runtime.sendMessage({ action: "speechEnded" });
          window.speechRecognitionActive = null;
        };
        
        window.speechRecognitionActive.start();
      }
    }, function() {
      sendResponse({ status: "started" });
    });
  });
}

function stopSpeechRecognition() {
  if (currentTabId) {
    chrome.scripting.executeScript({
      target: { tabId: currentTabId },
      func: function() {
        if (window.speechRecognitionActive) {
          window.speechRecognitionActive.stop();
          window.speechRecognitionActive = null;
        }
      }
    });
  }
  currentTabId = null;
}

chrome.action.onClicked.addListener(function(tab) {
  chrome.sidePanel.open({ tabId: tab.id })
});