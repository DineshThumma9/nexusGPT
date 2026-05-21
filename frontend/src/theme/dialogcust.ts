import { defineSlotRecipe } from "@chakra-ui/react";

export const dialogcust = defineSlotRecipe({
  slots: ["content", "title", "backdrop", "cancel", "confirm", "input"],
  base: {
    content: {
      bg: { base: "white", _dark: "gray.800" },
      borderRadius: "12px",
      border: "1px solid",
      borderColor: { base: "gray.200", _dark: "gray.700" },
      boxShadow: "lg",
      maxW: "md",
      mx: 4,
    },
    title: {
      fontSize: "xl",
      fontWeight: "bold",
      color: { base: "gray.800", _dark: "white" },
      textAlign: "center",
    },
    backdrop: {
      bg: "rgba(0, 0, 0, 0.5)",
    },
    cancel: {
      borderRadius: "8px",
      border: "1px solid",
      borderColor: { base: "gray.300", _dark: "gray.600" },
      color: { base: "gray.700", _dark: "gray.300" },
      bg: "transparent",
      px: 6,
      py: 2,
      _hover: {
        bg: { base: "gray.50", _dark: "gray.700" },
        borderColor: { base: "gray.400", _dark: "gray.500" },
      },
      _active: {
        transform: "translateY(1px)",
      },
      transition: "all 0.2s",
    },
    input: {
      bg: { base: "white", _dark: "gray.700" },
      border: "1px solid",
      borderColor: { base: "gray.300", _dark: "gray.600" },
      borderRadius: "8px",
      color: { base: "gray.800", _dark: "white" },
      px: 4,
      py: 3,
      fontSize: "sm",
      transition: "all 0.2s ease",
      _placeholder: {
        color: { base: "gray.500", _dark: "gray.400" },
      },
      _focus: {
        borderColor: { base: "brand.500", _dark: "brand.400" },
        boxShadow: "0 0 0 3px rgba(34, 197, 94, 0.1)",
      },
      _hover: {
        borderColor: { base: "gray.400", _dark: "gray.500" },
      },
    },
  },
});
