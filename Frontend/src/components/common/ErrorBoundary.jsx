import React from "react"
import { AlertTriangle, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo)
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
    if (this.props.onReset) {
      this.props.onReset()
    }
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback({
          error: this.state.error,
          reset: this.handleReset,
        })
      }

      return (
        <div className="p-4 rounded-xl border border-destructive/30 bg-destructive/10 text-destructive space-y-3">
          <div className="flex items-center gap-2 font-bold text-sm">
            <AlertTriangle className="size-4 shrink-0" />
            <span>Something went wrong</span>
          </div>
          <p className="text-xs opacity-90">
            {this.state.error?.message || "An unexpected error occurred."}
          </p>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={this.handleReset}
              className="text-xs h-7 gap-1"
            >
              <RefreshCw className="size-3" />
              <span>Try Again</span>
            </Button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

