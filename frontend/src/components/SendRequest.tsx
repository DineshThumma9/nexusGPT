"use client";

import { useState, useEffect } from "react";
import {
  Send,
  SquareIcon,
  ChevronDown,
  Circle,
  Zap,
  PaperclipIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import useSessionStore from "../store/sessionStore.ts";
import useInitStore from "../store/initStore.ts";
import { v4 } from "uuid";
import type { Message } from "../entities/Message.ts";
import { uploadDocument } from "../api/rag-api.ts";
import { getModelContextLimit } from "../api/setup-api.ts";
import useMessage from "../hooks/useMessage.ts";
import useSessions from "../hooks/useSessions.ts";
import { toast } from "sonner";
import {
  PromptInput,
  PromptInputBody,
  PromptInputFooter,
  PromptInputTools,
  PromptInputButton,
  PromptInputActionMenu,
  PromptInputActionMenuTrigger,
  PromptInputActionMenuContent,
  PromptInputAttachments,
  PromptInputAttachment,
  PromptInputSubmit,
  PromptInputTextarea,
  type PromptInputMessage,
  usePromptInputAttachments,
} from "@/components/ai/prompt-input";
import {
  Context,
  ContextTrigger,
  ContextContent,
  ContextContentHeader,
  ContextContentBody,
  ContextContentFooter,
  ContextInputUsage,
  ContextOutputUsage,
  ContextReasoningUsage,
  ContextCacheUsage,
} from "@/components/ai/context";

const AttachmentButton = () => {
  const { openFileDialog } = usePromptInputAttachments();
  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-8 w-8 text-muted-foreground hover:text-foreground"
      onClick={openFileDialog}
      type="button"
    >
      <PaperclipIcon className="size-5" />
    </Button>
  );
};

