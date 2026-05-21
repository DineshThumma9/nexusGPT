import {
  Box,
  HStack,
  IconButton,
  Textarea,
  Skeleton,
  VStack,
  Flex,
} from "@chakra-ui/react";
import {
  PauseIcon,
  Send,
  Loader2,
  Database,
  FileCode,
  GitBranch,
  Network,
  CheckCircle,
  FileText,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import useSessionStore from "../store/sessionStore.ts";
import { v4 } from "uuid";
import type { Message } from "../entities/Message.ts";
import MediaPDF from "./MediaPDF.tsx";
import { uploadDocument } from "../api/rag-api.ts";
import useMessage from "../hooks/useMessage.ts";
import { toaster } from "./ui/toaster.tsx";
import { useQuery } from "@tanstack/react-query";
import { API_BASE_URL } from "../api/apiInstance.ts";
import { motion, AnimatePresence } from "framer-motion";

const MotionBox = motion(Box);
const MotionFlex = motion(Flex);

const TypingIndicator = () => (
  <Flex gap={2} p={4} align="center" justify="flex-start" minH="24px">
    {[0, 1, 2].map((i) => (
      <Box
        key={i}
        w="8px"
        h="8px"
        bg="brand.500"
        borderRadius="full"
        animation={`pulseBubble 1.4s infinite ease-in-out both`}
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
);

const getStatusIcon = (status: string) => {
  const s = status.toLowerCase();
  if (s.includes("fetching repo")) return <GitBranch size={18} />;
  if (s.includes("analyzing structure")) return <Network size={18} />;
  if (s.includes("parsing code chunks")) return <FileCode size={18} />;
  if (s.includes("uploading to databases")) return <Database size={18} />;
  if (s.includes("indexing")) return <FileText size={18} />;
  if (s.includes("ready")) return <CheckCircle size={18} color="green" />;
  return (
    <Box
      animation="spin 2s linear infinite"
      css={{
        "@keyframes spin": {
          "0%": { transform: "rotate(0deg)" },
          "100%": { transform: "rotate(360deg)" },
        },
      }}
    >
      <Loader2 size={18} />
    </Box>
  );
};

const RagStatusIndicator = ({ status }: { status: string }) => {
  return (
    <MotionFlex
      initial={{ opacity: 0, y: 10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.95 }}
      transition={{ duration: 0.3 }}
      align="center"
      gap={3}
      px={5}
      py={2.5}
      mb={3}
      mx="auto"
      maxW="fit-content"
      bg={{ base: "white", _dark: "rgba(20, 20, 20, 0.85)" }}
      backdropFilter="blur(24px)"
      border="1px solid"
      borderColor={{ base: "gray.200", _dark: "whiteAlpha.200" }}
      borderRadius="full"
      boxShadow="0 10px 30px -10px rgba(0, 0, 0, 0.2)"
      color="fg.default"
    >
      <Box color="brand.500">{getStatusIcon(status)}</Box>
      <Box
        fontSize="sm"
        fontWeight="600"
        textTransform="capitalize"
        color="fg.default"
      >
        {status}
      </Box>
    </MotionFlex>
  );
};

const box = () => ({
  w: "full",
  bg: "transparent",
  p: 4,
  position: "relative" as const,
});

const hstack = () => ({
  alignItems: "flex-end",
  borderColor: "glass.border",
  borderRadius: "3xl",
  px: 6,
  py: 4,
  gap: 4,
  bg: "glass.bg",
  backdropFilter: "blur(24px)",
  border: "1px solid",
  boxShadow: "0 20px 50px -20px rgba(0, 0, 0, 0.15)",
  _focusWithin: {
    borderColor: "brand.500",
    boxShadow:
      "0 0 0 1px token(colors.brand.500), 0 20px 60px -20px rgba(0, 0, 0, 0.2)",
  },
  transition: "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
  maxW: "5xl",
  mx: "auto",
  mb: 4,
});

const txtarea = () => ({
  resize: "none" as const,
  minH: "20px", // Single line height
  maxH: "120px", // Allow more growth but still limited
  h: "20px", // Start with single line
  color: "fg",
  border: "none",
  px: 0,
  py: 0,
  lineHeight: "20px", // Consistent line height
  placeholder: "Type your message...",
  fontSize: "sm",
  bg: "transparent",
  background: "transparent", // Explicit override
  backgroundImage: "none", // Override any gradients
  backgroundAttachment: "initial",
  backgroundClip: "initial",
  backgroundColor: "transparent",
  overflowY: "hidden", // Hide scrollbar until needed
  _placeholder: {
    color: "fg.muted",
    fontSize: "sm",
  },
  _focus: {
    boxShadow: "none",
    outline: "none",
    bg: "transparent",
    background: "transparent",
    backgroundImage: "none",
  },
  _disabled: {
    bg: "transparent",
    background: "transparent",
    backgroundImage: "none",
  },
});

interface PollResponse {
  collection_name: string;
  status: string;
}

const SendRequest = () => {
  const [input, setInput] = useState("");
  const { sending, setSending, isStreaming } = useSessionStore();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { streamMessage, abortStream } = useMessage();
  const { addMessage, files, setFiles, kb_id, context, current_session } =
    useSessionStore();

  const [isWaitingForIndexing, setIsWaitingForIndexing] = useState(false);
  const pendingMessageRef = useRef<string | null>(null);
  const hasShownReadyToaster = useRef(false);
  const loadingToastId = useRef<string | null>(null);

  const { data, isSuccess, isError, error } = useQuery<PollResponse, Error>({
    queryKey: ["status", kb_id],
    queryFn: async () => {
      const res = await fetch(`${API_BASE_URL}/rag/status?kb_id=${kb_id}`);
      if (!res.ok) throw new Error("Failed to fetch status");
      return res.json();
    },
    enabled: isWaitingForIndexing,
    refetchInterval: isWaitingForIndexing ? 3000 : false,
    refetchIntervalInBackground: false,
  });

  useEffect(() => {
    if (isSuccess && data?.status) {
      const statusLower = data.status.toLowerCase();

      if (statusLower === "ready" && !hasShownReadyToaster.current) {
        hasShownReadyToaster.current = true;
        setIsWaitingForIndexing(false);

        if (loadingToastId.current) {
          toaster.dismiss(loadingToastId.current);
          loadingToastId.current = null;
        }

        toaster.create({
          title: "Files Ready",
          description: "Your documents have been processed successfully!",
          type: "success",
        });

        if (pendingMessageRef.current) {
          streamMessage(pendingMessageRef.current);
          pendingMessageRef.current = null;
        }
      } else if (
        statusLower.includes("fail") ||
        statusLower.includes("error")
      ) {
        setIsWaitingForIndexing(false);
        if (loadingToastId.current) {
          toaster.dismiss(loadingToastId.current);
          loadingToastId.current = null;
        }
        toaster.create({
          title: "Processing Failed",
          description: data.status,
          type: "error",
        });
        pendingMessageRef.current = null;
        setSending(false);
      }
    }
  }, [isSuccess, data, streamMessage, setSending]);

  // Auto-resize logic using controlled height
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setInput(value);

    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`;
    }
  };

  useEffect(() => {
    if (!input && textareaRef.current) {
      textareaRef.current.style.height = "40px";
    }
  }, [input]);

  useEffect(() => {
    if (isError) {
      setIsWaitingForIndexing(false);
      pendingMessageRef.current = null;

      if (loadingToastId.current) {
        toaster.dismiss(loadingToastId.current);
        loadingToastId.current = null;
      }

      toaster.create({
        title: "File Processing Error",
        description: error.message,
        type: "error",
      });
    }
  }, [isError, error]);

  const handleSendMessage = async () => {
    if (!input.trim() || sending) return;

    const currentSession = useSessionStore.getState().current_session;
    if (!currentSession) {
      console.error("No session selected.");
      return;
    }

    const displayCurrentFiles = files.map((f) => f.name);
    const currentFiles = [...files];
    const messageContent = input.trim();

    setInput("");
    setFiles([]);

    const fileInput = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    if (fileInput) fileInput.value = "";

    if (textareaRef.current) {
      textareaRef.current.style.height = "20px";
      textareaRef.current.style.overflowY = "hidden";
    }

    const message: Message = {
      session_id: v4(),
      message_id: v4(),
      content: messageContent,
      sender: "user",
      timestamp: new Date().toISOString(),
      files: displayCurrentFiles,
    };

    addMessage(message);

    try {
      if (currentFiles.length > 0) {
        hasShownReadyToaster.current = false;
        const new_kb_id = v4();
        useSessionStore.getState().setKbId(new_kb_id);
        useSessionStore.getState().setContext("notes");
        useSessionStore.getState().updateSession(currentSession, {
          kb_id: new_kb_id,
          source_type: "pdf",
        });
        pendingMessageRef.current = messageContent;

        loadingToastId.current = toaster.create({
          description: "Initializing document ingestion...",
          type: "info",
          closable: true,
          duration: 3000,
        });

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
      console.error("Error:", err);

      if (loadingToastId.current) {
        toaster.dismiss(loadingToastId.current);
        loadingToastId.current = null;
      }

      toaster.create({
        title: "Error",
        description:
          err instanceof Error ? err.message : "An unexpected error occurred.",
        type: "error",
      });
      pendingMessageRef.current = null;
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

  // handleInputChange moved above

  return (
    <Box {...box()}>
      {/* Show beautiful RAG Status Indicator if indexing */}
      <AnimatePresence>
        {isWaitingForIndexing && (
          <RagStatusIndicator status={data?.status || "Initializing..."} />
        )}
      </AnimatePresence>

      {/* Show beautiful typing bubble when we're waiting for initial response */}
      {sending && !isStreaming && !isWaitingForIndexing && (
        <MotionBox
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          px={3}
          pb={2}
          maxW="5xl"
          mx="auto"
        >
          <TypingIndicator />
        </MotionBox>
      )}

      <HStack {...hstack()}>
        <MediaPDF>
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyPress}
            disabled={sending || isWaitingForIndexing}
            {...txtarea()}
            flex="1"
          />
        </MediaPDF>

        <IconButton
          aria-label={isStreaming ? "Stop streaming" : "Send message"}
          onClick={isStreaming ? abortStream : handleSendMessage}
          disabled={
            isStreaming
              ? false
              : !input.trim() || sending || isWaitingForIndexing
          }
          size="sm"
          bg="transparent"
          color={
            isStreaming || (input.trim() && !sending && !isWaitingForIndexing)
              ? { base: "brand.700", _dark: "brand.600" }
              : { base: "gray.400", _dark: "gray.600" }
          }
          borderRadius="md"
          transition="all 0.2s ease"
          _hover={{
            bg:
              isStreaming || (input.trim() && !sending && !isWaitingForIndexing)
                ? { base: "brand.50", _dark: "brand.950" }
                : "transparent",
            transform:
              isStreaming || (input.trim() && !sending)
                ? "scale(1.05)"
                : "none",
            color:
              isStreaming || (input.trim() && !sending && !isWaitingForIndexing)
                ? { base: "brand.800", _dark: "brand.500" }
                : { base: "gray.400", _dark: "gray.600" },
          }}
          _active={{
            bg:
              isStreaming || (input.trim() && !sending && !isWaitingForIndexing)
                ? { base: "brand.100", _dark: "brand.900" }
                : "transparent",
            transform: "scale(0.95)",
          }}
          _disabled={{
            cursor: "not-allowed",
            opacity: 0.5,
            bg: "transparent",
            color: { base: "gray.300", _dark: "gray.700" },
          }}
        >
          {isStreaming ? <PauseIcon size={16} /> : <Send size={16} />}
        </IconButton>
      </HStack>
    </Box>
  );
};

export default SendRequest;
