// src/components/MenuHelper.tsx
import { useState, useRef, useEffect } from "react";
import { ChevronDownIcon } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "./ui/dropdown-menu";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

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
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    return () => {
      if (clickTimeoutRef.current) {
        clearTimeout(clickTimeoutRef.current);
      }
    };
  }, []);

  const handleItemClick = (e: React.MouseEvent, option: string) => {
    e.preventDefault();
    if (!onDoubleClick) {
      onSelect(option);
      setIsOpen(false);
      return;
    }

    if (clickTimeoutRef.current) {
      clearTimeout(clickTimeoutRef.current);
      clickTimeoutRef.current = null;
      onDoubleClick(option);
      setIsOpen(false);
    } else {
      clickTimeoutRef.current = setTimeout(() => {
        onSelect(option);
        setIsOpen(false);
        clickTimeoutRef.current = null;
      }, 300);
    }
  };

  const handleManualInputSubmit = () => {
    if (manualInput.trim()) {
      onSelect(manualInput.trim());
      setManualInput("");
      setIsOpen(false);
    }
  };

  const displaySelected = selected
    ? formatOption
      ? formatOption(selected)
      : selected
    : title;

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          disabled={disabled}
          className="h-8 md:h-9 text-[11px] md:text-sm px-2 md:px-3 rounded-xl border-border bg-background/50 backdrop-blur-md text-foreground hover:bg-muted"
        >
          {displaySelected.length > 25
            ? displaySelected.slice(0, 25) + "..."
            : displaySelected}
          <ChevronDownIcon className="ml-1 h-3.5 w-3.5 md:h-4 md:w-4" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="start"
        className="w-auto min-w-32 p-1.5 max-h-[400px] overflow-y-auto bg-background/90 backdrop-blur-xl border-border rounded-xl shadow-lg"
      >
        {allowManualInput && (
          <div className="flex flex-col gap-2 p-3">
            <span className="text-sm text-muted-foreground">
              Enter custom model name:
            </span>
            <Input
              placeholder="e.g., gpt-4-custom"
              value={manualInput}
              onChange={(e) => setManualInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleManualInputSubmit();
                }
              }}
              className="h-8 text-sm bg-background/50 border-border"
            />
            <Button
              size="sm"
              onClick={handleManualInputSubmit}
              disabled={!manualInput.trim()}
              className="w-full h-8"
            >
              Use Custom Model
            </Button>
            <DropdownMenuSeparator />
          </div>
        )}

        {options.map((option) => (
          <DropdownMenuItem
            key={option}
            onSelect={(e) => {
              // Prevent default to handle custom double click logic
              e.preventDefault();
            }}
            onClick={(e) => handleItemClick(e, option)}
            title={
              onDoubleClick ? "Double-click to view documentation" : undefined
            }
            className="cursor-pointer hover:bg-muted focus:bg-muted rounded-lg mx-1"
          >
            {formatOption ? formatOption(option) : option}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default MenuHelper;
