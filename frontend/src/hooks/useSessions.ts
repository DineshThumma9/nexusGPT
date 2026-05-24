import type Session from "../entities/Session.ts";
import sessionStore from "../store/sessionStore.ts";

import { useEffect, useRef } from "react";
import {
  deleteSession,
  getAllSessions,
  getChatHistory,
  newSession,
  updateSessionTitle,
} from "../api/session-api.ts";
import { z } from "zod/v4";
import { v4 as uuidv4 } from "uuid";

const useSessions = () => {
  const eventSourceRef = useRef<EventSource | null>(null);

  const store = sessionStore.getState();
  const {
    setSessions,
    removeSession,
    addSession,
    clear,
    setCurrentSessionId,
    current_session,
    setTitle,
    setMessages,
    setStreaming,
    setLoading,
    setContext,
    setKbId,
  } = store;

  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  const createNewSession = async () => {
    try {
      // Instant optimistic UI updates
      const newSessionId = uuidv4();
      
      const optimisticSession = {
        session_id: newSessionId,
        title: "New Chat",
        created_at: new Date().toISOString(),
      };

      addSession(optimisticSession);
      setCurrentSessionId(newSessionId);
      setContext("vanilla");
      setKbId(Math.random().toString());
      setTitle("New Chat");
      clear();

      // Fire the API call asynchronously in the background
      newSession(newSessionId).catch((e) => {
        console.error("Failed to persist new session to backend:", e);
      });

      return newSessionId;
    } catch (e) {
      console.error("Error in createNewSession:", e);
      throw e;
    }
  };

  const changeTitle = async (sessionId: string, title: string) => {
    try {
      if (!current_session) throw new Error("No active session.");

      const currentState = sessionStore.getState();
      currentState.updateSession(sessionId, {
        title: title,
        updated_at: new Date().toISOString(),
      });
      setTitle(title);

      // Fire the API call asynchronously in the background
      updateSessionTitle(sessionId, title).catch((e) => {
        console.error("Failed to persist title update to backend:", e);
      });
    } catch (e) {
      console.error("Error updating title", e);
      throw e;
    }
  };

  const getHistory = async (session_id: string) => {
    try {
      setLoading(true);
      const history = await getChatHistory({ session_id });
      setCurrentSessionId(session_id);
      setMessages(history);

      const currentState = sessionStore.getState();
      const session = currentState.sessions.find(
        (s) => (s.session_id || s.session_id) === session_id,
      );
      if (session) {
        setTitle(session.title);
        if (session.kb_id) {
          setKbId(session.kb_id);
          const type = session.source_type;
          if (type === "github") {
            setContext("code");
          } else if (type === "pdf" || type === "notes" || type === "url") {
            setContext("notes");
          } else {
            setContext("vanilla");
          }
        } else {
          setContext("vanilla");
        }
      }
    } catch (e) {
      console.error("Error fetching history", e);
      throw e;
    } finally {
      setLoading(false);
    }
  };

  const deleteSessionById = async (session_id: string) => {
    try {
      // Optimistically remove from UI
      removeSession(session_id);

      if (current_session === session_id) {
        const remainingSessions = sessionStore.getState().sessions;
        if (remainingSessions.length > 0) {
          const latestSession = remainingSessions.sort(
            (a, b) =>
              new Date(b.updated_at || b.created_at).getTime() -
              new Date(a.updated_at || a.created_at).getTime(),
          )[0];
          await getHistory(
            latestSession.session_id || latestSession.session_id!,
          );
        } else {
          setCurrentSessionId(null);
          clear();
          setTitle("");
        }
      }

      // Fire the API call asynchronously in the background
      deleteSession(session_id).catch((e) => {
        console.error("Failed to delete session on backend:", e);
      });
    } catch (e) {
      console.error("Error deleting session", e);
      throw e;
    }
  };

  const getSessions = async () => {
    try {
      setLoading(true);
      type Session = z.infer<typeof Session>;
      const allSessions: Session[] = await getAllSessions();
      setSessions(allSessions);

      const currentState = sessionStore.getState();
      if (!currentState.current_session && allSessions.length > 0) {
        const latestSession = allSessions.sort(
          (a, b) =>
            new Date(b.updated_at || b.created_at).getTime() -
            new Date(a.updated_at || a.created_at).getTime(),
        )[0];
        await getHistory(latestSession.session_id || latestSession.session_id);
      }
    } catch (e) {
      console.error("Error fetching all sessions", e);
      setSessions([]);
    } finally {
      setLoading(false);
    }
  };

  const selectSession = async (session_id: string) => {
    try {
      if (current_session === session_id) {
        return;
      }

      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
        setStreaming(false);
      }

      await getHistory(session_id);
    } catch (e) {
      console.error("Error selecting session", e);
      throw e;
    }
  };

  const fetchAllSessions = getSessions;

  return {
    createNewSession,
    changeTitle,
    getHistory,
    deleteSessionById,
    getSessions,
    fetchAllSessions,
    selectSession,
  };
};

export default useSessions;
