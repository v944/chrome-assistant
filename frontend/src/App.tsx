import { Chat } from "./components/chat"
import { useState } from "react"

function App() {
  const [sessionId] = useState(() => {
    return localStorage.getItem("session_id") || 
           (() => {
             const id = crypto.randomUUID()
             localStorage.setItem("session_id", id)
             return id
           })()
  })

  return <Chat sessionId={sessionId} />
}

export default App