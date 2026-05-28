import {
  Box,
  Editable,
  Flex,
  HStack,
  IconButton,
  VStack,
  Clipboard,
} from "@chakra-ui/react";
import { type Message } from "../entities/Message.ts";
import { LuCheck, LuX, LuCopy } from "react-icons/lu";
import FileDisplayForUserMessage from "./FileDisplayForUserMessage.tsx";

interface Props {
  msg: Message;
}

const UserRequest = ({ msg }: Props) => {
  const editableInput = {
    wordBreak: "break-word" as const,
    overflowWrap: "break-word" as const,
    whiteSpace: "pre-wrap" as const,
    bg: "brand.600",
    borderRadius: "2xl",
    p: 3,
    color: "white",
    border: "none",
    _focus: {
      boxShadow: "0 0 0 2px token(colors.brand.300)",
    },
  };

  const editableIcon = {
    variant: "outline" as const,
    size: "xs" as const,
    bg: "bg.canvas",
    color: { base: "brand.700", _dark: "brand.600" },
    border: "1px solid",
    borderColor: "border.default",
    transition: "all 0.2s ease",
    _hover: {
      bg: { base: "brand.50", _dark: "brand.950" },
      borderColor: { base: "brand.300", _dark: "brand.700" },
      color: { base: "brand.800", _dark: "brand.500" },
      transform: "scale(1.05)",
    },
  };

  return (
    <Flex
      direction="column"
      align="flex-end"
      w="100%"
      maxW="100%"
      px={2} // Optional small padding
    >
      <Flex
        align="flex-end"
        direction="row"
        gap={3}
        w="100%"
        justify="flex-end"
      >
        {/* Files Section */}
        <VStack align="flex-end" gap={1} maxW="80%">
          {msg.files && msg.files.length > 0 && (
            <Box maxW="full">
              <FileDisplayForUserMessage files={msg.files} />
            </Box>
          )}
          <Box maxW="full" display="inline-block">
            <Box
              bg="brand.600"
              color="white"
              borderRadius="3xl"
              borderBottomRightRadius="md"
              px={5}
              py={3}
              boxShadow="0 4px 15px -5px rgba(34, 197, 94, 0.4)"
            >
              <Editable.Root defaultValue={msg.content}>
                <Editable.Preview
                  wordBreak="break-word"
                  overflowWrap="break-word"
                  whiteSpace="pre-wrap"
                  fontSize="md"
                />
                <Editable.Input {...editableInput} />
                <Editable.Control>
                  <Editable.CancelTrigger asChild>
                    <IconButton {...editableIcon} aria-label="Cancel edit">
                      <LuX />
                    </IconButton>
                  </Editable.CancelTrigger>
                  <Editable.SubmitTrigger asChild>
                    <IconButton {...editableIcon} aria-label="Submit edit">
                      <LuCheck />
                    </IconButton>
                  </Editable.SubmitTrigger>
                </Editable.Control>
              </Editable.Root>
            </Box>
          </Box>
        </VStack>
      </Flex>

      {/* Action buttons */}
      <HStack gap={2}>
        <Clipboard.Root value={msg.content.trimEnd()}>
          <Clipboard.Trigger asChild>
            <IconButton
              size="xs"
              variant="ghost"
              bg="transparent"
              px={2}
              py={1}
              color={{ base: "brand.700", _dark: "brand.600" }}
              _hover={{
                bg: "transparent",
                color: { base: "brand.800", _dark: "brand.500" },
                transform: "scale(1.1)",
              }}
              _active={{ transform: "scale(0.95)" }}
              transition="all 0.15s ease"
              aria-label="Copy message"
            >
              <Clipboard.Indicator copied={<LuCheck color="green" />}>
                <LuCopy />
              </Clipboard.Indicator>
            </IconButton>
          </Clipboard.Trigger>
        </Clipboard.Root>
      </HStack>
    </Flex>
  );
};

export default UserRequest;
