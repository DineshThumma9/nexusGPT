// src/components/SideBar.tsx
import { motion, AnimatePresence } from "framer-motion";
import { FiChevronLeft, FiChevronRight } from "react-icons/fi";
import { useEffect, useRef, useState } from "react";
import SideBarNav from "./SideBarNav";
import SessionComponent from "./SessionComponent";
import useSessions from "../hooks/useSessions.ts";
import sessionStore from "../store/sessionStore";
import { Button } from "./ui/button";

interface SidebarProps {
  onCollapse?: (collapsed: boolean) => void;
}

export default function Sidebar({ onCollapse }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);

  const sessions = sessionStore((s) => s.sessions);
  const currentSession = sessionStore((s) => s.current_session);
  const isLoading = sessionStore((s) => s.isLoading);
  const sessionHasMore = sessionStore((s) => s.sessionHasMore);
  const isFetchingMore = sessionStore((s) => s.isFetchingMore);
  const sessionNextCursor = sessionStore((s) => s.sessionNextCursor);

  const { getSessions, selectSession, loadMoreSessions } = useSessions();

  // Sentinel ref for IntersectionObserver
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const handleToggle = () => {
    const newCollapsed = !collapsed;
    setCollapsed(newCollapsed);
    onCollapse?.(newCollapsed);
  };

  // Initial load
  useEffect(() => {
    getSessions();
  }, []);

  // Infinite scroll: watch the sentinel
  useEffect(() => {
    if (!sentinelRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && sessionHasMore && !isFetchingMore) {
          loadMoreSessions();
        }
      },
      { threshold: 0.1 },
    );

    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [sessionHasMore, isFetchingMore, loadMoreSessions]);

  const handleSessionSelect = async (sessionId: string) => {
    try {
      await selectSession(sessionId);
    } catch (error) {
      console.error("Failed to select session:", error);
    }
  };

  const renderSessions = () => {
    const sortedSessions = sessions
      .filter((s) => s.session_id !== currentSession)
      .sort((a, b) => {
        const dateA = a.updated_at || a.created_at;
        const dateB = b.updated_at || b.created_at;
        return new Date(dateB).getTime() - new Date(dateA).getTime();
      });

    const current = sessions.find((s) => s.session_id === currentSession);
    const allSessions = current ? [current, ...sortedSessions] : sortedSessions;

    return allSessions.map((session, index) => {
      const sessionId = session.session_id!;
      const isActive = currentSession === sessionId;

      return (
        <motion.div
          key={sessionId}
          initial={{ opacity: 0, x: -10, scale: 0.98 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          transition={{
            duration: 0.3,
            ease: "easeOut",
            delay: Math.min(index * 0.04, 0.4),
          }}
          className="px-1 py-0.5"
        >
          <SessionComponent
            isActive={isActive}
            title={session.title || "New Chat"}
            sessionId={sessionId}
            onSelect={() => handleSessionSelect(sessionId)}
          />
        </motion.div>
      );
    });
  };

  return (
    <div
      className={`transition-all duration-400 ease-[cubic-bezier(0.4,0,0.2,1)] bg-sidebar text-foreground h-screen p-3 overflow-hidden border-r relative ${
        collapsed ? "w-[50px]" : "w-full md:w-[240px]"
      } border-transparent md:border-border/50`}
    >
      <Button
        variant="outline"
        size="icon"
        className={`hidden md:flex mb-4 transition-all duration-150 bg-background border border-border text-muted-foreground hover:text-foreground hover:bg-accent ${
          collapsed ? "w-7 h-7" : "w-10 h-10"
        }`}
        onClick={handleToggle}
        aria-label="Toggle sidebar"
      >
        {collapsed ? <FiChevronRight /> : <FiChevronLeft />}
      </Button>

      <div
        className="flex flex-col items-stretch gap-4"
        style={{ height: "calc(100% - 80px)" }}
      >
        <AnimatePresence mode="wait">
          {!collapsed && (
            <motion.div
              key="sidebar-content"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20, transition: { duration: 0.2 } }}
              transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
              style={{
                display: "flex",
                flexDirection: "column",
                height: "100%",
                gap: "16px",
              }}
            >
              <SideBarNav />

              <div className="flex-1 flex flex-col items-stretch gap-0 overflow-y-auto pr-1">
                {isLoading && sessions.length === 0 && (
                  <div className="p-4">
                    <p className="text-sm text-muted-foreground text-center">
                      Loading sessions...
                    </p>
                  </div>
                )}

                {!isLoading && sessions.length === 0 && (
                  <div className="p-4">
                    <p className="text-sm text-muted-foreground text-center leading-relaxed">
                      No chat sessions yet.
                      <br />
                      Create your first chat!
                    </p>
                  </div>
                )}

                {renderSessions()}

                {/* Infinite scroll sentinel */}
                <div ref={sentinelRef} className="py-1">
                  {isFetchingMore && (
                    <div className="flex justify-center py-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                    </div>
                  )}
                  {!sessionHasMore && sessions.length > 0 && (
                    <p className="text-xs text-muted-foreground text-center py-2">
                      All sessions loaded
                    </p>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
