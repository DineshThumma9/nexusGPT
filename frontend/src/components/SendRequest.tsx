import { Send, SquareIcon } from "lucide-react";
import useSessionStore from "../store/sessionStore.ts";
import { v4 } from "uuid";
import type { Message } from "../entities/Message.ts";
import { uploadDocument } from "../api/rag-api.ts";
import useMessage from "../hooks/useMessage.ts";
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
  PromptInputActionAddAttachments,
} from "@/components/ai/prompt-input";

const SendRequest = () => {
  const { sending, setSending, isStreaming } = useSessionStore();
  const { streamMessage, abortStream } = useMessage();
  const {
    addMessage,
    isWaitingForIndexing,
    setIsWaitingForIndexing,
    setPendingMessage,
  } = useSessionStore();

  const handleSendMessage = async (msg: PromptInputMessage) => {
    if (!msg.text.trim() && msg.files.length === 0) return;
    if (sending || isWaitingForIndexing) return;

    const currentSession = useSessionStore.getState().current_session;
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
        await streamMessage(messageContent);
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
        accept="application/pdf,image/*,.txt,.md,.csv"
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
            <PromptInputActionMenu>
              <PromptInputActionMenuTrigger />
              <PromptInputActionMenuContent>
                <PromptInputActionAddAttachments />
              </PromptInputActionMenuContent>
            </PromptInputActionMenu>
          </PromptInputTools>

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
        </PromptInputFooter>
      </PromptInput>
    </div>
  );
};

export default SendRequest;
