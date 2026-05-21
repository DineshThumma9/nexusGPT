// theme/recipes/editableRecipes.ts
import { defineSlotRecipe } from "@chakra-ui/react";

export const editableRecipes = defineSlotRecipe({
  slots: ["preview", "input", "control", "cancelButton", "submitButton"],
  base: {
    preview: {
      wordBreak: "break-word",
      overflowWrap: "break-word",
      whiteSpace: "pre-wrap",
    },
    input: {
      wordBreak: "break-word",
      overflowWrap: "break-word",
      whiteSpace: "pre-wrap",
      background: "green.600",
      border: "1px solid",
      borderColor: "green.400",
      _focus: {
        borderColor: "green.300",
        boxShadow: "0 0 0 1px rgba(34, 197, 94, 0.3)",
      },
    },
    control: {
      display: "flex",
      gap: 2,
      marginTop: 2,
    },
    cancelButton: {
      colorScheme: "red",
    },
    submitButton: {
      colorScheme: "green",
    },
  },
});
