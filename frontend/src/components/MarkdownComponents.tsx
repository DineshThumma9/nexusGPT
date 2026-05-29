// src/components/MarkdownComponents.tsx

"use client";

import {
  Blockquote,
  Box,
  Code,
  CodeBlock,
  CodeBlockAdapterProvider,
  createShikiAdapter,
  DataList,
  Em,
  IconButton,
  HStack,
  List,
  Table,
  Text,
} from "@chakra-ui/react";
import React from "react";
import type { Components } from "react-markdown";
import type { HighlighterGeneric } from "shiki";

interface CodeComponentProps {
  node?: unknown;
  inline?: boolean;
  className?: string;
  children?: React.ReactNode;
  style?: React.CSSProperties;
  idx: number;
  copiedCodeBlocks: Record<string, boolean>;
  onCodeBlockCopy: (code: string, blockId: string) => void;
}

const shikiAdapter = createShikiAdapter<HighlighterGeneric<any, any>>({
  async load() {
    const { createHighlighter } = await import("shiki");
    return createHighlighter({
      langs: [
        "tsx",
        "json",
        "bash",
        "py",
        "python",
        "jade",
        "java",
        "javascript",
        "kotlin",
        "typescript",
        "c",
        "c++",
        "yml",
        "yaml",
        "shellscript",
        "shell",
        "jsx",
        "json",
        "dotenv",
        "docker",
        "powershell",
      ],
      themes: ["github-dark", "github-light"],
    });
  },
});

const LANG_ALIASES: Record<string, string> = {
  env: "dotenv",
  envfile: "dotenv",
  dotenv: "dotenv",
  sh: "bash",
  zsh: "bash",
  shell: "bash",
  shellscript: "bash",
  py: "python",
  js: "javascript",
  ts: "typescript",
  "c++": "cpp",
  cplusplus: "cpp",
  dockerfile: "docker",
  yml: "yaml",
  ps1: "powershell",
  ps: "powershell",
};

// Languages Shiki actually has loaded (must match the langs array in createHighlighter)
const LOADED_LANGS = new Set([
  "tsx",
  "json",
  "bash",
  "py",
  "python",
  "jade",
  "java",
  "javascript",
  "kotlin",
  "typescript",
  "c",
  "cpp",
  "yml",
  "yaml",
  "shellscript",
  "shell",
  "jsx",
  "dotenv",
  "docker",
  "powershell",
]);

const normalizeLanguage = (lang: string): string => {
  const lower = lang.toLowerCase();
  const aliased = LANG_ALIASES[lower] ?? lower;
  return LOADED_LANGS.has(aliased) ? aliased : ""; // unknown → plain text, no crash
};

const CodeComponent = ({ inline, className, children }: CodeComponentProps) => {
  const match = /language-([\w+]+)/.exec(className || "");

  const getTextContent = (node: React.ReactNode): string => {
    if (typeof node === "string") return node;
    if (typeof node === "number") return String(node);
    if (Array.isArray(node)) return node.map(getTextContent).join("");
    if (React.isValidElement(node)) {
      const props = node.props as any;
      if (props && "children" in props) {
        return getTextContent(props.children as React.ReactNode);
      }
    }
    return String(node || "");
  };

  const codeString = getTextContent(children).replace(/\n$/, "");
  const language = match ? normalizeLanguage(match[1]) : "";

  // ✅ Handle inline code (or language-less block code inside a <pre>)
  if (!language) {
    return (
      <Box
        as="code"
        bg={{ base: "gray.100", _dark: "gray.800" }}
        color="fg"
        px={1.5}
        py={0.5}
        borderRadius="md"
        fontFamily="ui-monospace, SFMono-Regular, 'SF Mono', Monaco, Inconsolata, 'Roboto Mono', monospace"
        fontSize="0.9em"
        display="inline"
        wordBreak="break-word"
      >
        {children}
      </Box>
    );
  }

  return (
    <CodeBlockAdapterProvider value={shikiAdapter}>
      <CodeBlock.Root code={codeString} language={language} size="sm">
        <Box position="relative" className="group">
          <CodeBlock.Content p={0}>
            <CodeBlock.Code
              p={5}
              borderRadius="2xl"
              fontSize="14px"
              bg={{ base: "gray.50", _dark: "rgba(0,0,0,0.3)" }}
              border="1px solid"
              borderColor="border.subtle"
            >
              <CodeBlock.CodeText />
            </CodeBlock.Code>
          </CodeBlock.Content>

          <HStack
            position="absolute"
            top={3}
            right={3}
            gap={2}
            opacity={0}
            _groupHover={{ opacity: 1 }}
            transition="opacity 0.2s"
          >
            <Text
              fontSize="10px"
              fontWeight="700"
              color="fg.muted"
              textTransform="uppercase"
            >
              {language}
            </Text>
            <CodeBlock.CopyTrigger asChild>
              <IconButton
                variant="surface"
                size="xs"
                color="brand.600"
                borderRadius="lg"
                bg="bg.panel"
                boxShadow="sm"
              >
                <CodeBlock.CopyIndicator />
              </IconButton>
            </CodeBlock.CopyTrigger>
          </HStack>
        </Box>
      </CodeBlock.Root>
    </CodeBlockAdapterProvider>
  );
};

