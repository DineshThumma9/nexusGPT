import { Grid, GridItem, Box } from "@chakra-ui/react";
import Sidebar from "../components/SideBar";
import ChatArea from "../components/ChatArea";
import { useState } from "react";
const ChatPage = () => {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
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
        {/* Sidebar */}
        <GridItem
          area="aside"
          overflow="hidden"
          display={{ base: "none", md: "block" }}
        >
          <Sidebar onCollapse={setIsSidebarCollapsed} />
        </GridItem>

        {/* Main Chat Area */}
        <GridItem area="main" overflow="hidden" position="relative">
          <ChatArea />
        </GridItem>
      </Grid>
    </Box>
  );
};

export default ChatPage;
