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

    // Dummy messages for visualization since backend is down
    if (sessionStore.getState().messages.length === 0) {
      sessionStore.getState().setMessages([
        {
          session_id: "dev",
          message_id: "1",
          sender: "user",
          content: "Hello! How can you help me today?",
          timestamp: new Date().toISOString(),
        },
        {
          session_id: "dev",
          message_id: "2",
          sender: "assistant",
          content:
            "I am your AI assistant. I can help you with coding, debugging, or just chatting! I've been upgraded with a new premium UI. What do you think?",
          timestamp: new Date().toISOString(),
        },
        {
          session_id: "dev",
          message_id: "3",
          sender: "user",
          content:
            "The new UI looks amazing! The bubbles and glass effects are much better now. Can you show me a code block?",
          timestamp: new Date().toISOString(),
        },
        {
          session_id: "dev",
          message_id: "4",
          sender: "assistant",
          content:
            'Certainly! Here is a sample React component with the new styling:\n\n```tsx\nconst PremiumComponent = () => {\n  return (\n    <div className="glass-effect">\n      <h1>Hello World</h1>\n    </div>\n  );\n};\n```',
          timestamp: new Date().toISOString(),
        },
      ]);
    }

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
