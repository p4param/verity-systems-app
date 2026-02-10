"use client"

import React, {
    createContext,
    useContext,
    useEffect,
    useRef,
    useState,
    useCallback
} from "react"
import { useRouter } from "next/navigation"
import { handleAPIResponse } from "../api-client"
import { AuthUser } from "./auth-types"

type AuthContextType = {
    user: AuthUser | null
    accessToken: string | null
    loading: boolean
    login: (email: string, password: string) => Promise<any>
    logout: () => Promise<void>
    mfaRequired: boolean
    mfaSetupRequired: boolean
    verifyMfa: (code: string) => Promise<void>
    refreshTokens: () => Promise<boolean>
    fetchWithAuth: <T = any>(
        input: RequestInfo | URL,
        init?: RequestInit
    ) => Promise<T>
}

const AuthContext = createContext<AuthContextType | null>(null)

// Helper to check if JWT is expired (client-side)
const isTokenExpired = (token: string): boolean => {
    try {
        const payloadBase64 = token.split(".")[1]
        if (!payloadBase64) return true;
        const payload = JSON.parse(atob(payloadBase64))
        // Verify exp exists and compare with current time (with 10s buffer)
        if (!payload.exp) return false;
        return payload.exp * 1000 < (Date.now() + 10000)
    } catch {
        return true
    }
}