export const createMarkdownComponents = (
  idx: number,
  copiedCodeBlocks: Record<string, boolean>,
  onCodeBlockCopy: (code: string, blockId: string) => void,
): Components => ({
  code: (props) => (
    <CodeComponent
      {...props}
      idx={idx}
      copiedCodeBlocks={copiedCodeBlocks}
      onCodeBlockCopy={onCodeBlockCopy}
    />
  ),
  p: ({ children }) => (
    <Text
      fontSize="16px"
      lineHeight="1.7"
      mb={4}
      color={"fg"}
      whiteSpace="pre-wrap"
      overflowWrap="break-word"
      wordBreak="normal"
    >
      {children}
    </Text>
  ),
  h1: ({ children }) => (
    <Text
      as="h1"
      fontSize="24px"
      fontWeight="700"
      mb={5}
      mt={8}
      color={"fg"}
      borderBottom="2px solid"
      borderColor={"colorPalette.500"}
      pb={2}
      lineHeight="1.3"
    >
      {children}
    </Text>
  ),

  h2: ({ children }) => (
    <Text
      as="h2"
      fontSize="20px"
      fontWeight="600"
      mb={4}
      mt={6}
      color={"fg"}
      lineHeight="1.4"
    >
      {children}
    </Text>
  ),
  h3: ({ children }) => (
    <Text
      as="h3"
      fontSize="18px"
      fontWeight="600"
      mb={3}
      mt={5}
      color={"fg"}
      lineHeight="1.4"
    >
      {children}
    </Text>
  ),
  ol: ({ children }) => (
    <List.Root as="ol" mb={4} pl={6} color={"fg"}>
      <Box css={{ "& li": { marginBottom: "4px" } }}>{children}</Box>
    </List.Root>
  ),
  ul: ({ children }) => (
    <List.Root as="ul" mb={4} pl={6} color={"fg"}>
      <Box css={{ "& li": { marginBottom: "4px" } }}>{children}</Box>
    </List.Root>
  ),
  li: ({ children }) => (
    <List.Item
      mb={1}
      color={"fg"}
      lineHeight="1.6"
      overflowWrap="break-word"
      wordBreak="normal"
    >
      {children}
    </List.Item>
  ),
  br: () => <br />,

  blockquote: ({ children }) => (
    <Blockquote.Root
      bg={"bg.muted"}
      borderRadius="md"
      color={"fg.subtle"}
      my={4}
      pl={4}
      pr={4}
      py={3}
      borderLeft="4px solid"
      borderColor={"colorPalette.500"}
      fontSize="16px"
      lineHeight="1.6"
      fontStyle="italic"
    >
      <Blockquote.Content>{children}</Blockquote.Content>
    </Blockquote.Root>
  ),

  strong: ({ children }) => (
    <Text as="strong" fontWeight="600" color={"fg"} display="inline">
      {children}
    </Text>
  ),

  em: ({ children }) => (
    <Em color={"fg"} fontStyle="italic" display="inline">
      {children}
    </Em>
  ),

  a: ({ children, href, ...props }) => (
    <a
      href={href}
      style={{
        color: "colorPalette.500",
        textDecoration: "underline",
        display: "inline",
        cursor: "pointer",
      }}
      target="_blank"
      rel="noopener noreferrer"
      onMouseEnter={(e) => {
        e.currentTarget.style.color = "colorPalette.500";
        e.currentTarget.style.textDecoration = "none";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.color = "colorPalette.500";
        e.currentTarget.style.textDecoration = "underline";
      }}
      {...props}
    >
      {children}
    </a>
  ),

  // strong: ({ children }) => (
  //   <Text as="strong" fontSize={24} color={"fg.subtle"} fontWeight={typography.fontWeight.bold}>
  //     {children}
  //   </Text>
  // ),
  // em: ({ children }) => (
  //   <Em color={"fg.subtle"} fontStyle="italic">
  //     {children}
  //   </Em>
  // ),

  table: ({ children }) => (
    <Table.Root
      size="sm"
      my="lg"
      css={{
        borderRadius: "md",
        overflow: "hidden",
        border: "1px solid",
        borderColor: "border.subtle",
        bg: "bg.panel",
        width: "100%",
      }}
    >
      {children}
    </Table.Root>
  ),

  caption: ({ children }) => (
    <Table.Caption
      color={"fg.subtle"}
      fontSize="sm"
      textAlign="left"
      p="sm"
      bg={"bg.muted"}
    >
      {children}
    </Table.Caption>
  ),
  // span: ({ children }) => (
  //   <Span color={"colorPalette.500"}>
  //     {children}
  //   </Span>
  // ),
  // mark: ({ children }) => (
  //   <Mark bg={themeColors.background.highlight} color={"fg"}>
  //     {children}
  //   </Mark>
  // ),
  dl: ({ children }) => <DataList.Root my="md">{children}</DataList.Root>,
  dt: ({ children }) => (
    <DataList.ItemLabel color={"fg.subtle"} fontWeight="bold">
      {children}
    </DataList.ItemLabel>
  ),
  dd: ({ children }) => (
    <DataList.ItemValue color={"colorPalette.500"} mb="sm">
      {children}
    </DataList.ItemValue>
  ),

  thead: ({ children }) => (
    <Table.Header bg={"bg.muted"} color={"fg.subtle"} fontWeight="bold">
      {children}
    </Table.Header>
  ),

  tbody: ({ children }) => (
    <Table.Body
      css={{
        "& tr:nth-of-type(odd)": { bg: "bg.muted" },
        "& tr:nth-of-type(even)": { bg: "transparent" },
      }}
      color={"colorPalette.500"}
    >
      {children}
    </Table.Body>
  ),

  tfoot: ({ children }) => (
    <Table.Footer bg={"bg.muted"} color="fg.muted">
      {children}
    </Table.Footer>
  ),

  tr: ({ children }) => (
    <Table.Row
      bg="bg.panel"
      _hover={{ bg: "bg.subtle" }}
      borderBottom="1px solid"
      borderColor={"border.subtle"}
    >
      {children}
    </Table.Row>
  ),

  th: ({ children }) => (
    <Table.ColumnHeader
      color={"fg.subtle"}
      fontWeight="bold"
      borderBottom="2px solid"
      borderColor={"colorPalette.500"}
      p="md"
      textAlign="left"
    >
      {children}
    </Table.ColumnHeader>
  ),

  td: ({ children }) => (
    <Table.Cell
      color={"fg"}
      borderBottom="1px solid"
      borderColor={"border.subtle"}
      p="md"
    >
      {children}
    </Table.Cell>
  ),

  colgroup: ({ children }) => <Table.ColumnGroup>{children}</Table.ColumnGroup>,
  col: ({ children }) => <Table.Column>{children}</Table.Column>,
});
