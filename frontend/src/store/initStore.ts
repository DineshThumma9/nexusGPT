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
  fetchedModels: Record<string, string[]> | null;
  lastFetchedModelsTime: number | null;

  setCurrentLLMProvider: (llm: string) => void;
  setModelMap: (modelMap: string[]) => void;
  setCurrentModel: (model: string) => void;
  setDialogOpen: (open: boolean) => void;
  setUsername: (username: string) => void;
  setEmail: (email: string) => void;
  setCurrentAPIProvider: (provider: string) => void;
  setCurrentAPIKey: (key: string) => void;
  setFetchedModels: (
    models: Record<string, string[]> | null,
    time: number | null,
  ) => void;
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
      fetchedModels: null,
      lastFetchedModelsTime: null,

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
      setFetchedModels: (models, time) =>
        set({ fetchedModels: models, lastFetchedModelsTime: time }),
      clearInit: () =>
        set({
          currentAPIKey: "",
          currentModel: "",
          currentLLMProvider: "",
          currentAPIProvider: "",
          email: "",
          username: "",
          dialogOpen: false,
          fetchedModels: null,
          lastFetchedModelsTime: null,
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
        fetchedModels: state.fetchedModels,
        lastFetchedModelsTime: state.lastFetchedModelsTime,
      }),
    },
  ),
);

export default useInitStore;
