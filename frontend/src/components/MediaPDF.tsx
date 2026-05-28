import { Box, Button, FileUpload, HStack, IconButton } from "@chakra-ui/react";
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
        <Box
          w="100%"
          maxW="100%"
          overflowX="auto"
          pb={2}
          css={{
            "&::-webkit-scrollbar": { display: "none" },
            msOverflowStyle: "none",
            scrollbarWidth: "none",
          }}
        >
          <HStack gap={3} minW="max-content" px={1}>
            {files.map((file, index) => {
              // Create unique key to prevent React issues
              const fileKey = `${file.name}-${file.size}-${file.lastModified}-${index}`;

              return (
                <Box
                  key={fileKey}
                  minW="200px"
                  maxW="240px"
                  h="44px"
                  bg={{ base: "gray.50", _dark: "whiteAlpha.100" }}
                  border="1px solid"
                  borderColor={{ base: "gray.200", _dark: "whiteAlpha.200" }}
                  borderRadius="xl"
                  px={3}
                  display="flex"
                  alignItems="center"
                  justifyContent="space-between"
                  position="relative"
                  flexShrink={0}
                  transition="all 0.2s"
                  _hover={{
                    bg: { base: "gray.100", _dark: "whiteAlpha.200" },
                    borderColor: "brand.500",
                    transform: "translateY(-1px)",
                    boxShadow: "sm",
                  }}
                >
                  <HStack gap={3} flex={1} overflow="hidden">
                    <Box
                      color="brand.500"
                      flexShrink={0}
                      display="flex"
                      alignItems="center"
                    >
                      <FileText size={16} strokeWidth={2.5} />
                    </Box>
                    <Box
                      fontSize="sm"
                      fontWeight="500"
                      color={{ base: "gray.800", _dark: "gray.100" }}
                      overflow="hidden"
                      textOverflow="ellipsis"
                      whiteSpace="nowrap"
                      flex={1}
                      title={file.name} // Tooltip for full name
                      letterSpacing="-0.01em"
                    >
                      {file.name}
                    </Box>
                  </HStack>
                  <IconButton
                    size="xs"
                    variant="ghost"
                    onClick={() => handleRemoveFile(index)}
                    aria-label="Remove file"
                    color={{ base: "gray.400", _dark: "gray.500" }}
                    bg="transparent"
                    flexShrink={0}
                    w="24px"
                    h="24px"
                    minW="24px"
                    borderRadius="full"
                    transition="all 0.2s ease"
                    _hover={{
                      bg: { base: "red.50", _dark: "red.950" },
                      color: { base: "red.600", _dark: "red.400" },
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
