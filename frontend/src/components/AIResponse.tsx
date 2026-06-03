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
  Collapsible,
  Text,
} from "@chakra-ui/react";
import { Tooltip } from "./ui/tooltip";
import { LuCheck, LuCopy } from "react-icons/lu";
import { FiChevronDown, FiCpu } from "react-icons/fi";
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
  px: { base: 5, md: 8 },
  py: 6,
  borderRadius: "3xl",
  backgroundColor: { base: "white", _dark: "#12131a" },
  border: "1px solid",
  borderColor: "border.default",
  position: "relative" as const,
  boxShadow: {
    base: "0 2px 16px -4px rgba(0,0,0,0.06), 0 1px 4px -2px rgba(0,0,0,0.04)",
    _dark: "none",
  },
  transition: "all 0.3s ease",
  css: {
    lineHeight: "1.8",
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

  const { thinkingContent, responseContent, hasThinking } = useMemo(() => {
    if (!displayed)
      return { thinkingContent: "", responseContent: "", hasThinking: false };

    const sourcesRegex = /\n\n📚 \*\*Sources:\*\*\n[\s\S]*$/;
    const cleanStr = displayed.replace(sourcesRegex, "");

    let thinking = "";
    let response = cleanStr;
    let hasThinking = false;

    const thinkStart = cleanStr.indexOf("<thinking>");
    if (thinkStart !== -1) {
      hasThinking = true;
      const thinkEnd = cleanStr.indexOf("</thinking>");
      if (thinkEnd !== -1) {
        thinking = cleanStr.substring(thinkStart + 10, thinkEnd).trim();
        response = cleanStr.substring(thinkEnd + 11).trim();
      } else {
        thinking = cleanStr.substring(thinkStart + 10).trim();
        response = "";
      }
    }

    const respStart = response.indexOf("<response>");
    if (respStart !== -1) {
      const respEnd = response.indexOf("</response>");
      if (respEnd !== -1) {
        response = response.substring(respStart + 10, respEnd).trim();
      } else {
        response = response.substring(respStart + 10).trim();
      }
    }

    return {
      thinkingContent: thinking,
      responseContent: response,
      hasThinking,
    };
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
      <Box flex="1" minW={0} w="100%">
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
              {displayed ? (
                <>
                  {hasThinking && (
                    <Box mb={4}>
                      <Collapsible.Root defaultOpen={isCurrentlyStreaming}>
                        <Collapsible.Trigger asChild>
                          <HStack
                            cursor="pointer"
                            color="fg.muted"
                            fontSize="sm"
                            fontWeight="medium"
                            _hover={{ color: "fg.default" }}
                            transition="color 0.2s"
                            mb={1}
                          >
                            <FiCpu />
                            <Text>Thought Process</Text>
                            <FiChevronDown />
                          </HStack>
                        </Collapsible.Trigger>
                        <Collapsible.Content>
                          <Box
                            pl={4}
                            py={2}
                            borderLeft="2px solid"
                            borderColor="border.subtle"
                            color="fg.muted"
                            fontSize="sm"
                            css={{
                              fontStyle: "italic",
                              whiteSpace: "pre-wrap",
                              wordBreak: "break-word",
                            }}
                          >
                            {thinkingContent}
                          </Box>
                        </Collapsible.Content>
                      </Collapsible.Root>
                    </Box>
                  )}
                  {responseContent && (
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm, remarkBreaks]}
                      rehypePlugins={[rehypeHighlight]}
                      components={markdownComponents}
                    >
                      {responseContent}
                    </ReactMarkdown>
                  )}
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
                  <Clipboard.Root value={responseContent.trimEnd()}>
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
