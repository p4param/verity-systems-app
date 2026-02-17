"use client"

import React, {
    createContext,
    useContext,
    useEffect,
    useRef,
    useState,
    useCallback,
    useMemo
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

    const routerRef = useRef(router)
    useEffect(() => {
        routerRef.current = router
    }, [router])

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
            routerRef.current.push("/login")
        }
    }, [])

    /* ----------------------------------------
       Refresh logic (ROTATING refresh tokens)
    ---------------------------------------- */

    const refreshTokensInternal = useCallback(async (): Promise<string | null> => {
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
    }, [])

    const getRefreshTokenSingleton = useCallback(async (): Promise<string | null> => {
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
    }, [refreshTokensInternal])

    const refreshTokens = useCallback(async (): Promise<boolean> => {
        return !!(await getRefreshTokenSingleton())
    }, [getRefreshTokenSingleton])

    /* ----------------------------------------
       Authenticated fetch helper
    ---------------------------------------- */

    const fetchWithAuth = useCallback(async <T = any>(
        input: RequestInfo | URL,
        init: RequestInit = {}
    ): Promise<T> => {
        if (loadingRef.current) {
            while (loadingRef.current) {
                await new Promise(resolve => setTimeout(resolve, 50))
            }
        }

        const headers = new Headers(init.headers || {})
        const token = accessTokenRef.current

        if (token) {
            if (isTokenExpired(token)) {
                const newToken = await getRefreshTokenSingleton()
                if (newToken) {
                    headers.set("Authorization", `Bearer ${newToken}`)
                } else {
                    headers.set("Authorization", `Bearer ${token}`)
                }
            } else {
                headers.set("Authorization", `Bearer ${token}`)
            }
        }

        if (init.body && !headers.has("Content-Type") && !(init.body instanceof FormData)) {
            headers.set("Content-Type", "application/json")
        }

        let response = await fetch(input, { ...init, headers })

        if (response.status !== 401) {
            return handleAPIResponse<T>(response)
        }

        const newToken = await getRefreshTokenSingleton()

        if (!newToken) {
            await logout()
            throw new Error("Session expired")
        }

        headers.set("Authorization", `Bearer ${newToken}`)
        response = await fetch(input, { ...init, headers })

        return handleAPIResponse<T>(response)
    }, [logout, getRefreshTokenSingleton])


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

            const newToken = await getRefreshTokenSingleton()
            if (!newToken) {
                clearSession()
                setLoading(false)
                return
            }

            try {
                const res = await fetch("/api/secure/profile", {
                    headers: { Authorization: `Bearer ${newToken}` }
                })
                if (res.ok) {
                    const data = await res.json()
                    setUser(data.user)
                }
            } catch (error) {
                console.error("Failed to restore user profile:", error)
            }

            setLoading(false)
        }

        restore()
    }, [])

    const contextValue = useMemo(() => ({
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
    }), [user, accessToken, loading, mfaRequired, mfaSetupRequired, login, logout, verifyMfa, refreshTokens, fetchWithAuth])

    return (
        <AuthContext.Provider value={contextValue}>
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
