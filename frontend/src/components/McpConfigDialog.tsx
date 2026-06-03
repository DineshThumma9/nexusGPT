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
  Flex,
} from "@chakra-ui/react";
import React, { useState, useEffect } from "react";
import { getMcpConfig, saveMcpConfig } from "../api/setup-api";
import { toaster } from "./ui/toaster";
import {
  FiSave,
  FiX,
  FiCheck,
  FiAlertTriangle,
  FiCode,
  FiEye,
} from "react-icons/fi";
import type { HighlighterGeneric } from "shiki";

interface Props {
  onClose: () => void;
  onError?: () => void; // called when background save fails so parent can show red indicator
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
  p: { base: 4, md: 6 },
  pb: { base: 2, md: 4 },
};

const dialogBody = {
  p: { base: 4, md: 6 },
  pt: 2,
  color: "fg",
};

const dialogFooter = {
  p: { base: 4, md: 6 },
  pt: { base: 3, md: 4 },
  gap: 3,
};

const getTextareaStyle = (isValid: boolean): React.CSSProperties => ({
  width: "100%",
  height: "350px",
  padding: "16px",
  borderRadius: "12px",
  border: `1px solid ${isValid ? "var(--chakra-colors-border-default)" : "var(--chakra-colors-red-500)"}`,
  backgroundColor: "rgba(0, 0, 0, 0.2)",
  color: "var(--chakra-colors-fg)",
  fontFamily:
    "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
  fontSize: "14px",
  lineHeight: "1.5",
  outline: "none",
  resize: "none",
  transition: "all 0.2s ease",
  boxSizing: "border-box",
});

const PLACEHOLDER_JSON = `[
  {
    "type": "sse",
    "server_url": "",
    "auth_header": "Authorization",
    "api_key": "",
    "version": "1.0",
    "gallery": ""
  }
]`;

