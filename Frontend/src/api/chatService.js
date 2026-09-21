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

  /**
   * Create a new group conversation
   */
  async createGroup({ name, participant_ids }) {
    return apiClient.post("chat/conversations/groups", { name, participant_ids })
  },

  /**
   * Create a new broadcast conversation
   */
  async createBroadcast({ name, recipient_ids }) {
    return apiClient.post("chat/conversations/broadcasts", { name, recipient_ids })
  },

  /**
   * Get detailed info for a group or broadcast conversation
   */
  async getConversationDetails(conversationId) {
    return apiClient.get(`chat/conversations/${conversationId}/details`)
  },

  /**
   * Update conversation metadata (e.g. rename group/broadcast)
   */
  async updateConversation(conversationId, data) {
    return apiClient.patch(`chat/conversations/${conversationId}`, data)
  },

  /**
   * Add participants to an existing group or broadcast
   */
  async addParticipants(conversationId, participantIds) {
    return apiClient.post(`chat/conversations/${conversationId}/participants`, {
      participant_ids: participantIds,
    })
  },

  /**
   * Remove a participant from a group or broadcast
   */
  async removeParticipant(conversationId, userId) {
    return apiClient.delete(`chat/conversations/${conversationId}/participants/${userId}`)
  },

  /**
   * Leave a group (optionally transferring ownership)
   */
  async leaveGroup(conversationId, newOwnerId = null) {
    return apiClient.post(`chat/conversations/${conversationId}/leave`, {
      new_owner_id: newOwnerId,
    })
  },
}

export default chatService
