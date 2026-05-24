import { Box, Flex, VStack } from "@chakra-ui/react";
import { useEffect, useRef, useState } from "react";
import sessionStore from "../store/sessionStore.ts";
import "highlight.js/styles/github-dark.css";
import type { Message } from "../entities/Message.ts";
import EmptyState from "./EmptyState.tsx";
import UserRequest from "./UserRequest.tsx";
import AIResponse from "./AIResponse.tsx";
import { motion, AnimatePresence } from "framer-motion";
import RagStatusMessage from "./RagStatusMessage.tsx";

const Response = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [prevMessageCount, setPrevMessageCount] = useState(0);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const shouldAutoScroll = useRef(true);
  const box = {
    h: "100%",
    w: "full",
    overflowY: "auto" as const,
    overflowX: "hidden" as const,
    bg: "bg.canvas",
    position: "relative" as const,
    scrollBehavior: "smooth" as const,
  };

  const vstack = {
    gap: 6,
    align: "stretch" as const,
    w: "full",
    maxW: "4xl",
    bg: "bg.canvas",
    mx: "auto",
    px: 4,
    py: 8,
  };

  const [isWaitingForIndexing, setIsWaitingForIndexing] = useState(false);

  useEffect(() => {
    const unsubscribe = sessionStore.subscribe((state) => {
      setMessages(state.messages);
      setIsWaitingForIndexing(state.isWaitingForIndexing);
    });

    setMessages(sessionStore.getState().messages);
    setIsWaitingForIndexing(sessionStore.getState().isWaitingForIndexing);
    return unsubscribe;
  }, []);

  // Handle scroll detection
  const handleScroll = () => {
    if (containerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
      const threshold = 100; // pixels from bottom
      const atBottom = scrollTop + clientHeight >= scrollHeight - threshold;
      shouldAutoScroll.current = atBottom;
    }
  };

  // Smart scrolling logic
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Only scroll if:
    // 1. New message was added (not just content update)
    // 2. User is at the bottom or it's the first message
    const newMessageAdded = messages.length > prevMessageCount;
    const shouldScroll =
      newMessageAdded && (shouldAutoScroll.current || messages.length === 1);

    if (shouldScroll) {
      // Use requestAnimationFrame for smoother scrolling
      requestAnimationFrame(() => {
        container.scrollTo({
          top: container.scrollHeight,
          behavior: messages.length === 1 ? "auto" : "smooth",
        });
      });
    }

    setPrevMessageCount(messages.length);
  }, [messages, prevMessageCount]);

  // Add scroll listener
  useEffect(() => {
    const container = containerRef.current;
    if (container) {
      container.addEventListener("scroll", handleScroll, { passive: true });
      return () => container.removeEventListener("scroll", handleScroll);
    }
  }, []);

  return (
    <Box ref={containerRef} {...box}>
      {messages.length === 0 && !isWaitingForIndexing ? (
        <EmptyState />
      ) : (
        <Box w="full" py={6}>
          <VStack {...vstack}>
            <AnimatePresence initial={false}>
              {messages.map((msg, idx) => (
                <motion.div
                  key={msg.message_id || idx}
                  initial={{ opacity: 0, y: 20, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{
                    duration: 0.4,
                    ease: [0.23, 1, 0.32, 1], // Custom bouncy ease
                  }}
                  style={{ width: "100%", maxWidth: "100%" }}
                >
                  <Box w="100%" maxW="100%">
                    {msg.sender === "user" ? (
                      <Flex justify="flex-end" w="100%">
                        <Box w="100%" maxW="100%">
                          <UserRequest msg={msg} />
                        </Box>
                      </Flex>
                    ) : (
                      <Flex justify="flex-start" w="100%">
                        <Box w="100%" maxW="100%">
                          <AIResponse msg={msg} idx={idx} />
                        </Box>
                      </Flex>
                    )}
                  </Box>
                </motion.div>
              ))}
            </AnimatePresence>
            <RagStatusMessage />
          </VStack>
        </Box>
      )}
    </Box>
  );
};

export default Response;
