// src/components/ColorModeToggle.tsx
import { IconButton } from "@chakra-ui/react";
import { Moon, Sun } from "lucide-react";
import { useColorMode } from "../components/ui/color-mode";

export const ColorModeToggle = () => {
  const { colorMode, toggleColorMode } = useColorMode();

  return (
    <IconButton
      aria-label={`Switch to ${colorMode === "light" ? "dark" : "light"} mode`}
      onClick={toggleColorMode}
      size="md"
      variant="ghost"
      bg="transparent"
      color="fg.muted"
      colorPalette="brand"
      _hover={{
        bg: "brand.hover",
        color: "brand.solid",
      }}
      _active={{
        bg: "brand.active",
      }}
      transition="all 0.2s ease"
    >
      {colorMode === "light" ? <Moon size={16} /> : <Sun size={16} />}
    </IconButton>
  );
};
