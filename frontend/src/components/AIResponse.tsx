// src/components/AIResponse.tsx
import {
  Box,
  Clipboard,
  Flex,
  HStack,
  IconButton,
  Skeleton,
  SkeletonText,
  VStack,
} from "@chakra-ui/react";
import { Tooltip } from "./ui/tooltip";
import { LuCheck, LuCopy } from "react-icons/lu";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import rehypeHighlight from "rehype-highlight";
import type { Message } from "../entities/Message";
import useSessionStore from "../store/sessionStore";
import { useEffect, useMemo, useState } from "react";
import { createMarkdownComponents } from "./MarkdownComponents";
import { motion } from "framer-motion";
import SourcesDisplay from "./SourceDisplay.tsx";

const MotionBox = motion(Box);

const TypingIndicator = () => (
  <Flex gap={2} p={2} align="center" justify="flex-start" minH="24px">
    {[0, 1, 2].map((i) => (
      <Box
        key={i}
        w="8px"
        h="8px"
        bg="brand.500"
        borderRadius="full"
        animation={`pulseBubble 1.4s infinite ease-in-out both`}
        style={{ animationDelay: `${i * 0.16}s` }}
        css={{
          "@keyframes pulseBubble": {
            "0%, 80%, 100%": { transform: "scale(0)", opacity: 0.5 },
            "40%": { transform: "scale(1)", opacity: 1 },
          },
        }}
      />
    ))}
  </Flex>
);

interface Props {
  msg: Message;
  idx: number;
}

const getMessageBox = () => ({
  p: 6,
  borderRadius: "3xl",
  backgroundColor: "bg.panel",
  border: "1px solid",
  borderColor: "border.subtle",
  position: "relative" as const,
  boxShadow: "0 4px 20px -5px rgba(0, 0, 0, 0.05)",
  transition: "all 0.3s ease",
  css: {
    lineHeight: "1.7",
    fontSize: "16px",
    color: "fg.default",
    textRendering: "optimizeLegibility",
  },
});

const getActionButton = () => ({
  color: { base: "brand.700", _dark: "brand.600" },
  borderRadius: "8px",
  transition: "all 0.2s ease",
  _hover: {
    color: { base: "brand.800", _dark: "brand.500" },
    backgroundColor: { base: "brand.50", _dark: "brand.950" },
    transform: "scale(1.05)",
  },
  _active: {
    backgroundColor: { base: "brand.100", _dark: "brand.900" },
    transform: "scale(0.95)",
  },
});

const AIResponse = ({ msg, idx }: Props) => {
  const { messages, isStreaming } = useSessionStore();

  const [displayed, setDisplayed] = useState(msg.content || "");

  const messageBox = getMessageBox();

  const isLastMessage = useMemo(
    () => idx === messages.length - 1,
    [idx, messages.length],
  );
  const isCurrentlyStreaming = useMemo(
    () => msg.isStreaming || (isStreaming && isLastMessage),
    [msg.isStreaming, isStreaming, isLastMessage],
  );

  const cleanContent = useMemo(() => {
    if (!displayed) return "";

    const sourcesRegex = /\n\n📚 \*\*Sources:\*\*\n[\s\S]*$/;
    return displayed.replace(sourcesRegex, "");
  }, [displayed]);

  useEffect(() => {
    // Only update displayed content if there's a significant change
    // This prevents rapid re-renders during streaming
    if (msg.content && msg.content !== displayed) {
      const timeoutId = setTimeout(() => {
        setDisplayed(msg.content || "");
      }, 16); // Throttle updates to ~60fps

      return () => clearTimeout(timeoutId);
    }
  }, [msg.content, displayed]);

  const markdownComponents = createMarkdownComponents(idx, {}, () => {});

  return (
    <Flex
      justify="center"
      align="flex-start"
      w="100%"
      maxW="100%"
      direction="row"
      gap={2}
      bg={"bg.canvas"}
    >
      <Box flex="1" minW={0} maxW="800px" mx="auto">
        <Box>
          <Box {...messageBox}>
            <Box
              className="markdown-content"
              minH={isCurrentlyStreaming ? "60px" : "auto"}
              css={{
                wordBreak: "break-word",
                overflowWrap: "anywhere",
                "& > *:first-child": {
                  marginTop: 0,
                },
                "& > *:last-child": {
                  marginBottom: 0,
                },
              }}
            >
              {cleanContent ? (
                <>
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm, remarkBreaks]}
                    rehypePlugins={[rehypeHighlight]}
                    components={markdownComponents}
                  >
                    {cleanContent}
                  </ReactMarkdown>
                  {isCurrentlyStreaming && (
                    <Box
                      as="span"
                      display="inline-block"
                      w="2px"
                      h="1.2em"
                      bg={{ base: "brand.600", _dark: "brand.500" }}
                      ml="1px"
                      animation="blink 1s infinite"
                      css={{
                        "@keyframes blink": {
                          "0%, 50%": { opacity: 1 },
                          "51%, 100%": { opacity: 0 },
                        },
                      }}
                    />
                  )}
                </>
              ) : isCurrentlyStreaming ? (
                <MotionBox
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <TypingIndicator />
                </MotionBox>
              ) : (
                <VStack align="stretch" gap={3}>
                  <SkeletonText noOfLines={3} gap="4" />
                  <Skeleton height="20px" borderRadius="md" />
                  <Skeleton height="16px" width="80%" borderRadius="md" />
                </VStack>
              )}
            </Box>

            {!isCurrentlyStreaming && (
              <HStack mt={3} gap={1}>
                <Tooltip
                  content="Copy response"
                  positioning={{ placement: "top" }}
                  openDelay={400}
                >
                  <Clipboard.Root value={cleanContent.trimEnd()}>
                    <Clipboard.Trigger asChild>
                      <IconButton
                        size="xs"
                        variant="ghost"
                        bg="transparent"
                        px={2}
                        py={1}
                        color={{ base: "gray.400", _dark: "gray.500" }}
                        _hover={{
                          bg: "transparent",
                          color: { base: "gray.700", _dark: "gray.300" },
                          transform: "scale(1.1)",
                        }}
                        _active={{ transform: "scale(0.95)" }}
                        transition="all 0.15s ease"
                        aria-label="Copy message"
                      >
                        <Clipboard.Indicator
                          copied={<LuCheck color="#22c55e" />}
                        >
                          <LuCopy />
                        </Clipboard.Indicator>
                      </IconButton>
                    </Clipboard.Trigger>
                  </Clipboard.Root>
                </Tooltip>
              </HStack>
            )}
          </Box>

          {!isCurrentlyStreaming && msg.sources && (
            <SourcesDisplay sources={msg.sources} />
          )}
        </Box>
      </Box>
    </Flex>
  );
};

export default AIResponse;
