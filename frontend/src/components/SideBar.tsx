// src/components/SideBar.tsx
import { Box, Button, Stack, Text, VStack } from "@chakra-ui/react";
import { motion, AnimatePresence } from "framer-motion";
import { FiChevronLeft, FiChevronRight } from "react-icons/fi";
import { useEffect, useState } from "react";
import SideBarNav from "./SideBarNav";
import SessionComponent from "./SessionComponent";
import useSessions from "../hooks/useSessions.ts";
import sessionStore from "../store/sessionStore";
interface SidebarProps {
  onCollapse?: (collapsed: boolean) => void;
}

export default function Sidebar({ onCollapse }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  // ✅ Directly use Zustand selectors
  const sessions = sessionStore((s) => s.sessions);
  const currentSession = sessionStore((s) => s.current_session);
  const isLoading = sessionStore((s) => s.isLoading);

  const { getSessions, selectSession } = useSessions();

  const boxStyles = {
    transition: "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
    bg: "bg.canvas",
    color: "fg.default",
    h: "100vh",
    p: 2,
    overflow: "hidden",
    borderRight: "1px solid",
    borderColor: "border.subtle",
    position: "relative" as const,
  };

  const collapsibleButtonStyles = {
    bg: "glass.bg",
    color: "brand.600",
    border: "1px solid",
    borderColor: "border.subtle",
    _hover: {
      bg: "brand.subtle",
      transform: "scale(1.05)",
      borderColor: "brand.500",
    },
    _active: {
      transform: "scale(0.95)",
    },
    transition: "all 0.2s",
    size: "xs" as const,
    mb: 4,
    borderRadius: "lg",
  };

  const stackStyles = {
    gap: 0,
    align: "stretch" as const,
    overflowY: "auto" as const,
    flex: "1",
    pr: 1,
  };

  const sessionStackStyles = {
    borderRadius: "12px",
    padding: "0px",
    margin: "0",
    transition: "all 0.2s ease",
  };

  const handleToggle = () => {
    const newCollapsed = !collapsed;
    setCollapsed(newCollapsed);
    onCollapse?.(newCollapsed);
  };

  useEffect(() => {
    getSessions(); // ✅ Only run once on mount
  }, []);

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
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );

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
          transition={{ duration: 0.3, ease: "easeOut", delay: index * 0.04 }}
        >
          <Stack
            {...sessionStackStyles}
            bg={isActive ? "brand.subtle" : "transparent"}
            borderRadius="2xl"
            px={2}
            py={1.5}
            border="1px solid"
            borderColor={isActive ? "brand.200" : "transparent"}
            _hover={{
              bg: isActive ? "brand.subtle" : "bg.subtle",
              borderColor: isActive ? "brand.300" : "border.subtle",
            }}
          >
            <SessionComponent
              bg="transparent"
              color={isActive ? "brand.700" : "fg.default"}
              title={session.title || "New Chat"}
              sessionId={sessionId}
              onSelect={() => handleSessionSelect(sessionId)}
            />
          </Stack>
        </motion.div>
      );
    });
  };

  return (
    <Box w={collapsed ? "50px" : "240px"} {...boxStyles}>
      <Button
        width={collapsed ? "28px" : "40px"}
        height={collapsed ? "28px" : "40px"}
        onClick={handleToggle}
        aria-label="Toggle sidebar"
        {...collapsibleButtonStyles}
      >
        {collapsed ? <FiChevronRight /> : <FiChevronLeft />}
      </Button>

      <VStack align="stretch" gap={4} height="calc(100% - 80px)">
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
              }}
            >
              <SideBarNav />

              <VStack {...stackStyles}>
                {isLoading && sessions.length === 0 && (
                  <Box p={4}>
                    <Text fontSize="sm" color="fg.muted" textAlign="center">
                      Loading sessions...
                    </Text>
                  </Box>
                )}

                {!isLoading && sessions.length === 0 && (
                  <Box p={4}>
                    <Text
                      fontSize="sm"
                      color="fg.subtle"
                      textAlign="center"
                      lineHeight="1.6"
                    >
                      No chat sessions yet.
                      <br />
                      Create your first chat!
                    </Text>
                  </Box>
                )}

                {renderSessions()}
              </VStack>
            </motion.div>
          )}
        </AnimatePresence>
      </VStack>
    </Box>
  );
}