export const McpConfigDialog = ({ onClose, onError }: Props) => {
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
      setRawJson(PLACEHOLDER_JSON);
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
    let currentArr: any[] = [];
    try {
      if (rawJson.trim()) {
        const parsed = JSON.parse(rawJson);
        if (Array.isArray(parsed)) {
          currentArr = parsed;
        } else if (typeof parsed === "object" && parsed !== null) {
          // Fallback if they had old object structure
          currentArr = [];
        }
      }
    } catch (e) {
      // Ignore parse failure, we start with empty structure
    }

    const templates: Record<string, any> = {
      "remote-search": {
        type: "sse",
        server_url: "https://mcp.brave.com/sse",
        auth_header: "Authorization",
        api_key: "Bearer YOUR_API_KEY",
        version: "1.0",
        gallery: "",
      },
      "remote-postgres": {
        type: "sse",
        server_url: "https://mcp-sql.yourdomain.com/sse",
        auth_header: "X-Api-Key",
        api_key: "YOUR_API_KEY",
        version: "1.0",
        gallery: "",
      },
      "custom-http": {
        type: "sse",
        server_url: "https://api.example.com/mcp",
        auth_header: "Authorization",
        api_key: "",
        version: "1.0",
        gallery: "",
      },
    };

    currentArr.push(templates[templateName]);
    setRawJson(JSON.stringify(currentArr, null, 2));

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

    // Optimistic UI: immediately close and show success
    const parsedConfig = rawJson.trim() ? JSON.parse(rawJson) : [];
    onClose();
    toaster.create({
      title: "Configuration Saved",
      description: "MCP Server configuration updated successfully.",
      type: "success",
    });

    // Fire API request in the background
    saveMcpConfig(parsedConfig).catch((error: any) => {
      console.error("Failed to save MCP config:", error);
      let errorMsg = "Could not write configuration to disk.";
      if (error.response?.data?.detail) {
        if (Array.isArray(error.response.data.detail)) {
          errorMsg = error.response.data.detail
            .map((e: any) => `${e.loc?.join(".") || "Field"}: ${e.msg}`)
            .join(", ");
        } else {
          errorMsg = String(error.response.data.detail);
        }
      }
      // Signal parent to show red border on the MCP icon
      onError?.();
      toaster.create({
        title: "Save Failed",
        description: errorMsg,
        type: "error",
      });
    });
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
                    fontSize: { base: "lg", md: "2xl" },
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
            </Dialog.Header>

            <Dialog.Body {...dialogBody}>
              <VStack gap={4} align="stretch">
                {/* Custom Tab Switcher */}
                <Flex
                  gap={2}
                  bg="bg.muted"
                  p={1}
                  borderRadius="xl"
                  alignSelf={{ base: "stretch", sm: "flex-start" }}
                  flexDirection={{ base: "column", sm: "row" }}
                >
                  <Button
                    size="sm"
                    variant={activeTab === "edit" ? "solid" : "ghost"}
                    bg={activeTab === "edit" ? "brand.600" : "transparent"}
                    color={activeTab === "edit" ? "white" : "fg.muted"}
                    _hover={{
                      bg: activeTab === "edit" ? "brand.700" : "bg.subtle",
                    }}
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
                    _hover={{
                      bg: activeTab === "preview" ? "brand.700" : "bg.subtle",
                    }}
                    onClick={() => setActiveTab("preview")}
                    borderRadius="lg"
                  >
                    <FiEye style={{ marginRight: "6px" }} /> Live Preview
                  </Button>
                </Flex>

                {activeTab === "edit" ? (
                  <VStack align="stretch" gap={3}>
                    {/* Textarea Editor */}
                    <Box position="relative">
                      {loading ? (
                        <VStack
                          align="stretch"
                          p={4}
                          height="200px"
                          bg="bg.panel"
                          borderRadius="md"
                          borderWidth="1px"
                          borderColor="border.subtle"
                        >
                          <Box
                            height="20px"
                            bg="bg.subtle"
                            borderRadius="sm"
                            width="90%"
                            animation="pulse 2s infinite"
                          />
                          <Box
                            height="20px"
                            bg="bg.subtle"
                            borderRadius="sm"
                            width="70%"
                            animation="pulse 2s infinite"
                          />
                          <Box
                            height="20px"
                            bg="bg.subtle"
                            borderRadius="sm"
                            width="85%"
                            animation="pulse 2s infinite"
                          />
                        </VStack>
                      ) : (
                        <textarea
                          value={rawJson}
                          onChange={(e) => setRawJson(e.target.value)}
                          disabled={loading}
                          style={getTextareaStyle(isValid)}
                          placeholder={PLACEHOLDER_JSON}
                        />
                      )}
                    </Box>

                    {/* Prettifier and validation warning */}
                    <Flex
                      direction={{ base: "column", sm: "row" }}
                      justify="space-between"
                      align={{ base: "flex-start", sm: "center" }}
                      gap={3}
                      width="100%"
                    >
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
                            <FiCheck
                              color="var(--chakra-colors-green-500)"
                              size={14}
                            />
                            <Text
                              fontSize="xs"
                              color="green.500"
                              fontWeight="medium"
                            >
                              Valid JSON
                            </Text>
                          </>
                        ) : (
                          <>
                            <FiAlertTriangle
                              color="var(--chakra-colors-red-500)"
                              size={14}
                            />
                            <Text
                              fontSize="xs"
                              color="red.500"
                              fontWeight="medium"
                              maxW="300px"
                              truncate
                              title={validationError}
                            >
                              {validationError}
                            </Text>
                          </>
                        )}
                      </HStack>
                    </Flex>

                    <Separator borderColor="border.subtle" my={1} />

                    {/* Templates Helper Bar */}
                    <VStack align="stretch" gap={2}>
                      <Text
                        fontSize="xs"
                        fontWeight="semibold"
                        color="fg.muted"
                      >
                        Quick Add Server Templates:
                      </Text>
                      <HStack gap={2} flexWrap="wrap">
                        {[
                          "remote-search",
                          "remote-postgres",
                          "custom-http",
                        ].map((t) => (
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
                    height={{ base: "250px", md: "350px" }}
                    overflowY="auto"
                    borderRadius="12px"
                    border="1px solid"
                    borderColor="border.subtle"
                    bg="rgba(0, 0, 0, 0.3)"
                    p={4}
                  >
                    {rawJson.trim() ? (
                      <CodeBlockAdapterProvider value={shikiAdapter}>
                        <CodeBlock.Root
                          code={rawJson}
                          language="json"
                          size="sm"
                        >
                          <CodeBlock.Content p={0}>
                            <CodeBlock.Code
                              p={0}
                              bg="transparent"
                              border="none"
                            >
                              <CodeBlock.CodeText />
                            </CodeBlock.Code>
                          </CodeBlock.Content>
                        </CodeBlock.Root>
                      </CodeBlockAdapterProvider>
                    ) : (
                      <CodeBlockAdapterProvider value={shikiAdapter}>
                        <CodeBlock.Root
                          code={PLACEHOLDER_JSON}
                          language="json"
                          size="sm"
                        >
                          <CodeBlock.Content p={0}>
                            <CodeBlock.Code
                              p={0}
                              bg="transparent"
                              border="none"
                            >
                              <CodeBlock.CodeText />
                            </CodeBlock.Code>
                          </CodeBlock.Content>
                        </CodeBlock.Root>
                      </CodeBlockAdapterProvider>
                    )}
                  </Box>
                )}
              </VStack>
            </Dialog.Body>

            <Dialog.Footer
              {...dialogFooter}
              flexDirection={{ base: "column", sm: "row" }}
              flexWrap="wrap"
            >
              <Button
                w={{ base: "full", sm: "auto" }}
                variant="ghost"
                color="fg"
                borderRadius="xl"
                _hover={{ bg: "bg.subtle" }}
                onClick={onClose}
              >
                Cancel
              </Button>

              <Button
                w={{ base: "full", sm: "auto" }}
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
