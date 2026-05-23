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
  allowManualInput?: boolean;
  formatOption?: (option: string) => string;
}

const MenuHelper = ({
  title,
  options,
  onSelect,
  onDoubleClick,
  selected,
  disabled,
  allowManualInput,
  formatOption,
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
      onSelect(option);
      return;
    }

    if (clickTimeoutRef.current) {
      clearTimeout(clickTimeoutRef.current);
      clickTimeoutRef.current = null;
      onDoubleClick(option);
    } else {
      clickTimeoutRef.current = setTimeout(() => {
        onSelect(option);
        clickTimeoutRef.current = null;
      }, 300);
    }
  };

  const handleManualInputSubmit = () => {
    if (manualInput.trim()) {
      onSelect(manualInput.trim());
      setManualInput("");
    }
  };

  const displaySelected = selected
    ? formatOption
      ? formatOption(selected)
      : selected
    : title;

  return (
    <Menu.Root>
      <MenuTrigger asChild>
        <Button css={{ menuHelper: {} }} disabled={disabled}>
          {displaySelected.length > 25
            ? displaySelected.slice(0, 25) + "..."
            : displaySelected}
          <ChevronDownIcon />
        </Button>
      </MenuTrigger>

      <Portal>
        <MenuPositioner>
          <Menu.Content
            bg="bg.surface"
            borderColor="border.default"
            boxShadow="0 4px 12px rgba(0, 0, 0, 0.1)"
            maxH="400px"
            overflowY="auto"
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
                {formatOption ? formatOption(option) : option}
              </Menu.Item>
            ))}
          </Menu.Content>
        </MenuPositioner>
      </Portal>
    </Menu.Root>
  );
};

export default MenuHelper;
