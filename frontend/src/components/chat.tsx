import * as React from "react"
import { Send, Loader2, Bot, User } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { StatusIndicator, type StatusIndicatorProps } from "@/components/status"

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
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

async function getPageContent(): Promise<{page_content: string, page_details: {title: string, url: string, headings?: Array<{level: string, text: string}>, links?: Array<{href: string, text: string}>, images?: Array<{src: string, alt: string}>, meta?: Record<string, string>}}> {
  const chromeAPI = window.chrome;
  if (chromeAPI && chromeAPI.runtime) {
    return new Promise((resolve) => {
      chromeAPI.runtime.sendMessage({ action: "getPageContent" }, (response: unknown) => {
        const r = response as {text?: string; title?: string; url?: string; headings?: Array<{level: string, text: string}>; links?: Array<{href: string, text: string}>; images?: Array<{src: string, alt: string}>; meta?: Record<string, string>} | undefined;
        if (r) {
          resolve({
            page_content: r.text || "",
            page_details: { 
              title: r.title || "", 
              url: r.url || "",
              headings: r.headings || [],
              links: r.links || [],
              images: r.images || [],
              meta: r.meta || {}
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

export function Chat({ sessionId }: ChatProps) {
  const [messages, setMessages] = React.useState<Message[]>([])
  const [input, setInput] = React.useState("")
  const [status, setStatus] = React.useState<StatusIndicatorProps["status"]>("idle")
  const [isLoading, setIsLoading] = React.useState(false)
  const scrollRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input,
    }
    
    console.log("=== SENDING TO SERVER ===")
    console.log("Input:", input)
    console.log("Session:", sessionId)
    
    setMessages((prev) => [...prev, userMessage])
    setInput("")
    setIsLoading(true)
    setStatus("thinking")

    try {
      const pageData = await getPageContent();
      console.log("Page content length:", pageData.page_content.length);
      console.log("Page details:", pageData.page_details);
      
      const response = await fetch(`http://localhost:8000/chat/${sessionId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMessage.content,
          page_content: pageData.page_content,
          page_details: pageData.page_details
        }),
      })
      
      console.log("Response status:", response.status)
      
      const data = await response.json()
      console.log("Response data:", data)
      
      setMessages((prev) => [
        ...prev,
        { id: Date.now().toString(), role: "assistant", content: data.response },
      ])
    } catch (err) {
      console.error("Error:", err)
      setStatus("error")
    } finally {
      setIsLoading(false)
    }
  }

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
          placeholder="Ask anything..."
          className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
          disabled={isLoading}
        />
        <Button type="submit" size="icon" disabled={isLoading}>
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  )
}