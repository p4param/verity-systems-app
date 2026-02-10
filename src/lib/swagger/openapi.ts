export const openApiSpec = {
  openapi: "3.0.3",
  info: {
    title: "DMS API",
    version: "1.0.0",
    description: "Document Management System APIs"
  },
  servers: [
    {
      url: "http://localhost:3000",
      description: "Local"
    }
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT"
      }
    }
  },
  security: [
    {
      bearerAuth: []
    }
  ],
  paths: {}
}
