import { Box, Button, FileUpload, HStack, IconButton } from "@chakra-ui/react";
import { IoAttach } from "react-icons/io5";
import { X } from "lucide-react";
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
      if (!details.acceptedFiles || details.acceptedFiles.length === 0) {
        return;
      }

      const newFiles = details.acceptedFiles.filter((newFile: File) => {
        return !files.some(
          (existingFile) =>
            existingFile.name === newFile.name &&
            existingFile.size === newFile.size &&
            existingFile.lastModified === newFile.lastModified,
        );
      });

      if (newFiles.length > 0) {
        addUniqueFiles(newFiles);
      }
    },
    [files, addUniqueFiles],
  );

  const clearFileInput = useCallback(() => {
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, []);

  const handleRemoveFile = useCallback(
    (index: number) => {
      removeFile(index);

      if (files.length === 1) {
        clearFileInput();
      }
    },
    [files.length, removeFile, clearFileInput],
  );

  useEffect(() => {
    if (files.length === 0 && fileInputRef.current?.files?.length) {
      clearFileInput();
    }
  }, [files.length, clearFileInput]);

  return (
    <FileUpload.Root
      ref={fileUploadRef}
      maxFiles={5}
      onFileChange={handleFileChange}
      justifyContent="flex-start"
      key={files.length} // Force re-render when files change
    >
      {/* File display section */}
      {files.length > 0 && (
        <Box w="100%" maxW="100%" overflowX="auto" pb={2}>
          <HStack gap={2} minW="max-content" color="white">
            {files.map((file, index) => {
              // Create unique key to prevent React issues
              const fileKey = `${file.name}-${file.size}-${file.lastModified}-${index}`;

              return (
                <Box
                  key={fileKey}
                  minW="240px"
                  maxW="240px"
                  h="50px"
                  bg={"bg.panel"}
                  border={`1px solid ${"border.subtle"}`}
                  borderRadius="12px"
                  p={3}
                  display="flex"
                  alignItems="center"
                  justifyContent="space-between"
                  position="relative"
                  flexShrink={0}
                >
                  <HStack gap={3} flex={1} overflow="hidden">
                    <Box fontSize="24px" color={"fg"} flexShrink={0}>
                      📄
                    </Box>
                    <Box
                      fontSize="sm"
                      fontWeight="500"
                      color={"fg"}
                      overflow="hidden"
                      textOverflow="ellipsis"
                      whiteSpace="nowrap"
                      flex={1}
                      title={file.name} // Tooltip for full name
                    >
                      {file.name}
                    </Box>
                  </HStack>
                  <IconButton
                    size="xs"
                    variant="ghost"
                    onClick={() => handleRemoveFile(index)}
                    aria-label="Remove file"
                    color={{ base: "red.600", _dark: "red.400" }}
                    bg="transparent"
                    flexShrink={0}
                    borderRadius="full"
                    transition="all 0.2s ease"
                    _hover={{
                      bg: { base: "red.50", _dark: "red.950" },
                      color: { base: "red.700", _dark: "red.300" },
                      transform: "scale(1.1)",
                    }}
                    _active={{
                      transform: "scale(0.9)",
                      bg: { base: "red.100", _dark: "red.900" },
                    }}
                  >
                    <X size={14} />
                  </IconButton>
                </Box>
              );
            })}
          </HStack>
        </Box>
      )}

      <FileUpload.HiddenInput ref={fileInputRef} />
      {children}
      <FileUpload.Trigger asChild>
        <Button size="md" bg="transparent" color={"fg"} border="0px">
          <IoAttach />
        </Button>
      </FileUpload.Trigger>
    </FileUpload.Root>
  );
};

export default MediaPDF;
