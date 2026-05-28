import { Box, HStack } from "@chakra-ui/react";
import { FileText } from "lucide-react";

interface FileDisplayProps {
  files: string[];
}

const FileDisplayForUserMessage = ({ files }: FileDisplayProps) => {
  if (!files || files.length === 0) {
    return null;
  }

  return (
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
      <HStack gap={2} minW="max-content" justify="flex-end">
        {files.map((file, index) => {
          return (
            <Box
              key={`${file}-${index}`}
              minW="200px"
              maxW="240px"
              h="44px"
              bg="brand.600"
              color="white"
              borderRadius="2xl"
              px={3}
              display="flex"
              alignItems="center"
              justifyContent="space-between"
              position="relative"
              flexShrink={0}
              boxShadow="0 2px 10px -2px rgba(34, 197, 94, 0.2)"
            >
              <HStack gap={3} flex={1} overflow="hidden">
                <Box
                  color="whiteAlpha.900"
                  flexShrink={0}
                  display="flex"
                  alignItems="center"
                >
                  <FileText size={16} strokeWidth={2.5} />
                </Box>
                <Box
                  fontSize="sm"
                  fontWeight="500"
                  color="white"
                  overflow="hidden"
                  textOverflow="ellipsis"
                  whiteSpace="nowrap"
                  flex={1}
                  letterSpacing="-0.01em"
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
