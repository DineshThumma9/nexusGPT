import { create } from "zustand";

export type FieldType = {
  value: string;
  touched: boolean;
  shakey: number;
  error?: string;
};

export type ValidationState = {
  fields: Record<string, FieldType>;

  setFieldValue: (name: string, value: string) => void;
  setFieldTouched: (name: string) => void;
  incrementShakey: (name: string) => void;
  setFieldError: (name: string, error?: string) => void;
  clearAllFields: () => void; // Added clear function
  clearField: (name: string) => void; // Added individual field clear
};

const useValidationStore = create<ValidationState>((set) => ({
  fields: {},

  setFieldValue: (name, value) =>
    set((state) => ({
      fields: {
        ...state.fields,
        [name]: {
          value: value || "", // Ensure string
          touched: state.fields[name]?.touched || false,
          shakey: state.fields[name]?.shakey || 0,
          error: state.fields[name]?.error,
        },
      },
    })),

  setFieldTouched: (name) =>
    set((state) => ({
      fields: {
        ...state.fields,
        [name]: {
          value: state.fields[name]?.value || "",
          touched: true,
          shakey: state.fields[name]?.shakey || 0,
          error: state.fields[name]?.error,
        },
      },
    })),

  setFieldError: (name, error) =>
    set((state) => ({
      fields: {
        ...state.fields,
        [name]: {
          value: state.fields[name]?.value || "",
          touched: state.fields[name]?.touched || false,
          shakey: state.fields[name]?.shakey || 0,
          error: error || undefined,
        },
      },
    })),

  incrementShakey: (name) =>
    set((state) => ({
      fields: {
        ...state.fields,
        [name]: {
          value: state.fields[name]?.value || "",
          touched: state.fields[name]?.touched || false,
          shakey: (state.fields[name]?.shakey || 0) + 1,
          error: state.fields[name]?.error,
        },
      },
    })),

  clearAllFields: () =>
    set(() => ({
      fields: {},
    })),

  clearField: (name) =>
    set((state) => {
      const newFields = { ...state.fields };
      delete newFields[name];
      return { fields: newFields };
    }),
}));

export default useValidationStore;
