import { v4, v4 as uuidv4 } from "uuid";
import useAuthStore from "../store/authStore.ts";
import useSessionStore from "../store/sessionStore.ts";
import { z } from "zod/v4";
import { useEffect, useRef } from "react";
import useSessions from "./useSessions.ts";
import { toaster } from "../components/ui/toaster";

const docSchema = z.object({
  doc_id: z.string().uuid(),
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

type Doc = z.infer<typeof docSchema>;

const API_BASE_URL = import.meta.env.VITE_API_URI;

const useMessage = () => {
  const eventSourceRef = useRef<EventSource | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const abortStream = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    setStreaming(false);
    useSessionStore.getState().setSending(false);
  };

  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }

      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    };
  }, []);

  const { changeTitle } = useSessions();

  const store = useSessionStore.getState();
  const {
    addMessage,
    current_session,
    setTitle,
    messages,
    setStreaming,
    updateMessage,
    context,
    files,
  } = store;

  async function streamMessage(userMsg: string): Promise<void> {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort(); // cancel any previous stream
    }
    abortControllerRef.current = new AbortController(); // new controller for this stream

    const token = useAuthStore.getState().accessToken;
    const assistantMsgId = uuidv4();
    const session_id = useSessionStore.getState().current_session;

    const isFirst = messages.length == 0;
    if (!session_id) {
      throw new Error("No session ID provided");
    } // Add empty assistant message to start streaming
    addMessage({
      message_id: assistantMsgId,
      session_id: session_id,
      content: "",
      sender: "assistant",
      timestamp: new Date().toISOString(),
    });

    setStreaming(true);

    // Keep accumulated content in local variable
    let accumulatedContent = "";
    let sources: Doc[] = [];
    let isStreamComplete = false;

    // BEFORE streaming
    const kb_id = useSessionStore.getState().kb_id;

    // Log them
    const displayCurrentFiles = [];
    for (const file of files) {
      displayCurrentFiles.push(file.name);
    }
    try {
      // Close any existing connection
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }

      const response = await fetch(`${API_BASE_URL}/messages/simple-stream`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: JSON.stringify({
          session_id: session_id,
          msg: userMsg,
          isFirst: isFirst,
          files: displayCurrentFiles,
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        const status = response.status;

        let title = "Streaming Error";
        let message = errorText;

        try {
          const data = JSON.parse(errorText);
          if (status === 422) {
            title = "Validation Error";
            message = "Please check your message.";
            if (data?.detail && Array.isArray(data.detail)) {
              message = data.detail.map((err: any) => err.msg).join(", ");
            } else if (typeof data?.detail === "string") {
              message = data.detail;
            }
          } else if (status === 429) {
            title = "Too Many Requests";
            message =
              data?.detail ||
              "You've hit the rate limit. Please wait a moment before trying again.";
          } else if (status === 413) {
            title = "File Too Large";
            message =
              data?.detail ||
              "The file you attached exceeds the maximum allowed size.";
          } else if (status === 402) {
            title = "Payment Required";
            message =
              data?.detail ||
              "You have exceeded your quota or need to update your payment details.";
          }
        } catch (e) {
          // If it's not JSON, stick to defaults
        }

        if ([422, 429, 413, 402].includes(status)) {
          toaster.create({
            title,
            description: message,
            type: "error",
            duration: 5000,
          });
        }

        console.error("Error response:", errorText);
        throw new Error(`HTTP error! status: ${status}, message: ${errorText}`);
      }

      if (!response.body) {
        throw new Error("No response body for streaming");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      try {
        while (true) {
          const { done, value } = await reader.read();

          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          buffer += chunk;

          // Process complete lines
          const lines = buffer.split("\n");
          buffer = lines.pop() || ""; // Keep incomplete line in buffer

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const data = JSON.parse(line.slice(6));

                switch (data.type) {
                  case "start":
                    break;

                  case "token":
                    if (data.content && !isStreamComplete) {
                      accumulatedContent += data.content;
                      // Update message with streaming content
                      updateMessage(assistantMsgId, {
                        content: accumulatedContent,
                        isStreaming: true,
                      });
                    }
                    break;

                  case "sources": {
                    const sourcesData = data.content;
                    const parsed = sourcesData
                      .map((source: unknown) => docSchema.safeParse(source))
                      .filter(
                        (res: {
                          success: boolean;
                        }): res is z.ZodSafeParseSuccess<Doc> => res.success,
                      )
                      .map((res: { data: never }) => res.data);

                    if (parsed.length > 0) {
                      // Sort by score (highest first)
                      sources = parsed.sort(
                        (a: { score: number }, b: { score: number }) =>
                          b.score - a.score,
                      ); // Don't update the message content here, just store sources
                      // The sources will be displayed separately in the UI
                    } else {
                      console.warn(
                        "No valid source documents found in 'sources' payload.",
                      );
                    }

                    break;
                  }

                  case "done":
                    isStreamComplete = true;

                    // Final update with complete content and sources
                    updateMessage(assistantMsgId, {
                      content: data.content,
                      isStreaming: false,
                      sources: sources.length > 0 ? sources : undefined,
                    });
                    break;

                  case "title": {
                    setTitle(data.content);
                    await changeTitle(current_session || v4(), data.content);
                    break;
                  }

                  case "abort": {
                    isStreamComplete = true;
                    break;
                  }

                  case "error":
                    console.error("Stream error:", data.content);

                    let errorBubbleMessage =
                      "An unexpected error occurred during generation.";

                    // Parse common LLM provider errors (like Gemini 429) out of the raw LangChain error string
                    const errorStr = String(data.content);

                    if (
                      errorStr.includes("429") ||
                      errorStr.includes("Too Many Requests") ||
                      errorStr.includes("RESOURCE_EXHAUSTED")
                    ) {
                      errorBubbleMessage =
                        "Rate limit exceeded. Please wait a moment before sending another message.";
                      toaster.create({
                        title: "Too Many Requests",
                        description:
                          "You have exceeded your AI provider's rate limit or quota.",
                        type: "error",
                        duration: 5000,
                      });
                    } else if (
                      errorStr.includes("401") ||
                      errorStr.includes("authentication") ||
                      errorStr.includes("Unauthorized")
                    ) {
                      errorBubbleMessage =
                        "Authentication failed with the AI provider. Please check your API keys.";
                      toaster.create({
                        title: "Authentication Failed",
                        description: "Please check your AI provider API keys.",
                        type: "error",
                        duration: 5000,
                      });
                    } else if (
                      errorStr.includes("402") ||
                      errorStr.includes("Payment Required")
                    ) {
                      errorBubbleMessage =
                        "Payment is required by the AI provider. You may have exceeded your quota or need to update your billing details.";
                      toaster.create({
                        title: "Payment Required",
                        description:
                          "You have exceeded your quota or need to update your payment details.",
                        type: "error",
                        duration: 5000,
                      });
                    } else if (
                      errorStr.includes("413") ||
                      errorStr.includes("Payload Too Large")
                    ) {
                      errorBubbleMessage =
                        "The request or attachment was too large for the AI provider to process.";
                      toaster.create({
                        title: "Payload Too Large",
                        description: "The request or attachment was too large.",
                        type: "error",
                        duration: 5000,
                      });
                    } else if (
                      errorStr.includes("400") ||
                      errorStr.includes("Bad Request") ||
                      errorStr.includes("does not support") ||
                      errorStr.includes("tool calling")
                    ) {
                      errorBubbleMessage =
                        "The selected model does not support the required features (such as tool calling). Please select a different model.";
                      toaster.create({
                        title: "Model Not Supported",
                        description: "Please select a different AI model.",
                        type: "error",
                        duration: 5000,
                      });
                    } else {
                      // Fallback for other errors, try to keep it somewhat clean
                      errorBubbleMessage = `[Error: ${errorStr.substring(0, 150)}${errorStr.length > 150 ? "..." : ""}]`;
                      toaster.create({
                        title: "Streaming Error",
                        description:
                          "The AI provider encountered an error while generating the response.",
                        type: "error",
                        duration: 5000,
                      });
                    }

                    updateMessage(assistantMsgId, {
                      content: errorBubbleMessage,
                      isStreaming: false,
                    });
                    isStreamComplete = true;
                    break;
                }
              } catch (parseError) {
                console.error("Parse error:", parseError, "Line:", line);
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
      }
    } catch (err) {
      console.error("StreamMessage error:", err);
      let content = "[Error streaming response]";
      if (err == "AbortError") {
        content = "[Interuptted Streaming]";
      }
      updateMessage(assistantMsgId, {
        content: content,
        isStreaming: false,
      });
    } finally {
      setStreaming(false);
    }
  }

  return {
    streamMessage,
    abortStream,
  };
};

export default useMessage;
