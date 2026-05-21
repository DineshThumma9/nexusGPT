import { z } from "zod/v4";

// Source document schema
const SourceDocument = z.object({
  doc_id: z.string(),
  metadata: z.object({
    creation_date: z.string().optional(),
    document_title: z.string().optional(),
    file_name: z.string().optional(),
    file_path: z.string().optional(),
    file_size: z.number().optional(),
    file_type: z.string().optional(),
    last_modified_date: z.string().optional(),
    page_label: z.string().optional(),
  }),
  score: z.number(),
  text: z.string(),
});

const Message = z.object({
  session_id: z.string(),
  message_id: z.string(),
  content: z.string(),
  sender: z.union([z.literal("user"), z.literal("assistant")]),
  timestamp: z.string(),
  files: z.array(z.string()).optional(),
  sessionTitle: z.string().optional(),
  client_id: z.string().optional(),
  updated_at: z.string().optional(),
  isStreaming: z.boolean().optional(),
  isError: z.boolean().optional(),
  sources: z.array(SourceDocument).optional(), // Added sources field
});

export type Message = z.infer<typeof Message>;
export type SourceDocument = z.infer<typeof SourceDocument>;
