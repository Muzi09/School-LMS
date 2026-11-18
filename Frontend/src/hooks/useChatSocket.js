import { useState, useEffect, useRef, useCallback } from "react"
import { useAuth } from "@/context/authState"

/**
 * @typedef {object} ChatSocketCallbacks
 * @property {(message: object, tempId?: string) => void} [onMessage]
 * @property {(message: object, tempId?: string) => void} [onMessageSent]
 * @property {(error: string, tempId: string, conversationId: string) => void} [onMessageFailed]
 * @property {(userId: string, isOnline: boolean, lastSeenAt?: string | null) => void} [onPresenceChange]
 * @property {(conversationId: string, readerId: string, lastReadAt: string) => void} [onReadReceipt]
 * @property {(conversationId: string, userId: string, isTyping: boolean, userName?: string) => void} [onTyping]
 * @property {(event: { type: "conversation_updated", conversation_id: string }) => void} [onConversationUpdated]
 * @property {() => void} [onReconnect]
 */

/**
 * @param {ChatSocketCallbacks} [callbacks]
 * Custom hook for managing a persistent, authenticated WebSocket connection for LMS real-time chat.
 * Implements exponential backoff reconnection, heartbeat keep-alives, and event callbacks.
 */
export function useChatSocket({
  onMessage,
  onMessageSent,
  onMessageFailed,
  onPresenceChange,
  onReadReceipt,
  onTyping,
  onConversationUpdated,
  onReconnect,
} = {}) {
  const { user } = useAuth()
  const [status, setStatus] = useState(user ? "connecting" : "disconnected")
  const socketRef = useRef(null)
  const reconnectTimeoutRef = useRef(null)
  const reconnectAttemptsRef = useRef(0)
  const pingIntervalRef = useRef(null)
  const isUnmountedRef = useRef(false)
  const connectRef = useRef(null)

  // Keep latest callbacks in refs to avoid re-triggering connection effects
  const callbacksRef = useRef({
    onMessage,
    onMessageSent,
    onMessageFailed,
    onPresenceChange,
    onReadReceipt,
    onTyping,
    onConversationUpdated,
    onReconnect,
  })

  useEffect(() => {
    callbacksRef.current = {
      onMessage,
      onMessageSent,
      onMessageFailed,
      onPresenceChange,
      onReadReceipt,
      onTyping,
      onConversationUpdated,
      onReconnect,
    }
  }, [onMessage, onMessageSent, onMessageFailed, onPresenceChange, onReadReceipt, onTyping, onConversationUpdated, onReconnect])

  const connect = useCallback(() => {
    if (!user) {
      return
    }

    if (
      socketRef.current &&
      (socketRef.current.readyState === WebSocket.OPEN ||
        socketRef.current.readyState === WebSocket.CONNECTING)
    ) {
      return
    }

    const wsUrl = new URL("/ws/chat", window.location.origin)
    wsUrl.protocol = wsUrl.protocol === "https:" ? "wss:" : "ws:"

    try {
      const ws = new WebSocket(wsUrl)
      socketRef.current = ws

      ws.onopen = () => {
        if (isUnmountedRef.current) return
        setStatus("connected")
        const wasReconnecting = reconnectAttemptsRef.current > 0
        reconnectAttemptsRef.current = 0

        // Start ping heartbeat
        if (pingIntervalRef.current) clearInterval(pingIntervalRef.current)
        pingIntervalRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "ping" }))
          }
        }, 25000)

        if (wasReconnecting) {
          callbacksRef.current.onReconnect?.()
        }
      }

      ws.onmessage = (event) => {
        if (isUnmountedRef.current) return
        try {
          const data = JSON.parse(event.data)
          if (data.type === "pong") return

          if (data.type === "message") {
            callbacksRef.current.onMessage?.(data.message, data.temp_id)
          } else if (data.type === "message_sent") {
            callbacksRef.current.onMessageSent?.(data.message, data.temp_id)
          } else if (data.type === "message_failed") {
            callbacksRef.current.onMessageFailed?.(data.error, data.temp_id, data.conversation_id)
          } else if (data.type === "presence") {
            callbacksRef.current.onPresenceChange?.(data.user_id, data.is_online, data.last_seen_at)
          } else if (data.type === "read_receipt") {
            callbacksRef.current.onReadReceipt?.(data.conversation_id, data.reader_id, data.last_read_at)
          } else if (data.type === "typing") {
            callbacksRef.current.onTyping?.(data.conversation_id, data.user_id, data.is_typing, data.user_name)
          } else if (data.type === "conversation_updated") {
            callbacksRef.current.onConversationUpdated?.(data)
          }
        } catch (err) {
          console.error("Error parsing WebSocket message:", err)
        }
      }

      ws.onerror = (err) => {
        console.warn("WebSocket error:", err)
        setStatus("disconnected")
      }

      ws.onclose = (event) => {
        if (pingIntervalRef.current) {
          clearInterval(pingIntervalRef.current)
          pingIntervalRef.current = null
        }

        if (isUnmountedRef.current) return

        // 1008 = Policy violation -> do not retry immediately
        if (event.code === 1008) {
          console.warn("WebSocket closed due to policy violation / unauthorized.")
          setStatus("disconnected")
          return
        }

        setStatus("reconnecting")

        // Exponential backoff reconnect: 1s, 2s, 4s, 8s, max 15s
        const backoffMs = Math.min(1000 * Math.pow(1.5, reconnectAttemptsRef.current), 15000)
        reconnectAttemptsRef.current += 1

        if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current)
        reconnectTimeoutRef.current = setTimeout(() => {
          connectRef.current?.()
        }, backoffMs)
      }
    } catch (err) {
      console.error("Failed to initialize WebSocket:", err)
    }
  }, [user])

  useEffect(() => {
    connectRef.current = connect
  }, [connect])

  useEffect(() => {
    isUnmountedRef.current = false
    connect()

    return () => {
      isUnmountedRef.current = true
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current)
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current)
      if (socketRef.current) {
        socketRef.current.close()
        socketRef.current = null
      }
    }
  }, [connect])

  const sendMessage = useCallback((conversationId, content, tempId) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(
        JSON.stringify({
          type: "send_message",
          conversation_id: conversationId,
          content,
          temp_id: tempId,
        })
      )
      return true
    }
    return false
  }, [])

  const markRead = useCallback((conversationId) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(
        JSON.stringify({
          type: "mark_read",
          conversation_id: conversationId,
        })
      )
    }
  }, [])

  const startTyping = useCallback((conversationId) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(
        JSON.stringify({
          type: "typing_start",
          conversation_id: conversationId,
        })
      )
    }
  }, [])

  const stopTyping = useCallback((conversationId) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(
        JSON.stringify({
          type: "typing_stop",
          conversation_id: conversationId,
        })
      )
    }
  }, [])

  return {
    status,
    isConnected: status === "connected",
    isReconnecting: status === "reconnecting",
    sendMessage,
    markRead,
    startTyping,
    stopTyping,
    reconnect: connect,
  }
}
