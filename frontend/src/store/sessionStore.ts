import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Message } from "../entities/Message.ts";
import type { Session } from "../entities/Session.ts";

export type SessionState = {
  current_session: string | null;
  sessions: Session[];
  messages: Message[];
  title: string;
  isLoading: boolean;
  isStreaming: boolean;
  sending: boolean;
  isWaitingForIndexing: boolean;
  indexingStatus: string;
  indexingDetail: string;
  pendingMessage: string | null;
  files: File[];
  shouldStream: boolean;
  context: "code" | "notes" | "vanilla";
  kb_id: string | null;
  // Token tracking state
  tokenUsage: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    cachedInputTokens: number;
    reasoningTokens: number;
  };
  // Pagination state
  sessionNextCursor: string | null;
  sessionHasMore: boolean;
  isFetchingMore: boolean;
  mcpEnabled: boolean;

  setTokenUsage: (usage: Partial<SessionState["tokenUsage"]>) => void;
  setCurrentSessionId: (session: string | null) => void;
  setMessages: (messages: Message[]) => void;
  addMessage: (message: Message) => void;
  setTitle: (title: string) => void;
  updateMessage: (messageId: string, updates: Partial<Message>) => void;
  setSessions: (sessions: Session[]) => void;
  appendSessions: (sessions: Session[]) => void;
  addFiles: (file: File) => void;
  removeFile: (index: number) => void;
  addSession: (session: Session) => void;
  updateSession: (sessionId: string, updates: Partial<Session>) => void;
  removeSession: (sessionId: string) => void;
  setSending: (sending: boolean) => void;
  setLoading: (loading: boolean) => void;
  setStreaming: (streaming: boolean) => void;
  setIsWaitingForIndexing: (waiting: boolean) => void;
  setIndexingState: (status: string, detail: string) => void;
  setPendingMessage: (message: string | null) => void;
  setShouldStream: (streaming: boolean) => void;
  setSessionPagination: (nextCursor: string | null, hasMore: boolean) => void;
  setFetchingMore: (fetching: boolean) => void;
  setMcpEnabled: (enabled: boolean) => void;
  clear: () => void;
  clearFiles: () => void;
  clearFileInput: () => void;
  setContext: (context: "code" | "notes" | "vanilla") => void;
  setKbId: (kb_id: string) => void;
  getSessions: () => Session[];
  clearAllSessions(): void;
  setFiles: (files: File[]) => void;
  addUniqueFiles: (newFiles: File[]) => void;
};

// Helper function to check if two files are identical
const areFilesIdentical = (file1: File, file2: File): boolean => {
  return (
    file1.name === file2.name &&
    file1.size === file2.size &&
    file1.lastModified === file2.lastModified &&
    file1.type === file2.type
  );
};

