import { useCallback, useEffect, useRef, useState } from "react"
import { AuthContext } from "./authState"
import { toast } from "sonner"
import { authService } from "@/api/authService"
import { queryClient } from "@/lib/queryClient"
import { applySchoolTheme, resetSchoolTheme } from "@/lib/themeEngine"

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const channel = useRef(null)
  const transition = useRef(0)

  const commitUser = useCallback((nextUser) => {
    void queryClient.cancelQueries()
    queryClient.clear()
    setUser(nextUser)
    if (nextUser?.school_primary_color) {
      applySchoolTheme(nextUser.school_primary_color)
    } else {
      resetSchoolTheme()
    }
  }, [])

  useEffect(() => {
    localStorage.removeItem("school_lms_auth_token")
    localStorage.removeItem("school_lms_auth_user")
    const broadcast = typeof BroadcastChannel === "undefined" ? null : new BroadcastChannel("lms-session")
    channel.current = broadcast

    const clearSession = () => {
      transition.current += 1
      commitUser(null)
      setIsLoading(false)
    }

    const syncSession = async () => {
      const requestId = ++transition.current
      commitUser(null)
      setIsLoading(true)
      try {
        const currentUser = await authService.getMe()
        if (requestId === transition.current) commitUser(currentUser)
      } catch {
        if (requestId === transition.current) commitUser(null)
      } finally {
        if (requestId === transition.current) setIsLoading(false)
      }
    }

    void syncSession()
    window.addEventListener("lms-session-expired", clearSession)
    if (broadcast) {
      broadcast.onmessage = ({ data }) => {
        if (data === "logout") clearSession()
        if (data === "login") void syncSession()
      }
    }
    return () => {
      transition.current += 1
      window.removeEventListener("lms-session-expired", clearSession)
      broadcast?.close()
      channel.current = null
    }
  }, [commitUser])

  const login = useCallback(async (email, password) => {
    const requestId = ++transition.current
    const result = await authService.login(email, password)
    if (requestId === transition.current) {
      commitUser(result.user)
      setIsLoading(false)
      channel.current?.postMessage("login")
    }
    return result
  }, [commitUser])

  const logout = useCallback(async () => {
    try {
      await authService.logout()
    } catch {
      toast.error("Unable to sign out. Check your connection and try again.")
      return false
    }
    transition.current += 1
    commitUser(null)
    setIsLoading(false)
    channel.current?.postMessage("logout")
    return true
  }, [commitUser])

  return (
    <AuthContext.Provider value={{
      user,
      role: user?.role,
      isAuthenticated: Boolean(user),
      isAdmin: user?.role === 0,
      isSuperAdmin: user?.role === 0,
      isPrincipal: user?.role === 1,
      isStaff: user?.role === 2,
      isLoading,
      login,
      logout,
    }}>
      {children}
    </AuthContext.Provider>
  )
}
