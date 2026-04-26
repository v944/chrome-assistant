import * as React from "react"
import { Send, Loader2, Bot, User, Mic, MicOff, Copy, Check, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { StatusIndicator, type StatusIndicatorProps } from "@/components/status"

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  searchResults?: Array<{title: string, url: string}>
}

interface ChatProps {
  sessionId: string
}

function MessageContent({ content }: { content: string }) {
  const parts = content.split(/(https?:\/\/[^\s\)]+)/g)
  
  return (
    <div className="whitespace-pre-wrap">
      {parts.map((part, i) => {
        if (part.match(/^https?:\/\//)) {
          return (
            <a 
              key={i} 
              href={part} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
              onClick={(e) => {
                e.stopPropagation()
                window.open(part, '_blank')
              }}
            >
              {part}
            </a>
          )
        }
        return <span key={i}>{part}</span>
      })}
    </div>
  )
}

async function getPageContent(): Promise<{page_content: string, page_details: {title: string, url: string, headings?: Array<{level: string, text: string}>, links?: Array<{href: string, text: string}>, meta?: Record<string, string>, products?: Array<{name: string, url: string, price?: string, description?: string}>}}> {
  const chromeAPI = window.chrome;
  if (chromeAPI && chromeAPI.runtime) {
    return new Promise((resolve) => {
      chromeAPI.runtime.sendMessage({ action: "getPageContent" }, (response: unknown) => {
        const r = response as {text?: string; title?: string; url?: string; headings?: Array<{level: string, text: string}>; links?: Array<{href: string, text: string}>; meta?: Record<string, string>; products?: Array<{name: string, url: string, price?: string, description?: string}>} | undefined;
        if (r) {
          resolve({
            page_content: r.text || "",
            page_details: { 
              title: r.title || "", 
              url: r.url || "",
              headings: r.headings || [],
              links: r.links || [],
              meta: r.meta || {},
              products: r.products || []
            }
          });
        } else {
          resolve({ page_content: "", page_details: { title: "", url: "" } });
        }
      });
    });
  }
  return { page_content: "", page_details: { title: "", url: "" } };
}

function extractUrls(text: string): string[] {
  const urlRegex = /(https?:\/\/[^\s\)\]>]+)/g;
  const matches = text.match(urlRegex);
  return matches || [];
}

function openUrl(url: string) {
  const chromeAPI = window.chrome;
  if (chromeAPI && chromeAPI.runtime) {
    chromeAPI.runtime.sendMessage({ action: "openTabs", urls: [url] });
  }
}

export function Chat({ sessionId }: ChatProps) {
  const [messages, setMessages] = React.useState<Message[]>([])
  const [input, setInput] = React.useState("")
  const [status, setStatus] = React.useState<StatusIndicatorProps["status"]>("idle")
  const [isLoading, setIsLoading] = React.useState(false)
  const [isListening, setIsListening] = React.useState(false)
  const [lastMessage, setLastMessage] = React.useState("")
  const [copied, setCopied] = React.useState(false)
  const scrollRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
    
    const chromeAPI = window.chrome;
    if (chromeAPI && chromeAPI.runtime) {
      chromeAPI.runtime.onMessage.addListener((request: any) => {
        if (request.action === "speechResult") {
          setInput(request.transcript);
        }
        if (request.action === "speechEnded" || request.action === "speechError") {
          setIsListening(false);
        }
        if (request.action === "speechStarted") {
          setIsListening(true);
        }
      });
    }
  }, [])

  const startListening = () => {
    const chromeAPI = window.chrome;
    if (!chromeAPI || !chromeAPI.runtime) {
      return;
    }
    
    chromeAPI.runtime.sendMessage({ action: "startListening" }, (response: any) => {
      if (response && response.status === "started") {
        setIsListening(true);
      }
    });
  }

  const stopListening = () => {
    const chromeAPI = window.chrome;
    if (chromeAPI && chromeAPI.runtime) {
      chromeAPI.runtime.sendMessage({ action: "stopListening" });
      setIsListening(false);
    }
  }

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input,
    }
    
    setMessages((prev) => [...prev, userMessage])
    setInput("")
    setIsLoading(true)
    setStatus("thinking")

    try {
      const pageData = await getPageContent();
      
      const response = await fetch(`http://localhost:8000/chat/${sessionId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMessage.content,
          page_content: pageData.page_content,
          page_details: pageData.page_details
        }),
      })
      
      const data = await response.json()
      
      if (data.open_url) {
        const chromeAPI = window.chrome;
        if (chromeAPI && chromeAPI.runtime) {
          chromeAPI.runtime.sendMessage({ action: "openTabs", urls: [data.open_url] });
        }
      }
      
      setMessages((prev) => [
        ...prev,
        { 
          id: Date.now().toString(), 
          role: "assistant", 
          content: data.response,
          searchResults: data.search_results 
        },
      ])
      setLastMessage(data.response)
    } catch (err) {
      setStatus("error")
    } finally {
      setIsLoading(false)
    }
  }

  const currentUrls = extractUrls(lastMessage);

  return (
    <div className="flex flex-col h-screen p-4 gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Chrome Assistant</h1>
        <StatusIndicator status={status} />
      </div>

      <ScrollArea className="flex-1">
        <div ref={scrollRef} className="space-y-4 pr-4">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-3 ${
                msg.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              {msg.role === "assistant" && (
                <Bot className="h-8 w-8 shrink-0 text-muted-foreground" />
              )}
              <div
                className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted"
                }`}
              >
                <MessageContent content={msg.content} />
                {msg.searchResults && msg.searchResults.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-border">
                    <div className="text-xs text-muted-foreground mb-1">Нажми, чтобы открыть:</div>
                    {msg.searchResults.map((result, i) => (
                      <button 
                        key={i}
                        type="button"
                        className="block w-full text-left text-xs text-blue-600 hover:bg-muted px-1 py-0.5 rounded"
                        onClick={(e) => {
                          e.stopPropagation()
                          const chromeAPI = window.chrome;
                          if (chromeAPI && chromeAPI.runtime) {
                            chromeAPI.runtime.sendMessage({ action: "openTabs", urls: [result.url] });
                          } else {
                            window.open(result.url, '_blank');
                          }
                        }}
                      >
                        {i + 1}) {result.title}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {msg.role === "user" && (
                <User className="h-8 w-8 shrink-0 text-muted-foreground" />
              )}
            </div>
          ))}
          {isLoading && status === "thinking" && (
            <div className="flex gap-3">
              <Bot className="h-8 w-8 shrink-0 text-muted-foreground" />
              <div className="bg-muted rounded-lg px-3 py-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      <form onSubmit={sendMessage} className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Спросите что-нибудь..."
          className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
          disabled={isLoading}
        />
        <Button
          type="button"
          size="icon"
          variant={isListening ? "destructive" : "ghost"}
          onClick={isListening ? stopListening : startListening}
          disabled={isLoading}
        >
          {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
        </Button>
        <Button type="submit" size="icon" disabled={isLoading || !input.trim()}>
          <Send className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          onClick={() => {
            navigator.clipboard.writeText(lastMessage);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }}
          disabled={!lastMessage}
          className="text-blue-600 hover:text-blue-700"
        >
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        </Button>
        {currentUrls.length > 0 && (
          <Button
            type="button"
            size="icon"
            variant="ghost"
            onClick={() => openUrl(currentUrls[0])}
            className="text-blue-600 hover:text-blue-700"
            title="Открыть ссылку"
          >
            <ExternalLink className="h-4 w-4" />
          </Button>
        )}
      </form>
    </div>
  )
}