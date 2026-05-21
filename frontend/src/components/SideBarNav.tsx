import { Button, HStack, Text } from "@chakra-ui/react";
import { Plus } from "lucide-react";
import useSessions from "../hooks/useSessions.ts";
import { useState } from "react";

const SideBarNav = () => {
  const { createNewSession } = useSessions();
  const [isCreating, setIsCreating] = useState(false);

  const hstackStyles = {
    width: "100%",
    bg: "glass.bg",
    backdropFilter: "blur(20px)",
    borderRadius: "xl",
    justifyContent: "center",
    height: "44px",
    px: 3,
    border: "1px solid",
    borderColor: "border.subtle",
  };

  const handleCreateNewSession = async () => {
    if (isCreating) return;

    setIsCreating(true);
    try {
      const sessionId = await createNewSession();
      console.log("New session created:", sessionId);
    } catch (error) {
      console.error("Failed to create new session:", error);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <HStack {...hstackStyles}>
      <Button
        onClick={handleCreateNewSession}
        loading={isCreating}
        disabled={isCreating}
        variant="ghost"
        w="full"
        h="40px"
        borderRadius="lg"
        color="brand.600"
        display="flex"
        gap={3}
        justifyContent="center"
        _hover={{
          bg: "brand.subtle",
          color: "brand.700",
          transform: "translateY(-1px)",
        }}
        _active={{
          transform: "translateY(0)",
        }}
      >
        <Plus size={18} />
        <Text fontSize="sm" fontWeight="600">
          New Chat
        </Text>
      </Button>
    </HStack>
  );
};

export default SideBarNav;
