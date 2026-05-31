import {
  Grid,
  GridItem,
  Box,
  Flex,
  IconButton,
  useDisclosure,
  Drawer,
} from "@chakra-ui/react";
import { FiX } from "react-icons/fi";
import Sidebar from "../components/SideBar";
import ChatArea from "../components/ChatArea";
import { useState } from "react";

const ChatPage = () => {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  // Chakra UI v3: useDisclosure returns `open`, not `isOpen`
  const { open, onOpen, onClose } = useDisclosure();

  return (
    <Box
      h="100vh"
      w="100vw"
      bg="bg.canvas"
      overflow="hidden"
      p={0}
      m={0}
      position="relative"
    >
      <Grid
        templateAreas={{
          base: `"main"`,
          md: `"aside main"`,
        }}
        templateColumns={{
          base: "1fr",
          md: isSidebarCollapsed ? "80px 1fr" : "280px 1fr",
        }}
        h="100vh"
        w="100vw"
        bg="bg.canvas"
        transition="all 0.4s cubic-bezier(0.4, 0, 0.2, 1)"
        overflow="hidden"
        gap={0}
      >
        {/* Desktop Sidebar */}
        <GridItem
          area="aside"
          overflow="hidden"
          display={{ base: "none", md: "block" }}
        >
          <Sidebar onCollapse={setIsSidebarCollapsed} />
        </GridItem>

        {/* Mobile Sidebar — Chakra v3 Drawer namespace API */}
        <Drawer.Root
          open={open}
          onOpenChange={(e) => (e.open ? onOpen() : onClose())}
          placement="start"
        >
          <Drawer.Backdrop />
          <Drawer.Positioner>
            <Drawer.Content bg="bg.canvas" maxW="260px">
              <Flex justify="flex-end" p={2} flexShrink={0}>
                <Drawer.CloseTrigger asChild>
                  <IconButton
                    aria-label="Close sidebar"
                    variant="ghost"
                    size="sm"
                    color="fg.muted"
                    _hover={{ bg: "bg.subtle", color: "fg" }}
                  >
                    <FiX />
                  </IconButton>
                </Drawer.CloseTrigger>
              </Flex>
              <Box flex="1" overflow="hidden">
                <Sidebar onCollapse={() => {}} />
              </Box>
            </Drawer.Content>
          </Drawer.Positioner>
        </Drawer.Root>

        {/* Main Chat Area */}
        <GridItem area="main" overflow="hidden" position="relative">
          <ChatArea onOpenSidebar={onOpen} />
        </GridItem>
      </Grid>
    </Box>
  );
};

export default ChatPage;
