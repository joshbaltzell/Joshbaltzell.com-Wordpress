import { Worker } from "bullmq";
import IORedis from "ioredis";
import { processAnswer } from "./process-answer";
import { sendNextQuestion } from "./send-question";
import { sendNudge } from "./nudge";
import type {
  AnswerProcessingJob,
  QuestionSendingJob,
  NudgeJob,
  CompilationJob,
} from "./queue";

let _connection: IORedis | null = null;

function getRedisConnection(): IORedis {
  if (!_connection) {
    _connection = new IORedis(process.env.REDIS_URL!, {
      maxRetriesPerRequest: null,
    });
  }
  return _connection;
}

export function startWorkers(): void {
  const connection = getRedisConnection();

  // Answer processing worker
  new Worker<AnswerProcessingJob>(
    "answer-processing",
    async (job) => {
      console.log(`Processing answer: ${job.data.exchangeId}`);
      await processAnswer(job);
    },
    { connection, concurrency: 3 }
  );

  // Question sending worker
  new Worker<QuestionSendingJob>(
    "question-sending",
    async (job) => {
      console.log(`Sending question to participant: ${job.data.participantId}`);
      await sendNextQuestion(job);
    },
    { connection, concurrency: 5 }
  );

  // Nudge worker
  new Worker<NudgeJob>(
    "nudge",
    async (job) => {
      console.log(`Sending nudge for participant: ${job.data.participantId}`);
      await sendNudge(job);
    },
    { connection, concurrency: 2 }
  );

  // Draft compilation worker — handles async compilation (e.g. deadline auto-compile)
  new Worker<CompilationJob>(
    "compilation",
    async (job) => {
      console.log(`Compiling draft for project: ${job.data.projectId} (triggered by: ${job.data.triggeredBy})`);
      try {
        const baseUrl = process.env.APP_URL || "http://localhost:3000";
        const res = await fetch(`${baseUrl}/api/projects/${job.data.projectId}/compile`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(`Compilation failed: ${res.status} — ${body.error || "Unknown error"}`);
        }
        const result = await res.json();
        console.log(`Compilation complete for ${job.data.projectId}: v${result.draft?.version}, ${result.quoteCount} quotes`);
      } catch (err) {
        console.error(`Compilation worker failed for ${job.data.projectId}:`, err);
        throw err; // Let BullMQ retry
      }
    },
    { connection, concurrency: 1 }
  );

  console.log("All workers started");
}
