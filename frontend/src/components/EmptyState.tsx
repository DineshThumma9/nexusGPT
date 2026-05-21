import { Box, Center, Heading, Text, VStack } from "@chakra-ui/react";
import { Bot } from "lucide-react";
import { motion } from "framer-motion";

const EmptyState = () => {
  return (
    <Center h="full">
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{
          duration: 0.5,
          ease: "easeOut",
          type: "spring",
          stiffness: 200,
        }}
      >
        <VStack gap={6} textAlign="center">
          <motion.div
            animate={{ y: [0, -10, 0] }}
            transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
          >
            <Box p={4} bg="bg.muted" borderRadius="full">
              <Bot size={32} color="token(colors.fg.subtle)" />
            </Box>
          </motion.div>
          <VStack gap={2}>
            <Heading fontSize="xl" fontWeight="600" color="fg.default">
              Start a conversation
            </Heading>
            <Text fontSize="md" color="fg.subtle" maxW="400px" lineHeight="1.6">
              Choose a model and start chatting. Your messages will appear here.
            </Text>
          </VStack>
        </VStack>
      </motion.div>
    </Center>
  );
};

export default EmptyState;