const useSessionStore = create<SessionState>()(
  persist(
    (set, get) => ({
      current_session: null,
      sessions: [],
      title: "",
      messages: [],
      files: [],
      isLoading: false,
      isStreaming: false,
      shouldStream: false,
      sending: false,
      isWaitingForIndexing: false,
      indexingStatus: "",
      indexingDetail: "",
      pendingMessage: null,
      context: "vanilla",
      kb_id: null,
      tokenUsage: {
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        cachedInputTokens: 0,
        reasoningTokens: 0,
      },
      sessionNextCursor: null,
      sessionHasMore: true,
      isFetchingMore: false,
      mcpEnabled: true,

      setTokenUsage: (usage) =>
        set((state) => {
          const newTokenUsage = { ...state.tokenUsage, ...usage };

          let updatedSessions = state.sessions;
          if (state.current_session) {
            updatedSessions = state.sessions.map((s) =>
              s.session_id === state.current_session
                ? {
                    ...s,
                    input_tokens: newTokenUsage.inputTokens,
                    output_tokens: newTokenUsage.outputTokens,
                    total_tokens: newTokenUsage.totalTokens,
                    cached_input_tokens: newTokenUsage.cachedInputTokens,
                    reasoning_tokens: newTokenUsage.reasoningTokens,
                  }
                : s,
            );
          }

          return {
            tokenUsage: newTokenUsage,
            sessions: updatedSessions,
          };
        }),

      setCurrentSessionId: (session) =>
        set((state) => {
          const selectedSession = state.sessions.find(
            (s) => s.session_id === session,
          );

          return {
            current_session: session,
            isWaitingForIndexing: false,
            indexingStatus: "",
            indexingDetail: "",
            pendingMessage: null,
            kb_id: null,
            tokenUsage: selectedSession
              ? {
                  inputTokens: selectedSession.input_tokens || 0,
                  outputTokens: selectedSession.output_tokens || 0,
                  totalTokens: selectedSession.total_tokens || 0,
                  cachedInputTokens: selectedSession.cached_input_tokens || 0,
                  reasoningTokens: selectedSession.reasoning_tokens || 0,
                }
              : {
                  inputTokens: 0,
                  outputTokens: 0,
                  totalTokens: 0,
                  cachedInputTokens: 0,
                  reasoningTokens: 0,
                },
          };
        }),
      setMessages: (messages) => set({ messages }),
      addMessage: (message) =>
        set((state) => {
          const now = new Date().toISOString();
          const updatedSessions = state.sessions.map((s) =>
            s.session_id === message.session_id ? { ...s, updated_at: now } : s,
          );
          return {
            messages: [...state.messages, message],
            sessions: updatedSessions,
          };
        }),
      setTitle: (title) => set({ title }),
      setSending: (sending: boolean) => set({ sending: sending }),

      updateMessage: (messageId, updates) =>
        set((state) => ({
          messages: state.messages.map((message) =>
            message.message_id === messageId
              ? { ...message, ...updates }
              : message,
          ),
        })),

      // Enhanced file management methods
      addFiles: (file: File) =>
        set((state) => {
          // Check if file already exists
          const exists = state.files.some((existingFile) =>
            areFilesIdentical(existingFile, file),
          );

          if (!exists) {
            return { files: [...state.files, file] };
          }

          return state; // No change if file already exists
        }),

      removeFile: (index: number) =>
        set((state) => ({
          files: state.files.filter((_, i) => i !== index),
        })),

      setFiles: (files: File[]) => {
        // Remove duplicates from the incoming files array
        const uniqueFiles = files.filter(
          (file, index, self) =>
            index === self.findIndex((f) => areFilesIdentical(f, file)),
        );

        set({ files: uniqueFiles });
      },

      addUniqueFiles: (newFiles: File[]) =>
        set((state) => {
          const uniqueNewFiles = newFiles.filter(
            (newFile) =>
              !state.files.some((existingFile) =>
                areFilesIdentical(existingFile, newFile),
              ),
          );

          if (uniqueNewFiles.length > 0) {
            return { files: [...state.files, ...uniqueNewFiles] };
          }

          return state;
        }),

      setContext: (context: "code" | "notes" | "vanilla") =>
        set({ context: context }),
      setKbId: (kb_id: string) => set({ kb_id: kb_id }),

      setSessions: (sessions) => {
        const sorted = [...sessions].sort((a, b) => {
          const dateA = a.updated_at || a.created_at;
          const dateB = b.updated_at || b.created_at;
          return dateA && dateB
            ? new Date(dateB).getTime() - new Date(dateA).getTime()
            : 0;
        });
        set({ sessions: sorted });
      },

      appendSessions: (newSessions) =>
        set((state) => {
          const existingIds = new Set(state.sessions.map((s) => s.session_id));
          const unique = newSessions.filter(
            (s) => !existingIds.has(s.session_id),
          );
          return { sessions: [...state.sessions, ...unique] };
        }),

      setSessionPagination: (nextCursor, hasMore) =>
        set({ sessionNextCursor: nextCursor, sessionHasMore: hasMore }),

      setFetchingMore: (fetching) => set({ isFetchingMore: fetching }),
      setMcpEnabled: (enabled) => set({ mcpEnabled: enabled }),

      clearAllSessions: () =>
        set({
          current_session: null,
          sessions: [],
          title: "",
          messages: [],
          files: [],
          isLoading: false,
          isStreaming: false,
          shouldStream: false,
          sending: false,
          isWaitingForIndexing: false,
          indexingStatus: "",
          indexingDetail: "",
          pendingMessage: null,
          context: "vanilla",
          kb_id: null,
          sessionNextCursor: null,
          sessionHasMore: true,
          isFetchingMore: false,
        }),

      addSession: (session) =>
        set((state) => ({
          sessions: [session, ...state.sessions],
        })),

      updateSession: (sessionId, updates) =>
        set((state) => ({
          sessions: state.sessions.map((session) =>
            session.session_id === sessionId
              ? { ...session, ...updates }
              : session,
          ),
        })),

      removeSession: (sessionId) =>
        set((state) => ({
          sessions: state.sessions.filter((s) => s.session_id !== sessionId),
        })),

      setLoading: (loading) => set({ isLoading: loading }),
      setStreaming: (streaming) => set({ isStreaming: streaming }),
      setIsWaitingForIndexing: (waiting) =>
        set({ isWaitingForIndexing: waiting }),
      setIndexingState: (status, detail) =>
        set({ indexingStatus: status, indexingDetail: detail }),
      setPendingMessage: (message) => set({ pendingMessage: message }),

      clearFiles: () => {
        set({ files: [] });
        // Also clear the HTML input
        const fileInput = document.querySelector(
          'input[type="file"]',
        ) as HTMLInputElement;
        if (fileInput) {
          fileInput.value = "";
        }
      },

      clearFileInput: () => {
        // Clear the actual HTML file input
        const fileInput = document.querySelector(
          'input[type="file"]',
        ) as HTMLInputElement;
        if (fileInput) {
          fileInput.value = "";
        }
      },

      setShouldStream: (shouldStream) => set({ shouldStream: shouldStream }),
      clear: () => set({ messages: [] }),
      getSessions: () => get().sessions,
    }),
    {
      name: "session-persist",
      // Only exclude the files (File objects) from persistence
      // Keep messages with their file names intact
      partialize: (state) => {
        const { files, ...persistedState } = state;
        return {
          ...persistedState,
          files: [], // Only clear the File objects, not the message files
        };
      },
    },
  ),
);

export default useSessionStore;
