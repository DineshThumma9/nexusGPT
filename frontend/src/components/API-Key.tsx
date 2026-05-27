"use client";
import {
  Button,
  Dialog,
  Field,
  Input,
  Portal,
  Stack,
  Text,
  Link,
  HStack,
} from "@chakra-ui/react";
import { useRef, useState, useEffect } from "react";
import { apiKeySelection } from "../api/session-api.ts";
import useInitStore from "../store/initStore.ts";
import { Constants } from "../entities/Constants.ts";
import { ExternalLink } from "lucide-react";

interface Props {
  provider: string;
  title: string;
  link?: string;
}

const APIKey = ({ provider, title, link }: Props) => {
  const {
    dialogOpen,
    setDialogOpen,
    currentAPIProvider,
    currentAPIKey,
    setCurrentAPIKey,
  } = useInitStore();

  // Get the constants to access API links
  const constants = Constants();
  const apiLink = constants.providers_api_link.get(provider.toLowerCase());

  const ref = useRef<HTMLInputElement>(null);
  const [apiKey, setAPIKey] = useState("");

  // Focus the input when dialog opens
  useEffect(() => {
    if (dialogOpen) {
      setTimeout(() => {
        ref.current?.focus();
      }, 50);
    }
  }, [dialogOpen]);

  const handleDialogChange = ({ open }: { open: boolean }) => {
    setDialogOpen(open);

    // Clear local state when dialog closes
    if (!open) {
      setAPIKey("");
    }
  };

  const handleApiKeySelect = async () => {
    // Validation
    if (!currentAPIProvider) {
      return;
    }

    if (!apiKey || apiKey.trim() === "") {
      return;
    }

    const keyToSave = apiKey;

    // Optimistic UI Update
    setCurrentAPIKey(keyToSave);
    setDialogOpen(false);
    setAPIKey(""); // Clear local state

    try {
      await apiKeySelection(currentAPIProvider, keyToSave);
    } catch (error) {
      console.error("Error in handleApiKeySelect:", error);
    }
  };

  return (
    <Dialog.Root open={dialogOpen} onOpenChange={handleDialogChange}>
      <Portal>
        <Dialog.Backdrop
          css={{
            bg: "rgba(0, 0, 0, 0.6)",
            backdropFilter: "blur(4px)",
          }}
        />
        <Dialog.Positioner>
          <Dialog.Content
            css={{
              bg: "bg.surface",
              border: `1px solid ${"border.default"}`,
              borderRadius: "lg",
              boxShadow: "0 20px 60px rgba(0, 0, 0, 0.15)",
              maxW: "md",
              mx: 4,
            }}
          >
            <Dialog.Header p={6} pb={4} bg={"bg.surface"} borderTopRadius="lg">
              <Dialog.Title
                css={{
                  fontSize: "xl",
                  fontWeight: "bold",
                  color: "fg.default",
                  textAlign: "center",
                }}
              >
                <HStack justify="center" gap={1}>
                  <Text>Enter Your API Key-</Text>
                  {apiLink ? (
                    <Link
                      href={apiLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      color="app.button.primary"
                      textDecoration="underline"
                      display="flex"
                      alignItems="center"
                      gap={1}
                      _hover={{
                        color: "app.button.secondary",
                        textDecoration: "underline",
                        transform: "scale(1.02)",
                      }}
                      transition="all 0.2s ease"
                    >
                      {provider}
                      <ExternalLink size={14} />
                    </Link>
                  ) : (
                    <Text color="app.button.primary">{provider}</Text>
                  )}
                </HStack>
              </Dialog.Title>
            </Dialog.Header>
            <Dialog.Body p={6} pt={2} bg={"bg.surface"}>
              <Stack gap={4}>
                <Field.Root>
                  <Field.Label
                    color={"fg.default"}
                    fontSize="sm"
                    fontWeight="medium"
                    mb={2}
                  >
                    {title}
                  </Field.Label>
                  <Input
                    ref={ref}
                    placeholder="Enter your API KEY"
                    value={apiKey}
                    onChange={(e) => setAPIKey(e.target.value)}
                    bg={"bg.canvas"}
                    border="1px solid"
                    borderColor={"border.default"}
                    borderRadius="12px"
                    color={"fg.default"}
                    px={4}
                    py={3}
                    fontSize="sm"
                    transition="all 0.3s ease"
                    _placeholder={{
                      color: "fg.muted",
                    }}
                    _focus={{
                      borderColor: "border.accent",
                      boxShadow: `0 0 0 1px ${"border.accent"}`,
                      bg: "bg.surface",
                    }}
                    _hover={{
                      borderColor: "border.subtle",
                      bg: "bg.subtle",
                    }}
                  />
                </Field.Root>
              </Stack>
            </Dialog.Body>
            <Dialog.Footer
              p={6}
              pt={4}
              gap={3}
              bg={"bg.surface"}
              borderBottomRadius="lg"
            >
              <Dialog.ActionTrigger asChild>
                <Button
                  borderRadius="12px"
                  border="1px solid"
                  borderColor={"border.default"}
                  color={"fg.default"}
                  bg="transparent"
                  px={6}
                  py={2}
                  _hover={{
                    bg: "bg.subtle",
                    borderColor: "border.subtle",
                  }}
                  _active={{
                    transform: "translateY(1px)",
                  }}
                  transition="all 0.2s"
                >
                  Cancel
                </Button>
              </Dialog.ActionTrigger>
              <Button
                onClick={handleApiKeySelect}
                bg={"colorPalette.solid"}
                color={"fg.inverted"}
                borderRadius="12px"
                px={6}
                py={2}
                fontWeight="medium"
                _hover={{
                  bg: "colorPalette.solid",
                  opacity: 0.8,
                  transform: "scale(1.02)",
                }}
                _active={{
                  transform: "scale(0.98)",
                }}
                transition="all 0.2s"
              >
                Save
              </Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
};

export default APIKey;
