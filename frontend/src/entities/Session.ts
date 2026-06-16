import { z } from "zod/v4";

const Session = z.object({
  session_id: z.string(),
  title: z.string().default("New Chat"),
  kb_id: z.string().nullable().optional(),
  source_type: z.string().nullable().optional(),
  input_tokens: z.number().default(0).optional(),
  output_tokens: z.number().default(0).optional(),
  total_tokens: z.number().default(0).optional(),
  cached_input_tokens: z.number().default(0).optional(),
  reasoning_tokens: z.number().default(0).optional(),
  created_at: z.string().default(() => new Date().toISOString()),
  updated_at: z.string().optional(),
});

export type Session = z.infer<typeof Session>;
export default Session;
