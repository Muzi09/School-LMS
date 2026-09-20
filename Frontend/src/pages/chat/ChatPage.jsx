import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import { useAuth } from "@/context/AuthContext"
import { chatService } from "@/api/chatService"
import { useChatSocket } from "@/hooks/useChatSocket"
import { ConversationList } from "@/components/chat/ConversationList"
import { ChatWindow } from "@/components/chat/ChatWindow"
import { EmptyChatState } from "@/components/chat/EmptyChatState"
import { UserSearchModal } from "@/components/chat/UserSearchModal"

export function ChatPage() {
  const { user } = useAuth()
  const [conversations, setConversations] = useState([])
  const [activeConversationId, setActiveConversationId] = useState(null)
  const [messages, setMessages] = useState([])
  const [isLoadingConversations, setIsLoadingConversations] = useState(true)
  const [isLoadingMessages, setIsLoadingMessages] = useState(false)
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(() => typeof window !== "undefined" && window.innerWidth < 768)
  const [typingByConversation, setTypingByConversation] = useState({})
  const socketMarkReadRef = useRef(null)
  const safetyTimeoutsRef = useRef({})

  // Track responsive screen size
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768)
    }
    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [])

  // Load initial conversations list
  useEffect(() => {
    let ignore = false
    async function init() {
      try {
        const data = await chatService.getConversations()
        if (!ignore) {
          setConversations(data || [])
          setIsLoadingConversations(false)
        }
      } catch (err) {
        console.error("Failed to load conversations:", err)
        if (!ignore) setIsLoadingConversations(false)
      }
    }
    init()
    return () => {
      ignore = true
    }
  }, [])

  const reloadConversations = useCallback(async () => {
    try {
      const data = await chatService.getConversations()
      setConversations(data || [])
    } catch (err) {
      console.error("Failed to reload conversations:", err)
    }
  }, [])

  // Load messages when active conversation changes
  const loadActiveMessages = useCallback(async (convId) => {
    setIsLoadingMessages(true)
    try {
      const res = await chatService.getMessages(convId)
      setMessages(res?.messages || [])
      // Mark as read on server & socket
      socketMarkReadRef.current?.(convId)
      await chatService.markAsRead(convId)
      // Clear unread badge locally
      setConversations((prev) =>
        prev.map((c) => (c.id === convId ? { ...c, unread_count: 0 } : c))
      )
    } catch (err) {
      console.error("Failed to load conversation messages:", err)
    } finally {
      setIsLoadingMessages(false)
    }
  }, [])

  const handleSelectConversation = useCallback(
    (conv) => {
      setActiveConversationId(conv.id)
      loadActiveMessages(conv.id)
    },
    [loadActiveMessages]
  )

  // WebSocket event handlers
  const handleIncomingMessage = useCallback(
    (message) => {
      // 1. If currently in this conversation, append message and mark as read
      if (message.conversation_id === activeConversationId) {
        setMessages((prev) => {
          // Avoid duplicate messages
          if (prev.some((m) => m.id === message.id)) return prev
          return [...prev, message]
        })
        socketMarkReadRef.current?.(activeConversationId)
        chatService.markAsRead(activeConversationId).catch(() => {})
      }

      // 2. Message received from sender clears any active typing indicator for that conversation
      if (message.sender_id !== user?.id) {
        if (safetyTimeoutsRef.current[message.conversation_id]) {
          clearTimeout(safetyTimeoutsRef.current[message.conversation_id])
          delete safetyTimeoutsRef.current[message.conversation_id]
        }
        setTypingByConversation((prev) => {
          if (!prev[message.conversation_id]) return prev
          const next = { ...prev }
          delete next[message.conversation_id]
          return next
        })
      }

      // 3. Update conversation list preview and unread count
      setConversations((prev) => {
        const existingIdx = prev.findIndex((c) => c.id === message.conversation_id)
        if (existingIdx === -1) {
          // New conversation not yet in list -> reload
          reloadConversations()
          return prev
        }

        const target = prev[existingIdx]
        const isCurrentOpen = message.conversation_id === activeConversationId
        const updated = {
          ...target,
          last_message: message,
          updated_at: message.created_at,
          unread_count: isCurrentOpen
            ? 0
            : (target.unread_count || 0) + (message.sender_id !== user?.id ? 1 : 0),
        }

        const rest = prev.filter((_, idx) => idx !== existingIdx)
        // Move updated conversation to top
        return [updated, ...rest]
      })
    },
    [activeConversationId, user?.id, reloadConversations]
  )

  const handleMessageSent = useCallback((message, tempId) => {
    // Reconcile optimistic temporary message
    setMessages((prev) =>
      prev.map((m) => {
        if (m.temp_id === tempId || m.id === tempId) {
          return { ...message, status: "sent" }
        }
        return m
      })
    )

    // Update last message in conversation list
    setConversations((prev) =>
      prev.map((c) => {
        if (c.id === message.conversation_id) {
          return { ...c, last_message: message, updated_at: message.created_at }
        }
        return c
      })
    )
  }, [])

  const handleMessageFailed = useCallback((error, tempId) => {
    setMessages((prev) =>
      prev.map((m) => {
        if (m.temp_id === tempId || m.id === tempId) {
          return { ...m, status: "failed" }
        }
        return m
      })
    )
  }, [])

  const handlePresenceChange = useCallback((userId, isOnline) => {
    setConversations((prev) =>
      prev.map((c) => {
        if (c.other_participant?.id === userId) {
          return {
            ...c,
            other_participant: {
              ...c.other_participant,
              is_online: isOnline,
            },
          }
        }
        return c
      })
    )
  }, [])

  const handleReadReceipt = useCallback(
    (conversationId, readerId, lastReadAt) => {
      // 1. If currently viewing this conversation, mark all outgoing messages as read
      if (conversationId === activeConversationId) {
        setMessages((prev) =>
          prev.map((msg) => {
            if (msg.sender_id === user?.id && !msg.is_read) {
              if (
                !lastReadAt ||
                !msg.created_at ||
                new Date(msg.created_at) <= new Date(lastReadAt)
              ) {
                return { ...msg, is_read: true }
              }
            }
            return msg
          })
        )
      }

      // 2. Also update last_message in conversation list
      setConversations((prev) =>
        prev.map((c) => {
          if (
            c.id === conversationId &&
            c.last_message &&
            c.last_message.sender_id === user?.id
          ) {
            return {
              ...c,
              last_message: {
                ...c.last_message,
                is_read: true,
              },
            }
          }
          return c
        })
      )
    },
    [activeConversationId, user?.id]
  )

  const handleTyping = useCallback(
    (conversationId, userId, isTyping) => {
      // Ignore typing events from self
      if (userId === user?.id) return

      if (isTyping) {
        // Clear any previous safety timer for this conversation
        if (safetyTimeoutsRef.current[conversationId]) {
          clearTimeout(safetyTimeoutsRef.current[conversationId])
        }

        setTypingByConversation((prev) => ({ ...prev, [conversationId]: true }))

        // Set a 4-second safety auto-clear timer in case typing_stop packet was dropped
        safetyTimeoutsRef.current[conversationId] = setTimeout(() => {
          setTypingByConversation((prev) => {
            if (!prev[conversationId]) return prev
            const next = { ...prev }
            delete next[conversationId]
            return next
          })
          delete safetyTimeoutsRef.current[conversationId]
        }, 4000)
      } else {
        if (safetyTimeoutsRef.current[conversationId]) {
          clearTimeout(safetyTimeoutsRef.current[conversationId])
          delete safetyTimeoutsRef.current[conversationId]
        }
        setTypingByConversation((prev) => {
          if (!prev[conversationId]) return prev
          const next = { ...prev }
          delete next[conversationId]
          return next
        })
      }
    },
    [user?.id]
  )

  // Clear all safety timers on unmount
  useEffect(() => {
    const timeoutsRef = safetyTimeoutsRef
    return () => {
      const timeouts = timeoutsRef.current
      Object.values(timeouts).forEach((t) => clearTimeout(t))
    }
  }, [])

  const handleReconnect = useCallback(() => {
    setTypingByConversation({})
    reloadConversations()
    if (activeConversationId) {
      loadActiveMessages(activeConversationId)
    }
  }, [reloadConversations, loadActiveMessages, activeConversationId])

  // Initialize persistent chat socket
  const {
    status: socketStatus,
    sendMessage: socketSend,
    markRead: socketMarkRead,
    startTyping: socketStartTyping,
    stopTyping: socketStopTyping,
    reconnect,
  } = useChatSocket({
    onMessage: handleIncomingMessage,
    onMessageSent: handleMessageSent,
    onMessageFailed: handleMessageFailed,
    onPresenceChange: handlePresenceChange,
    onReadReceipt: handleReadReceipt,
    onTyping: handleTyping,
    onReconnect: handleReconnect,
  })

  useEffect(() => {
    socketMarkReadRef.current = socketMarkRead
  }, [socketMarkRead])

  const handleTypingStart = useCallback(() => {
    if (activeConversationId) {
      socketStartTyping(activeConversationId)
    }
  }, [activeConversationId, socketStartTyping])

  const handleTypingStop = useCallback(() => {
    if (activeConversationId) {
      socketStopTyping(activeConversationId)
    }
  }, [activeConversationId, socketStopTyping])

  // Send message handler with optimistic UI
  const handleSendMessage = useCallback(
    async (content) => {
      if (!activeConversationId || !user) return

      const tempId = `temp-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`
      const optimisticMsg = {
        id: tempId,
        temp_id: tempId,
        conversation_id: activeConversationId,
        sender_id: user.id,
        content,
        created_at: new Date().toISOString(),
        status: "sending",
      }

      // Add optimistic message to list immediately
      setMessages((prev) => [...prev, optimisticMsg])

      // Try sending via WebSocket
      const sentViaWs = socketSend(activeConversationId, content, tempId)
      if (!sentViaWs) {
        // Fallback to REST API
        try {
          const persisted = await chatService.sendMessage(activeConversationId, content)
          handleMessageSent(persisted, tempId)
        } catch (err) {
          console.error("REST fallback send failed:", err)
          handleMessageFailed(err.message, tempId)
        }
      }
    },
    [activeConversationId, user, socketSend, handleMessageSent, handleMessageFailed]
  )

  // Retry sending a failed message
  const handleRetryMessage = useCallback(
    (msg) => {
      setMessages((prev) =>
        prev.map((m) => (m.id === msg.id ? { ...m, status: "sending" } : m))
      )
      const sent = socketSend(msg.conversation_id, msg.content, msg.temp_id || msg.id)
      if (!sent) {
        chatService
          .sendMessage(msg.conversation_id, msg.content)
          .then((res) => handleMessageSent(res, msg.temp_id || msg.id))
          .catch((err) => handleMessageFailed(err.message, msg.temp_id || msg.id))
      }
    },
    [socketSend, handleMessageSent, handleMessageFailed]
  )

  // Starting a conversation from user search
  const handleStartConversationWithUser = useCallback(
    async (selectedUser) => {
      try {
        const conv = await chatService.createConversation(selectedUser.id)
        setConversations((prev) => {
          if (prev.some((c) => c.id === conv.id)) return prev
          return [conv, ...prev]
        })
        setActiveConversationId(conv.id)
        loadActiveMessages(conv.id)
      } catch (err) {
        console.error("Failed to create conversation:", err)
      }
    },
    [loadActiveMessages]
  )

  const activeConversation = useMemo(
    () => conversations.find((c) => c.id === activeConversationId) || null,
    [conversations, activeConversationId]
  )

  return (
    <div className="flex h-[calc(100vh-4.1rem)] w-full overflow-hidden bg-background">
      {/* Left / Conversation List (visible on desktop or on mobile when no active conversation) */}
      <div
        className={`h-full w-full md:w-[340px] lg:w-[380px] shrink-0 ${
          isMobile && activeConversationId ? "hidden" : "block"
        }`}
      >
        <ConversationList
          conversations={conversations}
          activeConversationId={activeConversationId}
          onSelectConversation={handleSelectConversation}
          onOpenNewChat={() => setIsSearchModalOpen(true)}
          isLoading={isLoadingConversations}
          socketStatus={socketStatus}
          onRetryConnect={reconnect}
        />
      </div>

      {/* Right / Chat Window (visible on desktop or on mobile when active conversation is selected) */}
      <div
        className={`h-full flex-1 overflow-hidden ${
          isMobile && !activeConversationId ? "hidden" : "flex flex-col"
        }`}
      >
        {activeConversation ? (
          <ChatWindow
            conversation={activeConversation}
            messages={messages}
            currentUserId={user?.id}
            isLoadingMessages={isLoadingMessages}
            isTyping={Boolean(activeConversationId && typingByConversation[activeConversationId])}
            onSendMessage={handleSendMessage}
            onRetryMessage={handleRetryMessage}
            onTypingStart={handleTypingStart}
            onTypingStop={handleTypingStop}
            onBack={() => setActiveConversationId(null)}
            isMobile={isMobile}
          />
        ) : (
          <EmptyChatState onNewChat={() => setIsSearchModalOpen(true)} />
        )}
      </div>

      {/* User Search & Discovery Modal */}
      <UserSearchModal
        isOpen={isSearchModalOpen}
        onOpenChange={setIsSearchModalOpen}
        onSelectUser={handleStartConversationWithUser}
      />
    </div>
  )
}

export default ChatPage
