import React, { useState } from "react";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { EyeIcon, EyeOffIcon } from "lucide-react";

interface InputFieldProps {
  label: string;
  placeholder: string;
  value: string;
  error: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onBlur: () => void;
  touched: boolean;
  shakey: number;
  type?: string;
}

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
}: InputFieldProps) => {
  const shouldShake = !!(error && touched);
  const isPassword =
    type === "password" || label.toLowerCase().includes("password");

  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="flex flex-col gap-2 w-full relative z-10">
      <Label className="text-foreground font-medium text-sm">{label}</Label>
      <div
        className="relative w-full"
        style={{
          animation: shouldShake && shakey ? "shake 0.4s ease-in-out" : "none",
        }}
      >
        <Input
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          type={isPassword ? (showPassword ? "text" : "password") : type}
          className={`rounded-xl bg-background border text-foreground placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-primary transition-all duration-200 ${
            shouldShake
              ? "border-destructive focus-visible:border-destructive focus-visible:ring-destructive"
              : "border-input hover:border-muted-foreground/40 focus-visible:border-primary"
          }`}
        />
        {isPassword && (
          <button
            type="button"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus:outline-none"
            onClick={() => setShowPassword(!showPassword)}
          >
            {showPassword ? (
              <EyeOffIcon className="h-4 w-4" />
            ) : (
              <EyeIcon className="h-4 w-4" />
            )}
          </button>
        )}
      </div>
      {shouldShake && (
        <span className="text-red-500 text-sm font-medium mt-1">{error}</span>
      )}
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-4px); }
          75% { transform: translateX(4px); }
        }
      `,
        }}
      />
    </div>
  );
};

export default InputField;
