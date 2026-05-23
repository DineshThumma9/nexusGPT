import { Box, Flex, VStack } from "@chakra-ui/react";
import { useEffect, useRef } from "react";
import useSessionStore from "../store/sessionStore.ts";
import { useQuery } from "@tanstack/react-query";
import { API_BASE_URL } from "../api/apiInstance.ts";
import { motion, AnimatePresence } from "framer-motion";
import {
  Database,
  FileCode,
  GitBranch,
  Network,
  CheckCircle,
  FileText,
  Loader2,
  XCircle,
} from "lucide-react";
import useMessage from "../hooks/useMessage.ts";

const getStatusIcon = (status: string) => {
  const s = status?.toLowerCase() || "";
  if (s.includes("fetching repo")) return <GitBranch size={18} />;
  if (s.includes("analyzing structure")) return <Network size={18} />;
  if (s.includes("parsing code chunks")) return <FileCode size={18} />;
  if (s.includes("uploading to databases")) return <Database size={18} />;
  if (s.includes("indexing")) return <FileText size={18} />;
  if (s.includes("ready")) return <CheckCircle size={18} color="green" />;
  if (s.includes("failed") || s.includes("error"))
    return <XCircle size={18} color="red" />;
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

export const RagStatusMessage = () => {
  const {
    kb_id,
    isWaitingForIndexing,
    setIsWaitingForIndexing,
    pendingMessage,
    setPendingMessage,
  } = useSessionStore();
  const { streamMessage } = useMessage();
  const hasTriggeredReady = useRef(false);

  const { data, isSuccess, isError, error } = useQuery({
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

      if (statusLower === "ready" && !hasTriggeredReady.current) {
        hasTriggeredReady.current = true;
        setTimeout(() => {
          setIsWaitingForIndexing(false);
          if (pendingMessage) {
            streamMessage(pendingMessage);
            setPendingMessage(null);
          }
        }, 1500);
      } else if (statusLower === "failed" || statusLower === "error") {
        setTimeout(() => {
          setIsWaitingForIndexing(false);
          setPendingMessage(null);
        }, 3000);
      }
    }
    if (isError) {
      setTimeout(() => {
        setIsWaitingForIndexing(false);
        setPendingMessage(null);
      }, 3000);
    }
  }, [
    isSuccess,
    isError,
    data,
    error,
    // intentionally omitted unstable refs like streamMessage
  ]);

  if (!isWaitingForIndexing) return null;

  const currentStatus = data?.status || "Initializing";
  const currentDetail = data?.detail || "Setting up ingestion pipeline...";

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
        style={{ width: "100%" }}
      >
        <Flex justify="flex-start" w="100%">
          <Box
            maxW="85%"
            borderRadius="2xl"
            borderTopLeftRadius="sm"
            bg="glass.bg"
            backdropFilter="blur(24px)"
            border="1px solid"
            borderColor="glass.border"
            color="fg"
            p={4}
            boxShadow="0 4px 20px -5px rgba(0, 0, 0, 0.1)"
          >
            <Flex align="center" gap={3}>
              <Box color="brand.500">{getStatusIcon(currentStatus)}</Box>
              <VStack align="flex-start" gap={0}>
                <Box fontWeight="600" fontSize="sm" textTransform="capitalize">
                  {currentStatus}
                </Box>
                <Box fontSize="xs" color="fg.muted">
                  {currentDetail}
                </Box>
              </VStack>
            </Flex>
          </Box>
        </Flex>
      </motion.div>
    </AnimatePresence>
  );
};

export default RagStatusMessage;
