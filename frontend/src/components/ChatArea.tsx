// src/components/ChatArea.tsx
import { HStack, VStack } from "@chakra-ui/react";
import LLMModelChooser from "./LLMModelChooser";
import AvaterExpandable from "./AvaterExpandable";
import SendRequest from "./SendRequest";
import Response from "./Response";
import { useEffect, useRef } from "react";
import sessionStore from "../store/sessionStore.ts";
const ChatArea = () => {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const unsubscribe = sessionStore.subscribe(() => {
      // Message updates handled by Response component
    });


    return unsubscribe;
  }, []);

  const chatAreaVstack = {
    flex: "1",
    gap: "0",
    h: "100vh",
    bg: "bg.canvas",
    overflow: "hidden",
    position: "relative",
  };

  const Hstackprops = {
    justifyContent: "space-between",
    alignItems: "center",
    position: "absolute",
    top: 0,
    w: "full",
    bg: "transparent", // no background
    zIndex: 100,
    px: 6,
    pt: 2,
  };

  return (
    <VStack {...chatAreaVstack}>
      <HStack {...Hstackprops}>
        <LLMModelChooser />
        <AvaterExpandable />
      </HStack>

      <Response />

      {/*<Box*/}
      {/*    {...footerBox}*/}
      {/*>*/}
      <SendRequest />
      {/*</Box>*/}

      <div ref={scrollRef}></div>
    </VStack>
  );
};

export default ChatArea;
