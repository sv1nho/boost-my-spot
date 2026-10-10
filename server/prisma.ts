import { createPrismaClient } from './prisma-client.js'
import { env, isProduction, isTest } from './env.js'
import type { PrismaLogLevel } from './prisma-client.js'

const logLevels: PrismaLogLevel[] = isTest ? [] : isProduction ? ['error'] : ['warn', 'error']

export const prisma = createPrismaClient(env.DATABASE_URL, logLevels, env.DATABASE_POOL_MAX)