export function AuthProvider({ children }: { children: React.ReactNode }) {
    const router = useRouter()

    const [user, setUser] = useState<AuthUser | null>(null)
    const [accessToken, setAccessToken] = useState<string | null>(null)
    const [loading, setLoading] = useState(true)
    const [mfaRequired, setMfaRequired] = useState(false)
    const [mfaSetupRequired, setMfaSetupRequired] = useState(false)
    const tempTokenRef = useRef<string | null>(null)

    // Always point to latest token for async calls
    const accessTokenRef = useRef<string | null>(null)
    useEffect(() => {
        accessTokenRef.current = accessToken
    }, [accessToken])

    // Keep loading ref in sync for async functions
    const loadingRef = useRef(true)
    useEffect(() => {
        loadingRef.current = loading
    }, [loading])

    // Single-flight refresh
    const refreshPromise = useRef<Promise<string | null> | null>(null)

    /* ----------------------------------------
       Session helpers
    ---------------------------------------- */

    const setSession = (access: string, refresh: string) => {
        setAccessToken(access)
        localStorage.setItem("refreshToken", refresh)
    }

    const clearSession = () => {
        setAccessToken(null)
        setUser(null)
        setMfaRequired(false)
        setMfaSetupRequired(false)
        tempTokenRef.current = null
        localStorage.removeItem("refreshToken")
    }

    /* ----------------------------------------
       Auth actions
    ---------------------------------------- */

    const login = async (email: string, password: string) => {
        const res = await fetch("/api/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password })
        })

        if (!res.ok) {
            const data = await res.json()
            throw new Error(data.error || "Login failed")
        }

        const data = await res.json()

        // MFA Challenge?
        if (data.mfaRequired) {
            setMfaRequired(true)
            if (data.setupRequired) {
                setMfaSetupRequired(true)
            }
            tempTokenRef.current = data.tempToken
            return data
        }

        // Standard Login
        if (data.accessToken) {
            setSession(data.accessToken, data.refreshToken)
            setUser(data.user)
            router.push("/dashboard")
        }

        return data
    }

    const verifyMfa = async (code: string) => {
        const tempToken = tempTokenRef.current
        if (!tempToken) {
            throw new Error("MFA session expired or invalid. Please login again.")
        }

        const res = await fetch("/api/auth/mfa/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ tempToken, code })
        })

        if (!res.ok) {
            const data = await res.json()
            throw new Error(data.error || "Verification failed")
        }

        const data = await res.json()
        setSession(data.accessToken, data.refreshToken)
        setUser(data.user)

        // Clear MFA state on success
        setMfaRequired(false)
        setMfaSetupRequired(false)
        tempTokenRef.current = null

        router.push("/dashboard")
    }

    const logout = useCallback(async () => {
        try {
            const refreshToken = localStorage.getItem("refreshToken")
            if (refreshToken) {
                await fetch("/api/auth/logout", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ refreshToken })
                })
            }
        } catch {
            // ignore
        } finally {
            clearSession()
            router.push("/login")
        }
    }, [router])

    /* ----------------------------------------
       Refresh logic (ROTATING refresh tokens)
    ---------------------------------------- */

    const refreshTokensInternal = async (): Promise<string | null> => {
        const refreshToken = localStorage.getItem("refreshToken")
        if (!refreshToken) return null

        const res = await fetch("/api/auth/refresh", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ refreshToken })
        })

        if (!res.ok) return null

        const data = await res.json()
        setSession(data.accessToken, data.refreshToken)
        if (data.user) {
            setUser(data.user)
        }
        return data.accessToken
    }

    const getRefreshTokenSingleton = async (): Promise<string | null> => {
        if (!refreshPromise.current) {
            refreshPromise.current = (async () => {
                try {
                    return await refreshTokensInternal()
                } finally {
                    refreshPromise.current = null
                }
            })()
        }

        return refreshPromise.current
    }

    const refreshTokens = async (): Promise<boolean> => {
        return !!(await getRefreshTokenSingleton())
    }

    /* ----------------------------------------
       Authenticated fetch helper
    ---------------------------------------- */

    const fetchWithAuth = async <T = any>(
        input: RequestInfo | URL,
        init: RequestInit = {}
    ): Promise<T> => {
        // Global Guard: Wait for session restore to complete
        if (loadingRef.current) {
            while (loadingRef.current) {
                await new Promise(resolve => setTimeout(resolve, 50))
            }
        }

        const headers = new Headers(init.headers || {})
        const token = accessTokenRef.current

        if (token) {
            // ✅ Optimization: Check expiry locally before wasting a network call
            if (isTokenExpired(token)) {
                const newToken = await getRefreshTokenSingleton()
                if (newToken) {
                    headers.set("Authorization", `Bearer ${newToken}`)
                } else {
                    // Refresh failed, let the request proceed to get natural 401 or fail later
                    headers.set("Authorization", `Bearer ${token}`)
                }
            } else {
                headers.set("Authorization", `Bearer ${token}`)
            }
        }

        // Auto-set Content-Type for JSON
        if (init.body && !headers.has("Content-Type")) {
            headers.set("Content-Type", "application/json")
        }

        let response = await fetch(input, { ...init, headers })

        if (response.status !== 401) {
            return handleAPIResponse<T>(response)
        }

        // Access token expired → refresh
        const newToken = await getRefreshTokenSingleton()

        if (!newToken) {
            await logout()
            throw new Error("Session expired")
        }

        headers.set("Authorization", `Bearer ${newToken}`)
        response = await fetch(input, { ...init, headers })

        return handleAPIResponse<T>(response)
    }


    /* ----------------------------------------
       Restore session on reload
    ---------------------------------------- */

    useEffect(() => {
        const restore = async () => {
            const hasRefreshToken = !!localStorage.getItem("refreshToken")
            if (!hasRefreshToken) {
                setLoading(false)
                return
            }

            const ok = await refreshTokens()
            if (!ok) {
                clearSession()
                setLoading(false)
                return
            }

            // Restore user data
            try {
                // We use manual fetch here to avoid circular dep or issues with fetchWithAuth state
                const token = await getRefreshTokenSingleton()
                if (token) {
                    const res = await fetch("/api/secure/profile", {
                        headers: { Authorization: `Bearer ${token}` }
                    })
                    if (res.ok) {
                        const data = await res.json()
                        setUser(data.user)
                    }
                }
            } catch (error) {
                console.error("Failed to restore user profile:", error)
            }

            setLoading(false)
        }

        restore()
    }, [])

    return (
        <AuthContext.Provider
            value={{
                user,
                accessToken,
                loading,
                mfaRequired,
                mfaSetupRequired,
                login,
                logout,
                verifyMfa,
                refreshTokens,
                fetchWithAuth
            }}
        >
            {children}
        </AuthContext.Provider>
    )
}

/* ----------------------------------------
   Hook
---------------------------------------- */

export const useAuth = () => {
    const ctx = useContext(AuthContext)
    if (!ctx) {
        throw new Error("useAuth must be used within AuthProvider")
    }
    return ctx
}
