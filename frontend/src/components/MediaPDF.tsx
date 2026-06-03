import { Box, FileUpload, HStack, IconButton, VStack } from "@chakra-ui/react";
import { IoAttach } from "react-icons/io5";
import { X, FileText } from "lucide-react";
import type { ReactNode } from "react";
import { useCallback, useEffect, useRef } from "react";
import useSessionStore from "../store/sessionStore.ts";

interface Props {
  children: ReactNode;
}

const MediaPDF = ({ children }: Props) => {
  const { files, removeFile, addUniqueFiles } = useSessionStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fileUploadRef = useRef<any>(null);

  const handleFileChange = useCallback(
    (details: any) => {
      if (!details.acceptedFiles?.length) return;
      const newFiles = details.acceptedFiles.filter(
        (newFile: File) =>
          !files.some(
            (f) =>
              f.name === newFile.name &&
              f.size === newFile.size &&
              f.lastModified === newFile.lastModified,
          ),
      );
      if (newFiles.length > 0) addUniqueFiles(newFiles);
    },
    [files, addUniqueFiles],
  );

  const clearFileInput = useCallback(() => {
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  const handleRemoveFile = useCallback(
    (index: number) => {
      removeFile(index);
      if (files.length === 1) clearFileInput();
    },
    [files.length, removeFile, clearFileInput],
  );

  useEffect(() => {
    if (files.length === 0 && fileInputRef.current?.files?.length)
      clearFileInput();
  }, [files.length, clearFileInput]);

  return (
    <FileUpload.Root
      ref={fileUploadRef}
      maxFiles={5}
      onFileChange={handleFileChange}
      flex="1"
      minW={0}
    >
      {/* VStack: chips on top, [textarea + attach] on bottom row */}
      <VStack align="stretch" gap={0} w="100%">
        {/* ── File chip strip — only shown when files are attached ── */}
        {files.length > 0 && (
          <Box
            w="100%"
            overflowX="auto"
            pb={1.5}
            pt={1}
            css={{
              "&::-webkit-scrollbar": { display: "none" },
              msOverflowStyle: "none",
              scrollbarWidth: "none",
            }}
          >
            <HStack gap={2} minW="max-content" px={1}>
              {files.map((file, index) => {
                const fileKey = `${file.name}-${file.size}-${file.lastModified}-${index}`;
                return (
                  <HStack
                    key={fileKey}
                    minW={{ base: "120px", md: "150px" }}
                    maxW={{ base: "160px", md: "200px" }}
                    h="32px"
                    bg={{
                      base: "rgba(99,102,241,0.06)",
                      _dark: "rgba(99,102,241,0.12)",
                    }}
                    border="1px solid"
                    borderColor={{
                      base: "rgba(99,102,241,0.2)",
                      _dark: "rgba(99,102,241,0.25)",
                    }}
                    borderRadius="lg"
                    px={2}
                    gap={1.5}
                    flexShrink={0}
                    overflow="hidden"
                    transition="all 0.2s"
                    _hover={{
                      borderColor: "brand.500",
                      bg: {
                        base: "rgba(99,102,241,0.1)",
                        _dark: "rgba(99,102,241,0.18)",
                      },
                    }}
                  >
                    <Box color="brand.600" flexShrink={0}>
                      <FileText size={13} strokeWidth={2.5} />
                    </Box>
                    <Box
                      fontSize="xs"
                      fontWeight="500"
                      color={{ base: "gray.700", _dark: "gray.200" }}
                      overflow="hidden"
                      textOverflow="ellipsis"
                      whiteSpace="nowrap"
                      flex={1}
                      title={file.name}
                    >
                      {file.name}
                    </Box>
                    <IconButton
                      size="2xs"
                      variant="ghost"
                      onClick={() => handleRemoveFile(index)}
                      aria-label="Remove file"
                      color={{ base: "gray.400", _dark: "gray.500" }}
                      bg="transparent"
                      flexShrink={0}
                      minW="18px"
                      h="18px"
                      borderRadius="full"
                      transition="all 0.15s"
                      _hover={{
                        bg: { base: "red.50", _dark: "rgba(239,68,68,0.15)" },
                        color: { base: "red.500", _dark: "red.400" },
                      }}
                    >
                      <X size={11} />
                    </IconButton>
                  </HStack>
                );
              })}
            </HStack>
          </Box>
        )}

        {/* ── Textarea + attach button on same row ── */}
        <HStack gap={1} align="flex-end" w="100%">
          {/* hidden input */}
          <FileUpload.HiddenInput ref={fileInputRef} />

          {/* Textarea passed as child */}
          <Box flex="1" minW={0}>
            {children}
          </Box>

          {/* Attach button — stays right of textarea */}
          <FileUpload.Trigger asChild>
            <IconButton
              aria-label="Attach file"
              size="xs"
              variant="ghost"
              bg="transparent"
              color={{ base: "gray.600", _dark: "gray.100" }}
              borderRadius="lg"
              flexShrink={0}
              mb="2px"
              transition="all 0.2s"
              _hover={{
                bg: {
                  base: "rgba(99,102,241,0.08)",
                  _dark: "rgba(99,102,241,0.15)",
                },
                color: { base: "brand.600", _dark: "brand.500" },
                transform: "scale(1.1)",
              }}
              _active={{ transform: "scale(0.92)" }}
            >
              <IoAttach size={16} />
            </IconButton>
          </FileUpload.Trigger>
        </HStack>
      </VStack>
    </FileUpload.Root>
  );
};

export default MediaPDF;
