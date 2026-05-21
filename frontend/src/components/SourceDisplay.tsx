import type { SourceDocument } from "../entities/Message.ts";

import { useState } from "react";
import {
  Badge,
  Box,
  Collapsible,
  Flex,
  HStack,
  IconButton,
  Text,
  VStack,
} from "@chakra-ui/react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { ClipboardIconButton } from "./ui/clipboard.tsx";

const getSourcesContainer = () => ({
  mt: 4,
  p: 3,
  borderRadius: "md",
  backgroundColor: { base: "gray.50", _dark: "gray.800" },
  border: "1px solid",
  borderColor: { base: "gray.200", _dark: "gray.700" },
});

const getSourceItem = () => ({
  p: 3,
  mb: 2,
  borderRadius: "sm",
  backgroundColor: { base: "white", _dark: "gray.800" },
  border: "1px solid",
  borderColor: { base: "gray.200", _dark: "gray.700" },
  transition: "all 0.2s",
  _hover: {
    backgroundColor: { base: "gray.50", _dark: "gray.700" },
    borderColor: { base: "gray.300", _dark: "gray.600" },
  },
});

const SourcesDisplay = ({ sources }: { sources: SourceDocument[] }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const sourcesContainer = getSourcesContainer();
  const sourceItem = getSourceItem();

  if (!sources || sources.length === 0) return null;

  return (
    <Box {...sourcesContainer}>
      <Flex justify="space-between" align="center" mb={2}>
        <Text
          fontSize="sm"
          fontWeight="semibold"
          color={{ base: "gray.700", _dark: "gray.300" }}
        >
          📚 Sources ({sources.length})
        </Text>
        <IconButton
          size="sm"
          variant="outline"
          bg={{ base: "white", _dark: "gray.800" }}
          color={{ base: "brand.700", _dark: "brand.600" }}
          borderColor={{ base: "brand.200", _dark: "brand.700" }}
          transition="all 0.2s ease"
          _hover={{
            bg: { base: "brand.50", _dark: "brand.950" },
            color: { base: "brand.800", _dark: "brand.500" },
            borderColor: { base: "brand.400", _dark: "brand.600" },
            transform: "scale(1.05)",
          }}
          _active={{
            bg: { base: "brand.100", _dark: "brand.900" },
            transform: "scale(0.95)",
          }}
          onClick={() => setIsExpanded(!isExpanded)}
          aria-label={isExpanded ? "Collapse sources" : "Expand sources"}
        >
          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </IconButton>
      </Flex>

      <Collapsible.Root open={isExpanded}>
        <Collapsible.Content gap={2}>
          {sources.map((source, index) => (
            <Box key={source.doc_id} {...sourceItem}>
              <Flex justify="space-between" align="flex-start" mb={2}>
                <VStack align="flex-start" gap={1} flex="1">
                  <HStack>
                    <Badge
                      colorScheme="green"
                      variant="subtle"
                      fontSize="xs"
                      color={{ base: "green.700", _dark: "green.300" }}
                      bg={{ base: "green.100", _dark: "green.900" }}
                    >
                      #{index + 1}
                    </Badge>
                    <Text
                      fontSize="sm"
                      fontWeight="medium"
                      color={{ base: "gray.800", _dark: "white" }}
                    >
                      {source.metadata.file_name || "Unknown File"}
                    </Text>
                  </HStack>
                  <HStack
                    fontSize="xs"
                    color={{ base: "gray.600", _dark: "gray.400" }}
                  >
                    <Text>Page: {source.metadata.page_label || "N/A"}</Text>
                    <Text>•</Text>
                    <Text>Relevance: {(source.score * 100).toFixed(1)}%</Text>
                  </HStack>
                </VStack>
                <ClipboardIconButton
                  value={source.text}
                  size="xs"
                  variant="ghost"
                  aria-label="Copy source text"
                  transition="all 0.2s ease"
                  _hover={{
                    bg: { base: "brand.50", _dark: "brand.950" },
                    color: { base: "brand.800", _dark: "brand.500" },
                    transform: "scale(1.05)",
                  }}
                  _active={{
                    bg: { base: "brand.100", _dark: "brand.900" },
                    transform: "scale(0.95)",
                  }}
                />
              </Flex>
              <Text
                fontSize="xs"
                color={{ base: "gray.700", _dark: "gray.300" }}
                lineHeight="1.4"
              >
                {source.text.substring(0, 200)}
                {source.text.length > 200 && "..."}
              </Text>
            </Box>
          ))}
        </Collapsible.Content>
      </Collapsible.Root>
    </Box>
  );
};

export default SourcesDisplay;
