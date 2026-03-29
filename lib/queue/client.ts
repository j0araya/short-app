/**
 * BullMQ Queue client
 *
 * Single Queue instance — used to enqueue jobs from API routes.
 * Redis connection reads from REDIS_URL in .env (defaults to localhost:6379).
 */

import { Queue } from "bullmq";
import IORedis from "ioredis";

export const redisConnection = new IORedis(process.env.REDIS_URL ?? "redis://localhost:6379", {
  maxRetriesPerRequest: null,
});

export const pipelineQueue = new Queue("pipeline", {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 5000 },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 50 },
  },
});
