import { defineSlotRecipe } from "@chakra-ui/react";

export const menuSlots = defineSlotRecipe({
  slots: ["item", "content", "button"],
  base: {
    item: {
      _hover: {
        bg: "bg.emphasized",
        color: "fg",
      },
      color: "fg",
      textTransform: "capitalize",
      py: 3,
      px: 4,
      transition: "all 0.2s",
    },
    content: {
      bg: "bg.panel",
      borderColor: "border.subtle",
      border: "1px solid",
      borderRadius: "lg",
      boxShadow: "md",
      backdropFilter: "blur(12px)",
    },
    button: {
      color: "fg",
      bg: "bg.panel",
      border: "1px solid",
      borderColor: "border.subtle",
      _hover: {
        bg: "bg.emphasized",
        borderColor: "border",
        transform: "translateY(-1px)",
        boxShadow: "md",
      },
      _active: {
        transform: "translateY(0)",
        boxShadow: "sm",
      },
      transition: "all 0.2s",
      boxShadow: "sm",
    },
  },
  variants: {
    visual: {
      session: {
        content: {
          bg: "bg.panel",
          borderColor: "border.subtle",
          border: "1px solid",
          borderRadius: "12px",
          boxShadow: "md",
          backdropFilter: "blur(20px)",
        },

        item: {
          color: "fg",
          borderRadius: "8px",
          mx: 1,
          my: 1,
          _hover: {
            bg: "bg.emphasized",
            color: "fg",
          },
        },
      },
    },
  },
});
