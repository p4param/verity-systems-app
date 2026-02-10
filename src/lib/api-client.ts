import { APIError } from "./api-error"

export async function handleAPIResponse<T>(res: Response): Promise<T> {
    if (!res.ok) {
        let message = "Request failed"

        try {
            const text = await res.text()
            if (text) {
                const data = JSON.parse(text)
                message = data.message || data.error || message
            }
        } catch {
            // ignore parse errors
        }

        throw new Error(message)
    }

    // 204 No Content
    if (res.status === 204) {
        return null as T
    }

    const text = await res.text()
    if (!text) {
        return null as T
    }

    return JSON.parse(text) as T
}


// export async function handleAPIResponse<T = any>(response: Response): Promise<T> {
//     if (response.ok) {
//         // If empty body (e.g. 204), return null
//         if (response.status === 204) return null as T

//         try {
//             return await response.json()
//         } catch {
//             return {} as T
//         }
//     }

//     let errorMessage = "An unexpected error occurred"
//     let errorCode: string | undefined
//     let errorData: any

//     try {
//         const body = await response.json()
//         errorMessage = body.message || body.error || response.statusText
//         errorCode = body.code
//         errorData = body
//     } catch {
//         // Text body or empty
//         const text = await response.text()
//         if (text) errorMessage = text
//         else errorMessage = response.statusText
//     }

//     throw new APIError(errorMessage, response.status, errorCode, errorData)
// }
