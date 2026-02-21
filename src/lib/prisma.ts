import { PrismaClient } from "@prisma/client";
import { createTenantMiddleware } from "./db/tenant-middleware";

const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma =
    globalForPrisma.prisma ||
    new PrismaClient({
        log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
        datasources: {
            db: {
                url: process.env.DATABASE_URL,
            },
        },
    });

// Register tenant enforcement middleware
// Configuration is read from environment variables (see .env.example)
// Default: DISABLED (safe for production)
// To enable logging: Set TENANT_ENFORCEMENT_ENABLED=true and TENANT_ENFORCEMENT_MODE=log_only
// See: docs/tenant_enforcement_rollout.md for activation plan
prisma.$use(createTenantMiddleware());

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
