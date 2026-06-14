import { useEffect, useRef, useState } from "react";
import useSessionStore from "../store/sessionStore.ts";
import { useQuery } from "@tanstack/react-query";
import { getKbStatus } from "../api/rag-api.ts";
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
  ChevronDownIcon,
} from "lucide-react";
import useMessage from "../hooks/useMessage.ts";
import { toast } from "sonner";
import { Button } from "./ui/button";
import { Task, TaskTrigger, TaskContent, TaskItem } from "@/components/ai/task";
import { Shimmer } from "@/components/ai/shimmer";

const getStatusIcon = (status: string, detail: string) => {
  const s = status?.toLowerCase() || "";
  const d = detail?.toLowerCase() || "";
  if (d.includes("repo") || d.includes("github"))
    return <GitBranch size={16} />;
  if (d.includes("analyzing") || d.includes("structure"))
    return <Network size={16} />;
  if (d.includes("parsing") || d.includes("code"))
    return <FileCode size={16} />;
  if (d.includes("uploading") || d.includes("database"))
    return <Database size={16} />;
  if (s.includes("indexing")) return <FileText size={16} />;
  if (s.includes("ready") || d.includes("query"))
    return <CheckCircle size={16} className="text-emerald-500" />;
  if (s.includes("failed") || s.includes("error"))
    return <XCircle size={16} className="text-red-500" />;
  return (
    <div className="animate-spin">
      <Loader2 size={16} />
    </div>
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
        toast.error(data?.detail || "An error occurred during indexing.");
      }
    }
    if (isError) {
      setIsWaitingForIndexing(false);
      setPendingMessage(null);
      toast.error("Could not retrieve ingestion status.");
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
          className="w-full my-4"
        >
          <div className="flex justify-start w-full">
            <div className="w-full bg-card p-6 rounded-3xl border border-border max-w-3xl shadow-sm">
              <div className="flex flex-col md:flex-row items-start md:items-center gap-4 justify-between">
                <div className="flex items-center gap-4">
                  <CheckCircle size={32} className="text-emerald-500" />
                  <div className="flex flex-col items-start gap-1">
                    <div className="text-lg font-semibold text-foreground">
                      Ready for query
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Your Repo {repoName} is indexed and ready!
                    </div>
                  </div>
                </div>
                <Button
                  onClick={() => {
                    setShowGitSuccess(false);
                    setIsWaitingForIndexing(false);
                    if (pendingMessage) {
                      streamMessage(pendingMessage);
                      setPendingMessage(null);
                    }
                  }}
                  className="bg-primary text-primary-foreground px-8 rounded-xl hover:bg-primary/90 transition-all duration-200 hover:-translate-y-px active:translate-y-0"
                >
                  Continue
                </Button>
              </div>
            </div>
          </div>
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
        className={`w-full ${messages.length === 0 ? "mt-16" : "mt-2"}`}
      >
        <div className="flex justify-start w-full px-2 py-2">
          <Task className="w-full max-w-2xl bg-card rounded-xl border border-border shadow-sm">
            <TaskTrigger title={currentStatus} className="p-3 w-full">
              <div className="flex w-full cursor-pointer items-center gap-2 text-muted-foreground text-sm transition-colors hover:text-foreground">
                <div className={isProcessing ? "text-primary" : "text-inherit"}>
                  {getStatusIcon(currentStatus, currentDetail)}
                </div>
                {isProcessing ? (
                  <Shimmer className="text-sm font-medium capitalize">
                    {currentStatus}
                  </Shimmer>
                ) : (
                  <p className="text-sm font-medium capitalize">
                    {currentStatus}
                  </p>
                )}
                <ChevronDownIcon className="size-4 transition-transform group-data-[state=open]:rotate-180 ml-auto" />
              </div>
            </TaskTrigger>
            <TaskContent className="px-3 pb-3">
              <TaskItem className="flex items-center gap-2">
                {isProcessing && (
                  <Loader2 className="size-3 animate-spin text-primary" />
                )}
                <span>{currentDetail}</span>
              </TaskItem>
            </TaskContent>
          </Task>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default RagStatusMessage;
