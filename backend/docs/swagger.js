import fs from "node:fs";

/**
 * Rokad Studio OS - OpenAPI 3.0.3 Specification
 * Loads the canonical swagger.json specification so docs and Swagger UI stay synced.
 */
const swaggerJsonUrl = new URL("./swagger.json", import.meta.url);
export const swaggerDocument = JSON.parse(fs.readFileSync(swaggerJsonUrl, "utf8"));

export const swaggerUiOptions = {
  customSiteTitle: "Rokad Studio OS - مستندات API پلتفرم",
  customCss: `
    .topbar { display: none !important; }
    .swagger-ui .info { margin: 20px 0; }
    .swagger-ui .info .title { font-family: system-ui, -apple-system, sans-serif; font-weight: 700; color: #1e293b; }
    .swagger-ui .scheme-container { background: #f8fafc; padding: 15px 0; box-shadow: none; border-bottom: 1px solid #e2e8f0; }
    .swagger-ui .opblock.opblock-post { border-color: #10b981; background: rgba(16, 185, 129, 0.05); }
    .swagger-ui .opblock.opblock-get { border-color: #3b82f6; background: rgba(59, 130, 246, 0.05); }
    .swagger-ui .opblock.opblock-patch { border-color: #f59e0b; background: rgba(245, 158, 11, 0.05); }
    .swagger-ui .opblock.opblock-put { border-color: #8b5cf6; background: rgba(139, 92, 246, 0.05); }
    .swagger-ui .opblock.opblock-delete { border-color: #ef4444; background: rgba(239, 68, 68, 0.05); }
    .swagger-ui .btn.authorize { color: #10b981; border-color: #10b981; }
    .swagger-ui .btn.authorize svg { fill: #10b981; }
  `,
  swaggerOptions: {
    persistAuthorization: true,
    displayRequestDuration: true,
    filter: true,
    docExpansion: "list",
    defaultModelsExpandDepth: 2,
    defaultModelExpandDepth: 2,
  },
};

export default swaggerDocument;
