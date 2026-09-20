import { apiClient } from "@/api/client"

export const chatService = {
  /**
   * Search users within the same school for chat
   */
  async searchUsers(search) {
    return apiClient.get("chat/users", {
      params: search ? { search } : {},
    })
  },

  /**
   * Fetch all active conversations for the current user
   */
  async getConversations() {
    return apiClient.get("chat/conversations")
  },

  /**
   * Get or create a direct 1-to-1 conversation with a user
   */
  async createConversation(userId) {
    return apiClient.post("chat/conversations", { user_id: userId })
  },

  /**
   * Get paginated message history for a conversation
   */
  async getMessages(conversationId, { limit = 50, before = null } = {}) {
    const params = { limit }
    if (before) params.before = before
    return apiClient.get(`chat/conversations/${conversationId}/messages`, { params })
  },

  /**
   * Send a message via REST API (fallback / direct send)
   */
  async sendMessage(conversationId, content) {
    return apiClient.post(`chat/conversations/${conversationId}/messages`, { content })
  },

  /**
   * Mark a conversation as read by the current user
   */
  async markAsRead(conversationId) {
    return apiClient.post(`chat/conversations/${conversationId}/read`)
  },
}

export default chatService
