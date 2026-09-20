import apiClient from "./client"

/**
 * Fetch existing Email Setup configuration for Principal's school account.
 */
export async function getPrincipalEmailSetupApi() {
  return apiClient.get("/principal/email-setup")
}

/**
 * Save or update Email Setup configuration for Principal's school account.
 * Automatically verifies connection with test email.
 */
export async function savePrincipalEmailSetupApi(payload) {
  return apiClient.post("/principal/email-setup", payload)
}

/**
 * Send a verification test email without saving credentials.
 */
export async function testPrincipalEmailSetupApi(payload) {
  return apiClient.post("/principal/email-setup/test", payload)
}
