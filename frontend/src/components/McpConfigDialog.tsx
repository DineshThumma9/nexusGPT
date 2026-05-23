"use client";

import {
  Box,
  Button,
  Dialog,
  Field,
  HStack,
  IconButton,
  Portal,
  Text,
  VStack,
  CodeBlock,
  CodeBlockAdapterProvider,
  createShikiAdapter,
  Separator,
} from "@chakra-ui/react";
import { useState, useEffect } from "react";
import { getMcpConfig, saveMcpConfig } from "../api/setup-api";
import { toaster } from "./ui/toaster";
import { FiSave, FiX, FiCheck, FiAlertTriangle, FiCode, FiEye } from "react-icons/fi";
import type { HighlighterGeneric } from "shiki";

interface Props {
  onClose: () => void;
}

const shikiAdapter = createShikiAdapter<HighlighterGeneric<any, any>>({
  async load() {
    const { createHighlighter } = await import("shiki");
    return createHighlighter({
      langs: ["json"],
      themes: ["github-dark", "github-light"],
    });
  },
});

const dialogHeader = {
  p: 6,
  pb: 4,
};

const dialogBody = {
  p: 6,
  pt: 2,
  color: "fg",
};

const dialogFooter = {
  p: 6,
  pt: 4,
  gap: 3,
};

const textareaStyles = {
  width: "100%",
  height: "350px",
  padding: "16px",
  borderRadius: "12px",
  border: "1px solid",
  borderColor: "var(--chakra-colors-border-default)",
  backgroundColor: "rgba(0, 0, 0, 0.2)",
  color: "var(--chakra-colors-fg)",
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
  fontSize: "14px",
  lineHeight: "1.5",
  outline: "none",
  resize: "none" as const,
  transition: "all 0.2s ease",
};

