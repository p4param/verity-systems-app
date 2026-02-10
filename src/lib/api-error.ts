export class APIError extends Error {
    public status: number
    public code?: string
    public data?: any

    constructor(message: string, status: number, code?: string, data?: any) {
        super(message)
        this.name = "APIError"
        this.status = status
        this.code = code
        this.data = data
    }
}

export function isAPIError(error: any): error is APIError {
    return error instanceof APIError
}
