import { openApiSpec } from "./openapi"
import { authPaths } from "./auth-paths"
import { securePaths } from "./secure-paths"

export const swaggerSpec = {
    ...openApiSpec,
    paths: {
        ...authPaths,
        ...securePaths
    }
}
