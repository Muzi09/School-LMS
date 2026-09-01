import React, { createContext, useContext, useState, useEffect, useCallback } from "react"
import { authService } from "@/api/authService"
import { applySchoolTheme, resetSchoolTheme } from "@/lib/themeEngine"

const AuthContext = createContext(null)

const TOKEN_KEY = "school_lms_auth_token"
const USER_KEY = "school_lms_auth_user"

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY) || null)
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem(USER_KEY)
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        // Apply theme immediately if cached
        if (parsed?.school_primary_color) {
          applySchoolTheme(parsed.school_primary_color)
        }
        return parsed
      } catch {
        return null
      }
    }
    return null
  })
  const [isLoading, setIsLoading] = useState(true)

  // Verify and sync session on mount if token exists
  useEffect(() => {
    async function initAuth() {
      const storedToken = localStorage.getItem(TOKEN_KEY)
      if (storedToken) {
        try {
          const freshUser = await authService.getMe()
          setUser(freshUser)
          localStorage.setItem(USER_KEY, JSON.stringify(freshUser))
          if (freshUser?.school_primary_color) {
            applySchoolTheme(freshUser.school_primary_color)
          } else {
            resetSchoolTheme()
          }
        } catch (err) {
          console.warn("Session expired or invalid:", err)
          localStorage.removeItem(TOKEN_KEY)
          localStorage.removeItem(USER_KEY)
          setToken(null)
          setUser(null)
          resetSchoolTheme()
        }
      } else {
        resetSchoolTheme()
      }
      setIsLoading(false)
    }

    initAuth()
  }, [])

  const setAuthSession = useCallback((newToken, newUser) => {
    setToken(newToken)
    setUser(newUser)
    if (newToken) {
      localStorage.setItem(TOKEN_KEY, newToken)
    } else {
      localStorage.removeItem(TOKEN_KEY)
    }
    if (newUser) {
      localStorage.setItem(USER_KEY, JSON.stringify(newUser))
      if (newUser?.school_primary_color) {
        applySchoolTheme(newUser.school_primary_color)
      } else {
        resetSchoolTheme()
      }
    } else {
      localStorage.removeItem(USER_KEY)
      resetSchoolTheme()
    }
  }, [])

  const login = useCallback(async (email, password) => {
    const res = await authService.login(email, password)
    setAuthSession(res.access_token, res.user)
    return res
  }, [setAuthSession])

  const quickLogin = useCallback(async (email, pin) => {
    const res = await authService.quickLogin(email, pin)
    setAuthSession(res.access_token, res.user)
    return res
  }, [setAuthSession])

  const logout = useCallback(() => {
    setAuthSession(null, null)
    resetSchoolTheme()
  }, [setAuthSession])

  const isSuperAdmin = user?.role === 0
  const isPrincipal = user?.role === 1
  const isStaff = user?.role === 2

  const value = {
    token,
    user,
    role: user?.role,
    isAuthenticated: !!token && !!user,
    isSuperAdmin,
    isPrincipal,
    isStaff,
    isLoading,
    login,
    quickLogin,
    logout,
    setAuthSession,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
