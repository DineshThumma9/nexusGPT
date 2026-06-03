import { Box, HStack, IconButton, Textarea, Flex } from "@chakra-ui/react";
import { PauseIcon, Send } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import useSessionStore from "../store/sessionStore.ts";
import { v4 } from "uuid";
import type { Message } from "../entities/Message.ts";
import MediaPDF from "./MediaPDF.tsx";
import { uploadDocument } from "../api/rag-api.ts";
import useMessage from "../hooks/useMessage.ts";
import { toaster } from "./ui/toaster.tsx";
import { motion } from "framer-motion";

const MotionBox = motion.create(Box);

// ── outer wrapper: sits at the bottom, transparent, no height-stealing padding ──
const outerBox = {
  w: "full",
  bg: "transparent",
  px: { base: 3, md: 6 },
  pb: { base: 3, md: 4 },
  pt: 0,
  position: "relative" as const,
};

// ── the glass pill that contains everything ──
const pillStyles = {
  alignItems: "flex-end" as const,
  borderRadius: "2xl",
  px: { base: 2, md: 3 },
  py: { base: 1.5, md: 2 },
  gap: { base: 1, md: 2 },
  bg: { base: "rgba(255,255,255,0.72)", _dark: "rgba(10,10,14,0.72)" },
  backdropFilter: "blur(20px)",
  border: "1px solid",
  borderColor: "border.default",
  boxShadow: {
    base: "0 4px 24px -8px rgba(0,0,0,0.10)",
    _dark: "0 4px 24px -8px rgba(0,0,0,0.4)",
  },
  _focusWithin: {
    borderColor: "brand.500",
    boxShadow: "0 0 0 1px token(colors.brand.500)",
  },
  transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
  maxW: "5xl",
  mx: "auto",
};

// ── textarea: single-line start, grows up to ~150px ──
const txtarea = {
  resize: "none" as const,
  minH: "22px",
  maxH: "150px",
  h: "22px",
  color: "fg",
  border: "none",
  px: 0,
  py: 0,
  lineHeight: "22px",
  fontSize: { base: "sm", md: "sm" },
  bg: "transparent",
  backgroundColor: "transparent",
  overflowY: "auto" as const,
  _placeholder: { color: "fg.muted", fontSize: "sm" },
  _focus: { boxShadow: "none", outline: "none", bg: "transparent" },
  _disabled: { bg: "transparent", opacity: 0.5 },
};

const SendRequest = () => {
  const [input, setInput] = useState("");
  const { sending, setSending, isStreaming } = useSessionStore();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { streamMessage, abortStream } = useMessage();
  const {
    addMessage,
    files,
    setFiles,
    current_session,
    isWaitingForIndexing,
    setIsWaitingForIndexing,
    setPendingMessage,
  } = useSessionStore();

  // Auto-resize
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    if (textareaRef.current) {
      textareaRef.current.style.height = "22px";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 150)}px`;
    }
  };

  useEffect(() => {
    if (!input && textareaRef.current) {
      textareaRef.current.style.height = "22px";
    }
  }, [input]);

  const handleSendMessage = async () => {
    if (!input.trim() || sending) return;
    const currentSession = useSessionStore.getState().current_session;
    if (!currentSession) return;

    const displayCurrentFiles = files.map((f) => f.name);
    const currentFiles = [...files];
    const messageContent = input.trim();

    setInput("");
    setFiles([]);
    const fileInput = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    if (fileInput) fileInput.value = "";
    if (textareaRef.current) textareaRef.current.style.height = "22px";

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
      if (currentFiles.length > 0) {
        const new_kb_id = v4();
        useSessionStore.getState().setKbId(new_kb_id);
        useSessionStore.getState().setContext("notes");
        useSessionStore.getState().updateSession(currentSession, {
          kb_id: new_kb_id,
          source_type: "pdf",
        });
        setPendingMessage(messageContent);
        const res = await uploadDocument(
          currentFiles,
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
      toaster.create({
        title: "Error",
        description:
          err instanceof Error ? err.message : "An unexpected error occurred.",
        type: "error",
      });
      setPendingMessage(null);
      setIsWaitingForIndexing(false);
      setSending(false);
    }
  };

  const handleKeyPress = async (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      await handleSendMessage();
    }
  };

  const canSend = input.trim() && !sending && !isWaitingForIndexing;

  return (
    <Box {...outerBox}>
      {/* Typing dots when waiting for first token */}
      {sending && !isStreaming && !isWaitingForIndexing && (
        <MotionBox
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          px={2}
          pb={1}
          maxW="5xl"
          mx="auto"
        >
          <Flex gap={1.5} align="center" py={1}>
            {[0, 1, 2].map((i) => (
              <Box
                key={i}
                w="6px"
                h="6px"
                bg="brand.500"
                borderRadius="full"
                animation="pulseBubble 1.4s infinite ease-in-out both"
                style={{ animationDelay: `${i * 0.16}s` }}
                css={{
                  "@keyframes pulseBubble": {
                    "0%, 80%, 100%": { transform: "scale(0)", opacity: 0.5 },
                    "40%": { transform: "scale(1)", opacity: 1 },
                  },
                }}
              />
            ))}
          </Flex>
        </MotionBox>
      )}

      {/* Glass pill */}
      <HStack {...pillStyles}>
        {/* MediaPDF wraps: file chips (above) + textarea + attach button */}
        <MediaPDF>
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyPress}
            disabled={sending || isWaitingForIndexing}
            {...txtarea}
            flex="1"
          />
        </MediaPDF>

        {/* Send / Stop */}
        <IconButton
          aria-label={isStreaming ? "Stop streaming" : "Send message"}
          onClick={isStreaming ? abortStream : handleSendMessage}
          disabled={isStreaming ? false : !canSend}
          size="xs"
          bg="transparent"
          color={
            isStreaming || canSend
              ? { base: "brand.700", _dark: "brand.600" }
              : { base: "gray.400", _dark: "gray.600" }
          }
          borderRadius="lg"
          transition="all 0.2s ease"
          _hover={{
            bg:
              isStreaming || canSend
                ? { base: "brand.50", _dark: "brand.950" }
                : "transparent",
            transform: isStreaming || canSend ? "scale(1.1)" : "none",
            color:
              isStreaming || canSend
                ? { base: "brand.800", _dark: "brand.500" }
                : { base: "gray.400", _dark: "gray.600" },
          }}
          _active={{ transform: "scale(0.92)" }}
          _disabled={{ cursor: "not-allowed", opacity: 0.4, bg: "transparent" }}
          flexShrink={0}
          mb="2px"
        >
          {isStreaming ? <PauseIcon size={14} /> : <Send size={14} />}
        </IconButton>
      </HStack>
    </Box>
  );
};

export default SendRequest;
