import { Box, Flex, VStack, Button, Portal } from "@chakra-ui/react";
import { useEffect, useRef, useState } from "react";
import useSessionStore from "../store/sessionStore.ts";
import { useQuery } from "@tanstack/react-query";
import { getKbStatus, getMockKbStatus } from "../api/rag-api.ts";
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
import { toaster } from "./ui/toaster.tsx";
const getStatusIcon = (status: string, detail: string) => {
  const s = status?.toLowerCase() || "";
  const d = detail?.toLowerCase() || "";
  if (d.includes("repo") || d.includes("github"))
    return <GitBranch size={22} />;
  if (d.includes("analyzing") || d.includes("structure"))
    return <Network size={22} />;
  if (d.includes("parsing") || d.includes("code"))
    return <FileCode size={22} />;
  if (d.includes("uploading") || d.includes("database"))
    return <Database size={22} />;
  if (s.includes("indexing")) return <FileText size={22} />;
  if (s.includes("ready") || d.includes("query"))
    return <CheckCircle size={22} color="#10B981" />;
  if (s.includes("failed") || s.includes("error"))
    return <XCircle size={22} color="#EF4444" />;
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
      <Loader2 size={22} />
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
    messages,
  } = useSessionStore();
  const { streamMessage } = useMessage();
  const hasTriggeredReady = useRef(false);
  const [showGitSuccess, setShowGitSuccess] = useState(false);
  const { current_session, sessions } = useSessionStore();

  const { data, isSuccess, isError, error } = useQuery({
    queryKey: ["status", kb_id],
    queryFn: async () => {
      return await getKbStatus(kb_id!);
    },
    enabled: isWaitingForIndexing,
    refetchInterval: isWaitingForIndexing ? 3000 : false,
    refetchIntervalInBackground: false,
  });

  useEffect(() => {
    if (!isWaitingForIndexing) return;

    if (isSuccess && data?.status) {
      const statusLower = data.status.toLowerCase();

      if (statusLower === "ready" && !hasTriggeredReady.current) {
        hasTriggeredReady.current = true;

        const isGit =
          useSessionStore
            .getState()
            .sessions.find(
              (s) =>
                s.session_id === useSessionStore.getState().current_session,
            )?.source_type === "github";

        if (isGit) {
          setShowGitSuccess(true);
        } else {
          setTimeout(() => {
            setIsWaitingForIndexing(false);
            if (pendingMessage) {
              streamMessage(pendingMessage);
              setPendingMessage(null);
            }
          }, 1500);
        }
      } else if (statusLower === "failed" || statusLower === "error") {
        setIsWaitingForIndexing(false);
        setPendingMessage(null);
        toaster.create({
          title: "Ingestion Failed",
          description: data?.detail || "An error occurred during indexing.",
          type: "error",
        });
      }
    }
    if (isError) {
      setIsWaitingForIndexing(false);
      setPendingMessage(null);
      toaster.create({
        title: "Status Check Failed",
        description: "Could not retrieve ingestion status.",
        type: "error",
      });
    }
  }, [
    isSuccess,
    isError,
    data,
    error,
    setIsWaitingForIndexing,
    setPendingMessage,
    // intentionally omitted unstable refs like streamMessage
  ]);

  if (!isWaitingForIndexing && !showGitSuccess) return null;

  if (showGitSuccess) {
    const session = sessions.find((s) => s.session_id === current_session);
    const repoName = session?.title?.replace(" Repo", "") || "Repository";

    return (
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
          style={{ width: "100%", marginTop: "1rem", marginBottom: "1rem" }}
        >
          <Flex justify="flex-start" w="100%">
            <Box
              w="full"
              bg="bg.panel"
              p={6}
              borderRadius="3xl"
              border="1px solid"
              borderColor="border.subtle"
              maxW="3xl"
              boxShadow="sm"
            >
              <Flex
                align={{ base: "flex-start", md: "center" }}
                gap={4}
                justify="space-between"
                direction={{ base: "column", md: "row" }}
              >
                <Flex align="center" gap={4}>
                  <CheckCircle size={32} color="#10B981" />
                  <VStack align="flex-start" gap={1}>
                    <Box fontSize="lg" fontWeight="semibold" color="fg">
                      Ready for query
                    </Box>
                    <Box fontSize="sm" color="fg.muted">
                      Your Repo {repoName} is indexed and ready!
                    </Box>
                  </VStack>
                </Flex>
                <Button
                  bg="brand.600"
                  color="white"
                  size="md"
                  px={8}
                  borderRadius="xl"
                  _hover={{ bg: "brand.700", transform: "translateY(-1px)" }}
                  _active={{ transform: "translateY(0)" }}
                  transition="all 0.2s ease"
                  onClick={() => {
                    setShowGitSuccess(false);
                    setIsWaitingForIndexing(false);
                    if (pendingMessage) {
                      streamMessage(pendingMessage);
                      setPendingMessage(null);
                    }
                  }}
                >
                  Continue
                </Button>
              </Flex>
            </Box>
          </Flex>
        </motion.div>
      </AnimatePresence>
    );
  }

  const currentStatus = data?.status || "Initializing";
  const currentDetail = data?.detail || "Setting up ingestion pipeline...";
  const isProcessing = !["ready", "failed", "error"].includes(
    currentStatus.toLowerCase(),
  );

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
        style={{
          width: "100%",
          marginTop: messages.length === 0 ? "4rem" : "0.5rem",
        }}
      >
        <Flex justify="flex-start" w="100%">
          <Box w="full" bg="transparent" color="fg" px={2} py={4}>
            <Flex align="center" gap={4}>
              <Box color={isProcessing ? "brand.solid" : "inherit"}>
                {getStatusIcon(currentStatus, currentDetail)}
              </Box>
              <VStack align="flex-start" gap={0}>
                <Box
                  fontWeight="500"
                  fontSize="md"
                  textTransform="capitalize"
                  color={isProcessing ? "brand.emphasized" : "fg"}
                >
                  {currentStatus}
                </Box>
                <motion.div
                  animate={
                    isProcessing ? { opacity: [0.5, 1, 0.5] } : { opacity: 1 }
                  }
                  transition={{
                    duration: 2,
                    repeat: isProcessing ? Infinity : 0,
                    ease: "easeInOut",
                  }}
                >
                  <Box fontSize="sm" color="fg.muted">
                    {currentDetail}
                  </Box>
                </motion.div>
              </VStack>
            </Flex>
          </Box>
        </Flex>
      </motion.div>
    </AnimatePresence>
  );
};

export default RagStatusMessage;
