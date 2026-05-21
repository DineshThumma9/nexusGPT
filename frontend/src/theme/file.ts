// theme/recipes/messageRecipes.ts
import { defineSlotRecipe } from "@chakra-ui/react";

export const messageRecipes = defineSlotRecipe({
  slots: [
    "container",
    "avatar",
    "content",
    "actions",
    "streamingText",
    "cursor",
  ],
  base: {
    container: {
      display: "flex",
      alignItems: "flex-start",
      width: "100%",
      maxWidth: "100%",
      gap: 3,
    },
    avatar: {
      flexShrink: 0,
      marginTop: 1,
      padding: 2,
      borderRadius: "full",
      border: "2px solid",
      boxShadow: "0 4px 12px rgba(34, 197, 94, 0.4)",
    },
    content: {
      flex: 1,
      minWidth: 0,
      fontSize: "15px",
      color: "white",
      width: "100%",
      lineHeight: "1.65",
      fontFamily: "system-ui, -apple-system, sans-serif",
      padding: 4,
      borderRadius: "xl",
      border: "2px solid",
      wordBreak: "break-word",
      overflowWrap: "break-word",
      transition: "all 0.3s ease",
    },
    actions: {
      display: "flex",
      gap: 2,
      marginTop: 3,
    },
    streamingText: {
      whiteSpace: "pre-wrap",
      fontFamily:
        "ui-monospace, SFMono-Regular, 'SF Mono', Monaco, Inconsolata, 'Roboto Mono', monospace",
      fontSize: "14px",
      wordBreak: "break-word",
      overflowWrap: "break-word",
      color: "green.100",
    },
    cursor: {
      display: "inline-block",
      width: "2px",
      height: "1em",
      backgroundColor: "green.300",
      animation: "blink 1s infinite",
      marginLeft: 1,
    },
  },
  variants: {
    role: {
      ai: {
        container: {
          direction: "row",
        },
        avatar: {
          background: "linear-gradient(135deg, #22c55e, #10b981)",
          borderColor: "green.300",
        },
        content: {
          background: "rgba(30, 30, 50, 0.8)",
          backdropFilter: "blur(10px)",
          borderColor: "rgba(34, 197, 94, 0.3)",
          boxShadow: "0 4px 20px rgba(34, 197, 94, 0.2)",
          maxWidth: "calc(100% - 60px)",
          _hover: {
            borderColor: "rgba(34, 197, 94, 0.5)",
            boxShadow: "0 6px 25px rgba(34, 197, 94, 0.3)",
          },
        },
      },
      user: {
        container: {
          direction: "column",
          alignItems: "flex-end",
        },
        avatar: {
          background: "linear-gradient(135deg, #10b981, #22c55e)",
          borderColor: "green.400",
        },
        content: {
          maxWidth: "80%",
          boxShadow: "0 2px 12px rgba(34, 197, 94, 0.3)",
          borderColor: "green.400",
        },
      },
    },
  },
});
