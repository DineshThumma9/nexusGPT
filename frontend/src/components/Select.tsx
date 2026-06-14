"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Label } from "./ui/label";

interface Props {
  value: string[];
  setValue: (value: string[]) => void;
}

const include_exclude = [
  { label: "Include", value: "Include" },
  { label: "Exclude", value: "Exclude" },
];

const SelectOptions = ({ value, setValue }: Props) => {
  // Shadcn select uses string for single select, but value is string[]. We take the first element if it exists.
  const currentValue = value.length > 0 ? value[0] : "";

  return (
    <div className="flex flex-col gap-2 w-[200px]">
      <Label className="text-sm font-medium text-foreground">
        Include/Exclude
      </Label>
      <Select
        value={currentValue}
        onValueChange={(val) => {
          setValue([val]);
        }}
      >
        <SelectTrigger className="w-full bg-background border-border rounded-xl px-4 py-3 h-auto hover:bg-muted focus:ring-1 focus:ring-ring transition-all">
          <SelectValue placeholder="Select option" />
        </SelectTrigger>
        <SelectContent className="bg-background/80 backdrop-blur-md border-border rounded-xl">
          {include_exclude.map((option) => (
            <SelectItem
              key={option.value}
              value={option.value}
              className="rounded-lg cursor-pointer transition-colors"
            >
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};

export default SelectOptions;