const SendRequest = () => {
  const [selectedPerformance, setSelectedPerformance] = useState("Medium");
  const [contextLimit, setContextLimit] = useState(128000);
  const { currentModel, currentLLMProvider } = useInitStore();
  const { sending, setSending, isStreaming, tokenUsage } = useSessionStore();
  const { streamMessage, abortStream } = useMessage();
  const { createNewSession } = useSessions();
  const {
    addMessage,
    isWaitingForIndexing,
    setIsWaitingForIndexing,
    setPendingMessage,
  } = useSessionStore();

  useEffect(() => {
    if (currentModel) {
      getModelContextLimit(currentModel)
        .then((limit) => setContextLimit(limit))
        .catch(() => setContextLimit(128000));
    }
  }, [currentModel]);

  const handleSendMessage = async (msg: PromptInputMessage) => {
    if (!msg.text.trim() && msg.files.length === 0) return;
    if (sending || isWaitingForIndexing) return;

    let currentSession = useSessionStore.getState().current_session;
    if (!currentSession) {
      currentSession = await createNewSession();
    }
    if (!currentSession) return;

    const displayCurrentFiles = msg.files.map(
      (f) => f.filename || "attachment",
    );
    const messageContent = msg.text.trim();

    const message: Message = {
      session_id: currentSession,
      message_id: v4(),
      content: messageContent,
      sender: "user",
      timestamp: new Date().toISOString(),
      files: displayCurrentFiles,
    };

    addMessage(message);

    try {
      if (msg.files.length > 0) {
        const nativeFiles = msg.files
          .map((f) => f.file)
          .filter(Boolean) as File[];

        const new_kb_id = v4();
        useSessionStore.getState().setKbId(new_kb_id);
        useSessionStore.getState().setContext("notes");
        useSessionStore.getState().updateSession(currentSession, {
          kb_id: new_kb_id,
          source_type: "pdf",
        });
        setPendingMessage(messageContent);

        // Use native files extracted from FileUIPart
        const res = await uploadDocument(
          nativeFiles,
          currentSession,
          new_kb_id,
        );

        if (res && res.status === 200) {
          setIsWaitingForIndexing(true);
        } else {
          throw new Error("File upload failed.");
        }
      } else {
        await streamMessage(messageContent, selectedPerformance);
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "An unexpected error occurred.",
      );
      setPendingMessage(null);
      setIsWaitingForIndexing(false);
      setSending(false);
    }
  };

  const isBusy = sending || isWaitingForIndexing;

  return (
    <div className="w-full bg-transparent px-3 md:px-6 pb-3 md:pb-4 pt-0 relative z-10 max-w-3xl mx-auto">
      <PromptInput
        onSubmit={handleSendMessage}
        className="border border-border bg-card rounded-2xl overflow-hidden focus-within:ring-1 focus-within:ring-primary shadow-sm transition-all"
        accept="application/pdf,.txt,.md,.csv"
      >
        <PromptInputAttachments>
          {(attachment) => (
            <PromptInputAttachment key={attachment.id} data={attachment} />
          )}
        </PromptInputAttachments>

        <PromptInputBody>
          <PromptInputTextarea
            disabled={isBusy}
            placeholder="Type a message..."
            className="min-h-[44px] max-h-[150px] border-none focus:ring-0 px-3 py-3 disabled:opacity-50 text-base"
          />
        </PromptInputBody>

        <PromptInputFooter className="px-2 pb-2 pt-0">
          <PromptInputTools>
            <AttachmentButton />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs font-medium text-muted-foreground hover:text-foreground"
                >
                  <Zap className="w-4 h-4 mr-2" />
                  {selectedPerformance}
                  <ChevronDown className="w-3 h-3 ml-2 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48">
                <DropdownMenuGroup>
                  <DropdownMenuItem
                    onClick={() => setSelectedPerformance("High")}
                    className="flex items-center justify-between"
                  >
                    High
                    {selectedPerformance === "High" && (
                      <div className="w-1.5 h-1.5 rounded-full bg-green-400 shadow-[0_0_6px_1.5px_rgba(74,222,128,0.6)]" />
                    )}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setSelectedPerformance("Medium")}
                    className="flex items-center justify-between"
                  >
                    Medium
                    {selectedPerformance === "Medium" && (
                      <div className="w-1.5 h-1.5 rounded-full bg-green-400 shadow-[0_0_6px_1.5px_rgba(74,222,128,0.6)]" />
                    )}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setSelectedPerformance("Low")}
                    className="flex items-center justify-between"
                  >
                    Low
                    {selectedPerformance === "Low" && (
                      <div className="w-1.5 h-1.5 rounded-full bg-green-400 shadow-[0_0_6px_1.5px_rgba(74,222,128,0.6)]" />
                    )}
                  </DropdownMenuItem>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </PromptInputTools>

          <div className="flex items-center gap-2">
            <Context
              maxTokens={contextLimit}
              modelId={
                currentModel
                  ? `${currentLLMProvider}:${currentModel}`
                  : "No model selected"
              }
              usage={{
                ...tokenUsage,
                inputTokenDetails: {
                  cacheReadTokens: tokenUsage.cachedInputTokens || 0,
                  cacheWriteTokens: 0,
                  noCacheTokens:
                    (tokenUsage.inputTokens || 0) -
                    (tokenUsage.cachedInputTokens || 0),
                },
                outputTokenDetails: {
                  reasoningTokens: tokenUsage.reasoningTokens || 0,
                  textTokens:
                    (tokenUsage.outputTokens || 0) -
                    (tokenUsage.reasoningTokens || 0),
                },
              }}
              usedTokens={tokenUsage.totalTokens}
            >
              <ContextTrigger />
              <ContextContent>
                <ContextContentHeader />
                <ContextContentBody>
                  <ContextInputUsage />
                  <ContextOutputUsage />
                  <ContextReasoningUsage />
                  <ContextCacheUsage />
                </ContextContentBody>
                <ContextContentFooter />
              </ContextContent>
            </Context>

            {isStreaming ? (
              <PromptInputButton
                onClick={abortStream}
                size="icon-sm"
                variant="default"
                type="button"
              >
                <SquareIcon className="size-4" fill="currentColor" />
              </PromptInputButton>
            ) : (
              <PromptInputSubmit disabled={isBusy || (!isStreaming && isBusy)}>
                <Send className="size-4" />
              </PromptInputSubmit>
            )}
          </div>
        </PromptInputFooter>
      </PromptInput>
    </div>
  );
};

export default SendRequest;
