import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  SLACK_BOT_TOKEN: z.string().startsWith("xoxb-"),
  SLACK_SIGNING_SECRET: z.string().min(1),
  SLACK_APP_TOKEN: z.string().startsWith("xapp-").optional(),
  GEMINI_API_KEY: z.string().min(1),
  NEXTAUTH_SECRET: z.string().min(1),
  NEXTAUTH_URL: z.string().url(),
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  APP_URL: z.string().url().default("http://localhost:3000"),
  DEFAULT_MAX_ROUNDS: z.coerce.number().default(10),
  DEFAULT_NUDGE_HOURS: z.coerce.number().default(48),
  DEFAULT_APPROVAL_MODE: z
    .enum(["auto", "editor_approves_all", "full_auto"])
    .default("auto"),
});

export type Env = z.infer<typeof envSchema>;

let _env: Env | null = null;

export function getEnv(): Env {
  if (!_env) {
    const result = envSchema.safeParse(process.env);
    if (!result.success) {
      console.error("Invalid environment variables:", result.error.format());
      throw new Error("Invalid environment variables");
    }
    _env = result.data;
  }
  return _env;
}
