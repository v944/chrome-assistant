function getStructuredData() {
  const body = document.body;
  if (!body) return { 
    text: "", 
    title: "", 
    url: "",
    headings: [],
    links: [],
    images: [],
    meta: {}
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
    if (href && text) links.push({ href, text });
  });

  const images = [];
  body.querySelectorAll('img').forEach(el => {
    const src = el.getAttribute('src') || el.getAttribute('data-src');
    const alt = el.getAttribute('alt') || "";
    if (src) images.push({ src, alt });
  });

  const meta = {};
  document.querySelectorAll('meta').forEach(el => {
    const name = el.getAttribute('name') || el.getAttribute('property');
    const content = el.getAttribute('content');
    if (name && content) meta[name] = content;
  });

  let mainText = "";
  const article = body.querySelector('article') || body.querySelector('main') || body.querySelector('.content') || body.querySelector('.post');
  if (article) {
    mainText = getText(article).slice(0, 8000);
  } else {
    mainText = getText(body).slice(0, 5000);
  }

  return {
    text: mainText,
    title: document.title || "",
    url: window.location.href || "",
    headings: headings.slice(0, 20),
    links: links.slice(0, 50),
    images: images.slice(0, 20),
    meta: meta
  };
}

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  console.log("Background received:", request);
  if (request.action === "getPageContent") {
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
      if (tabs[0]?.id) {
        chrome.scripting.executeScript({
          target: { tabId: tabs[0].id },
          func: getStructuredData
        }, function(results) {
          console.log("Scripting results:", results);
          if (results && results[0] && results[0].result) {
            sendResponse(results[0].result);
          } else {
            sendResponse({ text: "", title: "", url: "", headings: [], links: [], images: [], meta: {} });
          }
        });
      } else {
        sendResponse({ text: "", title: "", url: "", headings: [], links: [], images: [], meta: {} });
      }
    });
    return true;
  }
});

chrome.action.onClicked.addListener(function(tab) {
  chrome.sidePanel.open({ tabId: tab.id })
});