export const McpConfigDialog = ({ onClose }: Props) => {
  const [rawJson, setRawJson] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<"edit" | "preview">("edit");
  
  // Validation states
  const [isValid, setIsValid] = useState(true);
  const [validationError, setValidationError] = useState("");

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    setLoading(true);
    try {
      const data = await getMcpConfig();
      setRawJson(JSON.stringify(data, null, 2));
    } catch (error) {
      console.error("Failed to fetch MCP config:", error);
      toaster.create({
        title: "Error",
        description: "Failed to load MCP server configuration.",
        type: "error",
      });
      // Fallback to empty default structure
      setRawJson(JSON.stringify({ mcpServers: {} }, null, 2));
    } finally {
      setLoading(false);
    }
  };

  // Real-time JSON validation
  useEffect(() => {
    const trimmed = rawJson.trim();
    if (!trimmed) {
      setIsValid(true);
      setValidationError("");
      return;
    }
    try {
      const parsed = JSON.parse(trimmed);
      if (typeof parsed !== "object" || parsed === null) {
        setIsValid(false);
        setValidationError("JSON must be an object");
      } else {
        setIsValid(true);
        setValidationError("");
      }
    } catch (err: any) {
      setIsValid(false);
      setValidationError(err.message || "Invalid JSON syntax");
    }
  }, [rawJson]);

  const handleFormatJson = () => {
    try {
      const parsed = JSON.parse(rawJson);
      setRawJson(JSON.stringify(parsed, null, 2));
      toaster.create({
        title: "Prettified",
        description: "JSON formatted successfully.",
        type: "success",
      });
    } catch (err: any) {
      toaster.create({
        title: "Format Error",
        description: err.message || "Invalid JSON, cannot format.",
        type: "error",
      });
    }
  };

  const handleAddTemplate = (templateName: string) => {
    let currentObj: any = { mcpServers: {} };
    try {
      if (rawJson.trim()) {
        const parsed = JSON.parse(rawJson);
        if (typeof parsed === "object" && parsed !== null) {
          currentObj = parsed;
        }
      }
    } catch (e) {
      // Ignore parse failure, we start with empty structure
    }

    if (!currentObj.mcpServers || typeof currentObj.mcpServers !== "object") {
      currentObj.mcpServers = {};
    }

    const templates: Record<string, any> = {
      sqlite: {
        command: "uvx",
        args: ["mcp-server-sqlite", "--db-path", "./db.sqlite"]
      },
      puppeteer: {
        command: "npx",
        args: ["-y", "@modelcontextprotocol/server-puppeteer"]
      },
      "brave-search": {
        command: "npx",
        args: ["-y", "@modelcontextprotocol/server-brave-search"],
        env: {
          BRAVE_API_KEY: "YOUR_API_KEY_HERE"
        }
      },
      postgres: {
        command: "npx",
        args: ["-y", "@modelcontextprotocol/server-postgres", "postgresql://localhost/mydb"]
      },
      filesystem: {
        command: "npx",
        args: ["-y", "@modelcontextprotocol/server-filesystem", "/path/to/allowed/directory"]
      }
    };

    currentObj.mcpServers[templateName] = templates[templateName];
    setRawJson(JSON.stringify(currentObj, null, 2));
    
    toaster.create({
      title: "Template Added",
      description: `Added ${templateName} server config template.`,
      type: "info",
    });
  };

  const handleSave = async () => {
    if (!isValid) {
      toaster.create({
        title: "Validation Error",
        description: "Cannot save invalid JSON configuration.",
        type: "error",
      });
      return;
    }

    setSaving(true);
    try {
      const parsedConfig = rawJson.trim() ? JSON.parse(rawJson) : { mcpServers: {} };
      await saveMcpConfig(parsedConfig);
      toaster.create({
        title: "Configuration Saved",
        description: "MCP Server configuration updated successfully.",
        type: "success",
      });
      onClose();
    } catch (error: any) {
      console.error("Failed to save MCP config:", error);
      toaster.create({
        title: "Save Failed",
        description: error.response?.data?.detail || "Could not write configuration to disk.",
        type: "error",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog.Root role="alertdialog" open={true} size="lg">
      <Portal>
        <Dialog.Backdrop
          css={{
            backdropFilter: "blur(8px)",
            bg: "blackAlpha.600",
          }}
        />
        <Dialog.Positioner>
          <Dialog.Content
            css={{
              bg: "bg.panel",
              backdropFilter: "blur(24px)",
              border: "1px solid",
              borderColor: "border.subtle",
              borderRadius: "3xl",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
              maxW: "800px",
              w: "90vw",
            }}
          >
            <Dialog.Header {...dialogHeader}>
              <HStack justify="space-between" width="100%">
                <Dialog.Title
                  css={{
                    color: "fg",
                    fontSize: "2xl",
                    fontWeight: "bold",
                  }}
                >
                  MCP Servers Configuration
                </Dialog.Title>
                <IconButton
                  aria-label="Close dialog"
                  onClick={onClose}
                  variant="ghost"
                  borderRadius="full"
                  _hover={{ bg: "bg.subtle" }}
                >
                  <FiX />
                </IconButton>
              </HStack>
              <Text fontSize="xs" color="fg.muted" mt={1}>
                Configure external Model Context Protocol servers loaded by the backend assistant.
              </Text>
            </Dialog.Header>

            <Dialog.Body {...dialogBody}>
              <VStack gap={4} align="stretch">
                {/* Custom Tab Switcher */}
                <HStack gap={2} bg="bg.muted" p={1} borderRadius="xl" self="start">
                  <Button
                    size="sm"
                    variant={activeTab === "edit" ? "solid" : "ghost"}
                    bg={activeTab === "edit" ? "brand.600" : "transparent"}
                    color={activeTab === "edit" ? "white" : "fg.muted"}
                    _hover={{ bg: activeTab === "edit" ? "brand.700" : "bg.subtle" }}
                    onClick={() => setActiveTab("edit")}
                    borderRadius="lg"
                  >
                    <FiCode style={{ marginRight: "6px" }} /> Edit Raw JSON
                  </Button>
                  <Button
                    size="sm"
                    variant={activeTab === "preview" ? "solid" : "ghost"}
                    bg={activeTab === "preview" ? "brand.600" : "transparent"}
                    color={activeTab === "preview" ? "white" : "fg.muted"}
                    _hover={{ bg: activeTab === "preview" ? "brand.700" : "bg.subtle" }}
                    onClick={() => setActiveTab("preview")}
                    borderRadius="lg"
                  >
                    <FiEye style={{ marginRight: "6px" }} /> Live Preview
                  </Button>
                </HStack>

                {activeTab === "edit" ? (
                  <VStack align="stretch" gap={3}>
                    {/* Textarea Editor */}
                    <Box position="relative">
                      <textarea
                        value={rawJson}
                        onChange={(e) => setRawJson(e.target.value)}
                        disabled={loading}
                        style={{
                          ...textareaStyles,
                          borderColor: !isValid ? "var(--chakra-colors-red-500)" : "var(--chakra-colors-border-default)",
                        }}
                        placeholder={`{\n  "mcpServers": {}\n}`}
                      />
                    </Box>

                    {/* Prettifier and validation warning */}
                    <HStack justify="space-between" width="100%">
                      <HStack gap={2}>
                        <Button
                          size="xs"
                          variant="outline"
                          borderColor="border.subtle"
                          _hover={{ bg: "bg.subtle" }}
                          onClick={handleFormatJson}
                          disabled={loading || !rawJson.trim()}
                        >
                          Format JSON
                        </Button>
                      </HStack>

                      {/* Validation Status Indicator */}
                      <HStack gap={1.5}>
                        {isValid ? (
                          <>
                            <FiCheck color="var(--chakra-colors-green-500)" size={14} />
                            <Text fontSize="xs" color="green.500" fontWeight="medium">
                              Valid JSON
                            </Text>
                          </>
                        ) : (
                          <>
                            <FiAlertTriangle color="var(--chakra-colors-red-500)" size={14} />
                            <Text fontSize="xs" color="red.500" fontWeight="medium" maxW="300px" isTruncated title={validationError}>
                              {validationError}
                            </Text>
                          </>
                        )}
                      </HStack>
                    </HStack>

                    <Separator borderColor="border.subtle" my={1} />

                    {/* Templates Helper Bar */}
                    <VStack align="stretch" gap={2}>
                      <Text fontSize="xs" fontWeight="semibold" color="fg.muted">
                        Quick Add Server Templates:
                      </Text>
                      <HStack gap={2} flexWrap="wrap">
                        {["sqlite", "puppeteer", "brave-search", "postgres", "filesystem"].map((t) => (
                          <Button
                            key={t}
                            size="xs"
                            variant="surface"
                            bg="bg.muted"
                            borderColor="border.subtle"
                            _hover={{ bg: "brand.600", color: "white" }}
                            onClick={() => handleAddTemplate(t)}
                            borderRadius="lg"
                          >
                            + {t}
                          </Button>
                        ))}
                      </HStack>
                    </VStack>
                  </VStack>
                ) : (
                  /* Preview Tab using Chakra CodeBlock & Shiki Adapter */
                  <Box
                    height="350px"
                    overflowY="auto"
                    borderRadius="12px"
                    border="1px solid"
                    borderColor="border.subtle"
                    bg="rgba(0, 0, 0, 0.3)"
                    p={4}
                  >
                    {rawJson.trim() ? (
                      <CodeBlockAdapterProvider value={shikiAdapter}>
                        <CodeBlock.Root code={rawJson} language="json" size="sm">
                          <CodeBlock.Content p={0}>
                            <CodeBlock.Code p={0} bg="transparent" border="none">
                              <CodeBlock.CodeText />
                            </CodeBlock.Code>
                          </CodeBlock.Content>
                        </CodeBlock.Root>
                      </CodeBlockAdapterProvider>
                    ) : (
                      <Text fontSize="sm" color="fg.muted" fontStyle="italic">
                        No config contents to preview.
                      </Text>
                    )}
                  </Box>
                )}
              </VStack>
            </Dialog.Body>

            <Dialog.Footer {...dialogFooter}>
              <Button
                variant="ghost"
                color="fg"
                borderRadius="xl"
                _hover={{ bg: "bg.subtle" }}
                onClick={onClose}
              >
                Cancel
              </Button>

              <Button
                bg="brand.600"
                color="white"
                borderRadius="xl"
                _hover={{
                  bg: "brand.700",
                  transform: "translateY(-1px)",
                }}
                _active={{
                  transform: "translateY(0)",
                }}
                onClick={handleSave}
                disabled={!isValid || loading || saving}
                loading={saving}
                loadingText="Saving..."
              >
                <FiSave style={{ marginRight: "6px" }} /> Save Config
              </Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
};
