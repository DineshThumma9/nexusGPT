import {
  Box,
  Field,
  FieldErrorText,
  FieldLabel,
  Input,
} from "@chakra-ui/react";
import { PasswordInput } from "./ui/password-input";

const InputField = ({
  label,
  placeholder,
  value,
  error,
  onChange,
  onBlur,
  touched,
  shakey,
  type = "text",
}: {
  label: string;
  placeholder: string;
  value: string;
  error: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onBlur: () => void;
  touched: boolean;
  shakey: number;
  type?: string;
}) => {
  const shouldShake = !!(error && touched);
  const isPassword =
    type === "password" || label.toLowerCase().includes("password");

  const inputStyles = {
    borderRadius: "xl",
    bg: "glass.bg",
    border: "1px solid",
    borderColor: shouldShake ? "red.500" : "border.default",
    color: "fg.default",
    _placeholder: { color: "fg.muted", fontSize: "sm" },
    _focus: {
      borderColor: "brand.500",
      boxShadow: "0 0 0 1px token(colors.brand.500)",
      bg: { base: "white", _dark: "gray.900" },
    },
    transition: "all 0.2s ease",
    animation: shakey ? "shake 0.4s ease-in-out" : "none",
    css: {
      "@keyframes shake": {
        "0%, 100%": { transform: "translateX(0)" },
        "25%": { transform: "translateX(-4px)" },
        "75%": { transform: "translateX(4px)" },
      },
    },
  };

  return (
    <Field.Root width="100%" zIndex={5} invalid={shouldShake}>
      <FieldLabel
        color="fg.default"
        fontWeight="500"
        fontSize="sm"
        fontFamily="body"
      >
        {label}
      </FieldLabel>
      <Box w="full">
        {isPassword ? (
          <PasswordInput
            placeholder={placeholder}
            value={value}
            onChange={onChange}
            onBlur={onBlur}
            {...inputStyles}
          />
        ) : (
          <Input
            placeholder={placeholder}
            value={value}
            onChange={onChange}
            onBlur={onBlur}
            type={type}
            {...inputStyles}
          />
        )}
      </Box>
      {shouldShake && (
        <FieldErrorText
          color="red.500"
          fontSize="sm"
          fontWeight="500"
          fontFamily="body"
        >
          {error}
        </FieldErrorText>
      )}
    </Field.Root>
  );
};

export default InputField;
