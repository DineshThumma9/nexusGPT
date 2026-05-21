// src/components/MenuHelper.tsx
import {
  Button,
  Menu,
  MenuPositioner,
  Portal,
  Input,
  VStack,
  Text,
  Separator,
} from "@chakra-ui/react";
import { MenuTrigger } from "./ui/menu.tsx";
import { ChevronDownIcon } from "lucide-react";
import { useRef, useEffect, useState } from "react";

interface Props {
  title: string;
  options: string[];
  onSelect: (selected: string) => void;
  onDoubleClick?: (selected: string) => void;
  selected?: string;
  disabled?: boolean;
  allowManualInput?: boolean; // New prop to enable manual input
}

const MenuHelper = ({
  title,
  options,
  onSelect,
  onDoubleClick,
  selected,
  disabled,
  allowManualInput,
}: Props) => {
  const clickTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [manualInput, setManualInput] = useState("");

  useEffect(() => {
    return () => {
      if (clickTimeoutRef.current) {
        clearTimeout(clickTimeoutRef.current);
      }
    };
  }, []);

  const handleItemClick = (option: string) => {
    if (!onDoubleClick) {
      // If no double-click handler, just do single click
      onSelect(option);
      return;
    }

    if (clickTimeoutRef.current) {
      // This is a double-click
      clearTimeout(clickTimeoutRef.current);
      clickTimeoutRef.current = null;
      onDoubleClick(option);
    } else {
      // This might be a single-click, wait to see if there's another click
      clickTimeoutRef.current = setTimeout(() => {
        onSelect(option);
        clickTimeoutRef.current = null;
      }, 300); // 300ms delay to detect double-click
    }
  };

  const handleManualInputSubmit = () => {
    if (manualInput.trim()) {
      onSelect(manualInput.trim());
      setManualInput("");
    }
  };

  return (
    <Menu.Root>
      <MenuTrigger asChild>
        <Button css={{ menuHelper: {} }} disabled={disabled}>
          {selected?.slice(0, 25) || title}
          <ChevronDownIcon />
        </Button>
      </MenuTrigger>

      <Portal>
        <MenuPositioner>
          <Menu.Content
            bg="bg.surface"
            borderColor="border.default"
            boxShadow="0 4px 12px rgba(0, 0, 0, 0.1)"
          >
            {allowManualInput && (
              <>
                <VStack p={3} gap={2}>
                  <Text fontSize="sm" color="fg.muted">
                    Enter custom model name:
                  </Text>
                  <Input
                    placeholder="e.g., gpt-4-custom"
                    value={manualInput}
                    onChange={(e) => setManualInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        handleManualInputSubmit();
                      }
                    }}
                    size="sm"
                    bg="bg.canvas"
                    borderColor="border.default"
                    _focus={{
                      borderColor: "border.accent",
                      boxShadow: `0 0 0 1px token(colors.border.accent)`,
                    }}
                  />
                  <Button
                    size="xs"
                    variant="solid"
                    colorPalette="brand"
                    onClick={handleManualInputSubmit}
                    disabled={!manualInput.trim()}
                    w="full"
                  >
                    Use Custom Model
                  </Button>
                </VStack>
                <Separator />
              </>
            )}
            {options.map((option) => (
              <Menu.Item
                value={option}
                key={option}
                color="fg.default"
                _hover={{
                  bg: { base: "brand.50", _dark: "brand.950" },
                  color: { base: "brand.800", _dark: "white" },
                }}
                onClick={() => handleItemClick(option)}
                cursor={onDoubleClick ? "pointer" : "default"}
                title={
                  onDoubleClick
                    ? "Double-click to view documentation"
                    : undefined
                }
                transition="all 0.2s ease"
              >
                {option.split("-")}
              </Menu.Item>
            ))}
          </Menu.Content>
        </MenuPositioner>
      </Portal>
    </Menu.Root>
  );
};

export default MenuHelper;
