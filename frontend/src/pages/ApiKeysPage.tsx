import { useEffect, useState } from "react";
import {
  Box,
  Button,
  Container,
  Heading,
  HStack,
  Input,
  VStack,
  IconButton,
  Spinner,
  Grid,
  GridItem,
} from "@chakra-ui/react";
import {
  BiTrash,
  BiEdit,
  BiPlus,
  BiArrowBack,
  BiCopy,
  BiCheck,
  BiChevronDown,
} from "react-icons/bi";
import { useNavigate } from "react-router-dom";
import { getApiConfigs, setApiProvider } from "../api/setup-api";
import type { ApiConfig } from "../api/setup-api";
import {
  MenuRoot,
  MenuTrigger,
  MenuContent,
  MenuItem,
} from "../components/ui/menu";

// Available providers from the backend constants
const AVAILABLE_PROVIDERS = [
  "GOOGLE GENAI",
  "ANTHROPIC",
  "OPENAI",
  "OLLAMA",
  "MISTRAL",
  "GROQ",
  "OPENROUTER",
  "HUGGING FACE",
];

const ApiKeysPage = () => {
  const navigate = useNavigate();
  const [keys, setKeys] = useState<ApiConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Form state
  const [selectedProvider, setSelectedProvider] = useState("");
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const fetchKeys = async () => {
    try {
      setLoading(true);
      const data = await getApiConfigs();
      setKeys(data);
    } catch (err) {
      console.error("Failed to load API keys:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchKeys();
  }, []);

  const handleSave = async () => {
    if (!selectedProvider) return;
    try {
      setIsSubmitting(true);
      await setApiProvider(selectedProvider, apiKeyInput);
      await fetchKeys();
      // Reset form
      setApiKeyInput("");
      setSelectedProvider("");
      setIsEditing(false);
    } catch (err) {
      console.error("Failed to save key:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (provider: string) => {
    try {
      setLoading(true);
      await setApiProvider(provider, "");
      await fetchKeys();
      if (selectedProvider === provider) {
        setSelectedProvider("");
        setApiKeyInput("");
        setIsEditing(false);
      }
    } catch (err) {
      console.error("Failed to delete key:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (config: ApiConfig) => {
    setSelectedProvider(config.provider);
    setApiKeyInput(config.encrypted_key);
    setIsEditing(true);
  };

  const handleCopy = (provider: string, val: string) => {
    navigator.clipboard.writeText(val);
    setCopiedId(provider);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getUnusedProviders = () => {
    const usedProviders = new Set(keys.map((k) => k.provider));
    return AVAILABLE_PROVIDERS.filter((p) => !usedProviders.has(p));
  };

  // Mask the API key for display
  const maskKey = (key: string) => {
    if (!key) return "Not Set / Empty";
    if (key.length <= 8) return "********";
    return key.substring(0, 4) + "..." + key.substring(key.length - 4);
  };

  return (
    <Box minH="100vh" bg="bg.canvas" py={8} px={{ base: 4, md: 8, lg: 12 }}>
      <Container maxW="7xl" p={0}>
        {/* Header */}
        <HStack
          mb={8}
          justify="space-between"
          align="center"
          borderBottom="1px solid"
          borderColor="border.subtle"
          pb={6}
        >
          <HStack gap={4}>
            <IconButton
              aria-label="Go back"
              variant="ghost"
              onClick={() => navigate(-1)}
              borderRadius="full"
              _hover={{ bg: "bg.subtle" }}
            >
              <BiArrowBack size={20} />
            </IconButton>
            <Box>
              <Heading size="lg" fontWeight="bold" color="fg.default">
                API Keys Dashboard
              </Heading>
              <Box fontSize="sm" color="fg.muted" mt={1}>
                Manage credentials and endpoints for LLM providers securely
              </Box>
            </Box>
          </HStack>
        </HStack>

        {loading ? (
          <HStack justify="center" py={20}>
            <Spinner size="xl" color="brand.600" />
          </HStack>
        ) : (
          <Grid
            templateColumns={{ base: "1fr", lg: "repeat(12, 1fr)" }}
            gap={8}
          >
            {/* Left Side: Keys Grid (8 columns) */}
            <GridItem colSpan={{ base: 12, lg: 8 }}>
              <VStack align="stretch" gap={6}>
                <Box fontSize="lg" fontWeight="semibold" color="fg.default">
                  Active Providers ({keys.length})
                </Box>

                {keys.length === 0 ? (
                  <Box
                    p={12}
                    bg="bg.panel"
                    borderRadius="2xl"
                    border="1px dashed"
                    borderColor="border.default"
                    textAlign="center"
                    backdropFilter="blur(20px)"
                  >
                    <Box fontSize="md" color="fg.muted" mb={4}>
                      No API keys configured yet.
                    </Box>
                    <Box fontSize="sm" color="fg.subtle">
                      Use the form on the right to configure your first provider
                      key.
                    </Box>
                  </Box>
                ) : (
                  <Grid
                    templateColumns={{ base: "1fr", md: "repeat(2, 1fr)" }}
                    gap={6}
                  >
                    {keys.map((config) => (
                      <Box
                        key={config.provider}
                        p={6}
                        bg="bg.panel"
                        borderRadius="2xl"
                        border="1px solid"
                        borderColor="border.subtle"
                        boxShadow="md"
                        backdropFilter="blur(20px)"
                        transition="all 0.3s ease"
                        _hover={{
                          transform: "translateY(-4px)",
                          boxShadow: "lg",
                          borderColor: "brand.500",
                        }}
                      >
                        <VStack align="stretch" gap={4}>
                          <HStack justify="space-between">
                            <Box
                              fontWeight="bold"
                              fontSize="md"
                              color="brand.600"
                              letterSpacing="wider"
                            >
                              {config.provider}
                            </Box>
                            <HStack gap={1}>
                              <IconButton
                                aria-label="Edit Key"
                                variant="ghost"
                                size="sm"
                                borderRadius="lg"
                                onClick={() => handleEdit(config)}
                              >
                                <BiEdit size={16} />
                              </IconButton>
                              <IconButton
                                aria-label="Delete Key"
                                variant="ghost"
                                size="sm"
                                borderRadius="lg"
                                colorPalette="red"
                                color="red.500"
                                onClick={() => handleDelete(config.provider)}
                              >
                                <BiTrash size={16} />
                              </IconButton>
                            </HStack>
                          </HStack>

                          <HStack
                            bg="bg.muted"
                            p={3}
                            borderRadius="xl"
                            border="1px solid"
                            borderColor="border.subtle"
                            justify="space-between"
                            gap={2}
                          >
                            <Box
                              fontFamily="monospace"
                              fontSize="xs"
                              color="fg.default"
                              textOverflow="ellipsis"
                              overflow="hidden"
                              whiteSpace="nowrap"
                            >
                              {maskKey(config.encrypted_key)}
                            </Box>
                            {config.encrypted_key && (
                              <IconButton
                                aria-label="Copy Key"
                                variant="ghost"
                                size="xs"
                                onClick={() =>
                                  handleCopy(
                                    config.provider,
                                    config.encrypted_key,
                                  )
                                }
                              >
                                {copiedId === config.provider ? (
                                  <BiCheck
                                    size={16}
                                    color="var(--chakra-colors-brand-600)"
                                  />
                                ) : (
                                  <BiCopy size={14} />
                                )}
                              </IconButton>
                            )}
                          </HStack>
                        </VStack>
                      </Box>
                    ))}
                  </Grid>
                )}
              </VStack>
            </GridItem>

            {/* Right Side: Add / Update Form (4 columns) */}
            <GridItem colSpan={{ base: 12, lg: 4 }}>
              <Box
                p={6}
                bg="bg.panel"
                borderRadius="2xl"
                border="1px solid"
                borderColor={isEditing ? "brand.500" : "border.subtle"}
                boxShadow="lg"
                backdropFilter="blur(20px)"
                position="sticky"
                top="32px"
              >
                <VStack align="stretch" gap={5}>
                  <Box fontSize="lg" fontWeight="semibold" color="fg.default">
                    {isEditing ? "Update API Key" : "Add Provider Key"}
                  </Box>

                  {isEditing ? (
                    <Box
                      p={3}
                      bg="brand.50"
                      color="brand.800"
                      borderRadius="xl"
                      fontSize="xs"
                      fontWeight="medium"
                    >
                      Editing API key for{" "}
                      <Box as="span" fontWeight="bold">
                        {selectedProvider}
                      </Box>
                    </Box>
                  ) : (
                    <Box>
                      <Box
                        mb={2}
                        fontWeight="medium"
                        fontSize="sm"
                        color="fg.default"
                      >
                        Provider
                      </Box>
                      <MenuRoot>
                        <MenuTrigger asChild>
                          <Button
                            variant="outline"
                            width="100%"
                            justifyContent="space-between"
                            borderRadius="12px"
                            bg="bg.muted"
                            borderColor="border.default"
                            fontWeight="normal"
                            color={
                              selectedProvider ? "fg.default" : "fg.subtle"
                            }
                            py={6}
                            px={4}
                            fontSize="sm"
                            _hover={{ borderColor: "brand.500" }}
                            _active={{ borderColor: "brand.500" }}
                          >
                            {selectedProvider || "Select a provider"}
                            <BiChevronDown />
                          </Button>
                        </MenuTrigger>
                        <MenuContent
                          width="100%"
                          borderRadius="12px"
                          boxShadow="lg"
                          bg="bg.panel"
                          border="1px solid"
                          borderColor="border.subtle"
                        >
                          {getUnusedProviders().map((p) => (
                            <MenuItem
                              key={p}
                              value={p}
                              onClick={() => setSelectedProvider(p)}
                              px={4}
                              py={3}
                              cursor="pointer"
                              transition="all 0.2s"
                              _hover={{ bg: "bg.subtle", color: "brand.600" }}
                            >
                              {p}
                            </MenuItem>
                          ))}
                        </MenuContent>
                      </MenuRoot>
                    </Box>
                  )}

                  <Box>
                    <Box
                      mb={2}
                      fontWeight="medium"
                      fontSize="sm"
                      color="fg.default"
                    >
                      API Key
                    </Box>
                    <Input
                      placeholder="sk-..."
                      value={apiKeyInput}
                      onChange={(e) => setApiKeyInput(e.target.value)}
                      type="password"
                      bg="bg.muted"
                      borderRadius="12px"
                      border="1px solid"
                      borderColor="border.default"
                      py={6}
                      px={4}
                      fontSize="sm"
                      _focus={{
                        borderColor: "brand.500",
                        boxShadow: "0 0 0 1px token(colors.brand.500)",
                      }}
                    />
                  </Box>

                  <HStack gap={3} pt={2}>
                    {isEditing && (
                      <Button
                        variant="ghost"
                        borderRadius="xl"
                        flex={1}
                        onClick={() => {
                          setIsEditing(false);
                          setSelectedProvider("");
                          setApiKeyInput("");
                        }}
                      >
                        Cancel
                      </Button>
                    )}
                    <Button
                      bg="brand.600"
                      color="white"
                      borderRadius="xl"
                      flex={2}
                      _hover={{ bg: "brand.700" }}
                      loading={isSubmitting}
                      disabled={
                        !selectedProvider || !apiKeyInput.trim() || isSubmitting
                      }
                      onClick={handleSave}
                    >
                      {isEditing ? "Update Key" : "Save Key"}
                    </Button>
                  </HStack>
                </VStack>
              </Box>
            </GridItem>
          </Grid>
        )}
      </Container>
    </Box>
  );
};

export default ApiKeysPage;
