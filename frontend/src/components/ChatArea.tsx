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
  const [modelChooserOpen, setModelChooserOpen] = useState(false);

  useEffect(() => {
    const unsubscribe = sessionStore.subscribe(() => {});
    return unsubscribe;
  }, []);

  // ── header bar: floats over chat, transparent background ──
  const headerStyles = {
    justifyContent: "space-between",
    alignItems: "center",
    position: "absolute" as const,
    top: 0,
    left: 0,
    right: 0,
    bg: "transparent",
    zIndex: 100,
    px: { base: 2, md: 6 },
    pt: { base: 2, md: 2 },
  };

  // ── input bar: floats over chat at the bottom, same treatment as header ──
  const footerStyles = {
    position: "absolute" as const,
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    // No background here — SendRequest itself handles the glass pill
    bg: "transparent",
    pointerEvents: "none" as const, // let clicks pass through the transparent gap
  };

  return (
    <Box
      flex="1"
      h="100vh"
      bg="bg.canvas"
      overflow="hidden"
      position="relative"
    >
      {/* ── Floating header ── */}
      <HStack {...headerStyles}>
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

      {/* Mobile model chooser dropdown */}
      <Collapsible.Root
        open={modelChooserOpen}
        display={{ base: "block", md: "none" }}
      >
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

      {/* ── Messages scroll area — fills full height, padded so content clears header & input ── */}
      <Box h="100%" overflow="hidden">
        <Response />
      </Box>

      {/* ── Floating input — absolutely pinned at bottom, transparent gap visible ── */}
      <Box {...footerStyles}>
        {/* Re-enable pointer events only on the pill itself (handled inside SendRequest) */}
        <Box pointerEvents="auto">
          <SendRequest />
        </Box>
      </Box>
    </Box>
  );
};

export default ChatArea;
