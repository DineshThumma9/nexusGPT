"use client";

import { createListCollection, Select } from "@chakra-ui/react";

interface Props {
  value: string[];
  setValue: (value: string[]) => void;
}

const SelectOptions = ({ value, setValue }: Props) => {
  return (
    <Select.Root
      collection={include_exclude}
      value={value}
      onValueChange={(details) => {
        setValue(details.value); // 👈 use item.value
      }}
      width="200px"
    >
      <Select.HiddenSelect />
      <Select.Label color={"fg"} fontSize="sm" fontWeight="medium">
        Include/Exclude
      </Select.Label>
      <Select.Control>
        <Select.Trigger
          bg={"bg.panel"}
          border="1px solid"
          borderColor={"border.subtle"}
          borderRadius="12px"
          color={"fg"}
          px={4}
          py={3}
          fontSize="sm"
          fontWeight="medium"
          _hover={{
            borderColor: "border",
            bg: "bg.subtle",
            transform: "scale(1.02)",
          }}
          _focus={{
            borderColor: "border.emphasized",
            boxShadow: `0 0 0 1px ${"border.emphasized"}`,
          }}
          _active={{
            transform: "scale(0.98)",
          }}
          transition="all 0.2s ease"
        >
          <Select.ValueText
            placeholder="Select option"
            color={"fg"}
            _placeholder={{ color: "fg.muted" }}
          />
        </Select.Trigger>
        <Select.IndicatorGroup>
          <Select.Indicator color={"fg"} />
        </Select.IndicatorGroup>
      </Select.Control>
      <Select.Positioner>
        <Select.Content
          bg={"bg.panel"}
          backdropFilter="blur(10px)"
          border="1px solid"
          borderColor={"border.subtle"}
          borderRadius="12px"
          boxShadow={`0 10px 40px ${"lg"}`}
          py={2}
          minW="200px"
        >
          {include_exclude.items.map((option) => (
            <Select.Item
              key={option.value}
              item={option}
              color={"fg"}
              px={3}
              py={2}
              borderRadius="8px"
              mx={1}
              fontWeight="medium"
              _hover={{
                bg: "bg.subtle",
                transform: "scale(1.02)",
              }}
              _selected={{
                bg: "bg.muted",
                fontWeight: "bold",
              }}
              transition="all 0.2s ease"
            >
              {option.label}
              <Select.ItemIndicator color={"colorPalette.500"} />
            </Select.Item>
          ))}
        </Select.Content>
      </Select.Positioner>
    </Select.Root>
  );
};

const include_exclude = createListCollection({
  items: [
    { label: "Include", value: "Include" },
    { label: "Exclude", value: "Exclude" },
  ],
});

export default SelectOptions;
