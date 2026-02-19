// src/db/prisma.ts
import { PrismaClient } from '../generated/prisma/client.js';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
    globalForPrisma.prisma ??
    new PrismaClient({
        log: ['warn', 'error'],
        accelerateUrl: process.env.DATABASE_URL,
    });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
