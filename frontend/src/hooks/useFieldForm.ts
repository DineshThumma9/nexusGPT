import useValidationStore from "../store/validationStore.ts";
import type { ChangeEvent } from "react";

const useFieldForm = (fieldName: string) => {
  const {
    fields,
    setFieldError,
    setFieldTouched,
    setFieldValue,
    incrementShakey,
  } = useValidationStore();

  const field = fields[fieldName] || {
    value: "",
    touched: false,
    error: "",
    shakey: 0,
  };

  return {
    value: String(field.value || ""),
    touched: Boolean(field.touched),
    error: String(field.error || ""),
    shakey: Number(field.shakey || 0),
    onBlur: () => setFieldTouched(fieldName),
    onChange: (e: ChangeEvent<HTMLInputElement>) =>
      setFieldValue(fieldName, e.target.value || ""),
    setError: (err?: string) => setFieldError(fieldName, err),
    incrementShakey: () => incrementShakey(fieldName),
  };
};

export default useFieldForm;
