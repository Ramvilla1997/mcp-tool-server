import { z } from 'zod';

const envSchema = z.object({
  SANDBOX_ROOT: z.string().min(1).default('./sandbox'),
  MAX_FILE_BYTES: z.coerce.number().int().min(1024).max(5_000_000).default(262_144),
});

export type Config = z.infer<typeof envSchema>;

export function loadConfig(source: NodeJS.ProcessEnv = process.env): Config {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const details = parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ');
    throw new Error(`Invalid configuration: ${details}`);
  }
  return parsed.data;
}
