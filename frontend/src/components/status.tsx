import { cn } from "@/lib/utils"

export interface StatusIndicatorProps {
  status: "idle" | "thinking" | "searching" | "responding" | "completed" | "error"
  className?: string
}

const statusLabels: Record<StatusIndicatorProps["status"], string> = {
  idle: "Ready",
  thinking: "Thinking...",
  searching: "Searching...",
  responding: "Responding...",
  completed: "Done",
  error: "Error",
}

const statusColors: Record<StatusIndicatorProps["status"], string> = {
  idle: "bg-muted",
  thinking: "bg-yellow-500",
  searching: "bg-blue-500",
  responding: "bg-purple-500",
  completed: "bg-green-500",
  error: "bg-red-500",
}

export function StatusIndicator({ status, className }: StatusIndicatorProps) {
  return (
    <div className={cn("flex items-center gap-2 text-sm", className)}>
      <span
        className={cn(
          "h-2 w-2 rounded-full animate-pulse",
          statusColors[status]
        )}
      />
      <span className="text-muted-foreground">{statusLabels[status]}</span>
    </div>
  )
}