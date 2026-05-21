import { Box, HStack } from "@chakra-ui/react";

interface FileDisplayProps {
  files: string[];
}

const FileDisplayForUserMessage = ({ files }: FileDisplayProps) => {
  console.log("FileDisplayForUserMessage received files:", files);
  console.log("Files length:", files?.length);
  console.log("Files type:", typeof files);

  if (!files || files.length === 0) {
    return null;
  }

  return (
    <Box w="100%" maxW="100%" overflowX="auto" pb={2}>
      <HStack gap={2} minW="max-content" color="white">
        {files.map((file, index) => {
          console.log(`Rendering file ${index}:`, file);
          return (
            <Box
              key={`${file}-${index}-${Date.now()}`}
              minW="240px"
              maxW="240px"
              h="50px"
              bg="rgba(139, 92, 246, 0.15)"
              border="1px solid rgba(139, 92, 246, 0.3)"
              borderRadius="12px"
              p={3}
              display="flex"
              alignItems="center"
              justifyContent="space-between"
              position="relative"
              flexShrink={0}
            >
              <HStack gap={3} flex={1} overflow="hidden">
                <Box fontSize="24px" color="white" flexShrink={0}>
                  📄
                </Box>
                <Box
                  fontSize="sm"
                  fontWeight="500"
                  color="white"
                  overflow="hidden"
                  textOverflow="ellipsis"
                  whiteSpace="nowrap"
                  flex={1}
                >
                  {file || "Unknown file"}
                </Box>
              </HStack>
            </Box>
          );
        })}
      </HStack>
    </Box>
  );
};

export default FileDisplayForUserMessage;
