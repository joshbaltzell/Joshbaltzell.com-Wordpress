import { Queue } from "bullmq";
import IORedis from "ioredis";

let _connection: IORedis | null = null;

function getRedisConnection() {
  if (!_connection) {
    _connection = new IORedis(process.env.REDIS_URL!, {
      maxRetriesPerRequest: null,
    });
  }
  // Cast needed: bullmq bundles its own ioredis types that conflict with the top-level ioredis
  return _connection as unknown as import("bullmq").ConnectionOptions;
}

/** Queue for processing answers (follow-ups, cross-poll, saturation) */
export const answerProcessingQueue = new Queue("answer-processing", {
  connection: getRedisConnection(),
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 2000 },
    removeOnComplete: { count: 1000 },
    removeOnFail: { count: 500 },
  },
});

/** Queue for sending questions via Slack */
export const questionSendingQueue = new Queue("question-sending", {
  connection: getRedisConnection(),
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 2000 },
    removeOnComplete: { count: 1000 },
    removeOnFail: { count: 500 },
  },
});

/** Queue for nudge/reminder messages */
export const nudgeQueue = new Queue("nudge", {
  connection: getRedisConnection(),
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: "exponential", delay: 5000 },
    removeOnComplete: { count: 500 },
    removeOnFail: { count: 200 },
  },
});

/** Queue for draft compilation */
export const compilationQueue = new Queue("compilation", {
  connection: getRedisConnection(),
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: "exponential", delay: 10000 },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 50 },
  },
});

/** Job type definitions */
export interface AnswerProcessingJob {
  exchangeId: string;
  projectId: string;
  participantId: string;
}

export interface QuestionSendingJob {
  exchangeId: string;
  participantId: string;
  delayMinutes?: number;
}

export interface NudgeJob {
  participantId: string;
  exchangeId: string;
  projectId: string;
}

export interface CompilationJob {
  projectId: string;
  triggeredBy: string; // editor slack user ID, or "deadline" for auto-compile
}
