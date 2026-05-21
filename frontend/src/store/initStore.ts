import { create } from "zustand";
import { persist } from "zustand/middleware";
import { Constants } from "../entities/Constants.ts";

const { providers_models } = Constants();

export type InitState = {
  currentLLMProvider: string;
  currentModel: string;
  modelMap: string[];
  currentAPIProvider: string;
  currentAPIKey: string;
  dialogOpen: boolean;
  providerModels: Map<string, string[]>;
  username: string | null;
  email: string | null;

  setCurrentLLMProvider: (llm: string) => void;
  setModelMap: (modelMap: string[]) => void;
  setCurrentModel: (model: string) => void;
  setDialogOpen: (open: boolean) => void;
  setUsername: (username: string) => void;
  setEmail: (email: string) => void;
  setCurrentAPIProvider: (provider: string) => void;
  setCurrentAPIKey: (key: string) => void;
  clearInit: () => void;
};

export const useInitStore = create<InitState>()(
  persist(
    (set) => ({
      currentLLMProvider: "",
      currentModel: "",
      currentAPIProvider: "",
      currentAPIKey: "",
      dialogOpen: false,
      modelMap: [],
      providerModels: providers_models,
      email: null,
      username: null,

      setCurrentLLMProvider: (provider) =>
        set({ currentLLMProvider: provider }),
      setModelMap: (modelMap) => set({ modelMap }),
      setCurrentModel: (model) => set({ currentModel: model }),
      setDialogOpen: (open) => set({ dialogOpen: open }),
      setEmail: (email: string) => set({ email }),
      setUsername: (username: string) => set({ username }),
      setCurrentAPIProvider: (provider) => {
        set({ currentAPIProvider: provider });
      },
      setCurrentAPIKey: (key) => {
        set({ currentAPIKey: key });
      },
      clearInit: () =>
        set({
          currentAPIKey: "",
          currentModel: "",
          currentLLMProvider: "",
          currentAPIProvider: "",
          email: "",
          username: "",
          dialogOpen: false,
        }),
    }),
    {
      name: "init-store", // key in localStorage
      partialize: (state) => ({
        currentLLMProvider: state.currentLLMProvider,
        currentModel: state.currentModel,
        email: state.email,
        username: state.username,
        currentAPIProvider: state.currentAPIProvider,
        currentAPIKey: state.currentAPIKey,
      }),
    },
  ),
);

export default useInitStore;
