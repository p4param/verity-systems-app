export const securePaths = {
    "/api/secure/profile": {
        get: {
            tags: ["Secure"],
            summary: "Get current user profile",
            security: [{ bearerAuth: [] }],
            responses: {
                200: {
                    description: "Authenticated user"
                },
                401: {
                    description: "Unauthorized"
                }
            }
        }
    },
    "/api/secure/admin-only": {
        get: {
            tags: ["Secure"],
            summary: "Admin-only endpoint",
            security: [{ bearerAuth: [] }],
            responses: {
                200: {
                    description: "Admin access granted"
                },
                403: {
                    description: "Forbidden"
                }
            }
        }
    }
}
