// src/components/ChatArea.tsx
import { Box, HStack, VStack, IconButton, Collapsible } from "@chakra-ui/react";
import { FiMenu, FiCpu } from "react-icons/fi";
import LLMModelChooser from "./LLMModelChooser";
import AvaterExpandable from "./AvaterExpandable";
import SendRequest from "./SendRequest";
import Response from "./Response";
import { useEffect, useRef, useState } from "react";
import sessionStore from "../store/sessionStore.ts";

interface ChatAreaProps {
  onOpenSidebar?: () => void;
}

const ChatArea = ({ onOpenSidebar }: ChatAreaProps) => {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [modelChooserOpen, setModelChooserOpen] = useState(false);

  useEffect(() => {
    const unsubscribe = sessionStore.subscribe(() => {
      // Message updates handled by Response component
    });
    return unsubscribe;
  }, []);

  const chatAreaVstack = {
    flex: "1",
    gap: "0",
    h: "100vh",
    bg: "bg.canvas",
    overflow: "hidden",
    position: "relative",
  };

  const Hstackprops = {
    justifyContent: "space-between",
    alignItems: "center",
    position: "absolute",
    top: 0,
    w: "full",
    bg: "transparent",
    zIndex: 100,
    px: { base: 2, md: 6 },
    pt: { base: 2, md: 2 },
  };

  return (
    <VStack {...chatAreaVstack}>
      <HStack {...Hstackprops}>
        <HStack gap={1} minW={0} flex="1" overflow="hidden">
          {/* Hamburger — mobile only */}
          <IconButton
            aria-label="Open sidebar"
            onClick={onOpenSidebar}
            display={{ base: "flex", md: "none" }}
            variant="ghost"
            size="sm"
            flexShrink={0}
          >
            <FiMenu />
          </IconButton>

          {/* Model chooser toggle — mobile only */}
          <Collapsible.Root
            open={modelChooserOpen}
            onOpenChange={(e) => setModelChooserOpen(e.open)}
            display={{ base: "block", md: "none" }}
          >
            <Collapsible.Trigger asChild>
              <IconButton
                aria-label="Toggle model chooser"
                variant={modelChooserOpen ? "solid" : "ghost"}
                size="sm"
                flexShrink={0}
              >
                <FiCpu />
              </IconButton>
            </Collapsible.Trigger>
          </Collapsible.Root>

          {/* Model chooser — desktop only */}
          <Box display={{ base: "none", md: "block" }} minW={0}>
            <LLMModelChooser />
          </Box>
        </HStack>

        <AvaterExpandable />
      </HStack>

      {/* Mobile model chooser collapsible content - rendered absolutely below header */}
      <Collapsible.Root open={modelChooserOpen} display={{ base: "block", md: "none" }}>
        <Collapsible.Content
          style={{
            position: "absolute",
            top: "50px",
            left: "8px",
            right: "8px",
            zIndex: 99,
          }}
        >
          <Box
            bg="bg.canvas"
            p={2}
            borderRadius="xl"
            border="1px solid"
            borderColor="border.subtle"
            boxShadow="md"
          >
            <LLMModelChooser />
          </Box>
        </Collapsible.Content>
      </Collapsible.Root>

      <Response />

      <SendRequest />

      <div ref={scrollRef}></div>
    </VStack>
  );
};

export default ChatArea;
