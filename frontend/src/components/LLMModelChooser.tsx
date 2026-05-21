import { HStack } from "@chakra-ui/react";
import { Constants } from "../entities/Constants.ts";
import {
  apiKeySelection,
  llmSelection,
  modelSelection,
} from "../api/session-api.ts";
import MenuHelper from "./MenuHelper.tsx";
import useInitStore from "../store/initStore.ts";
import APIKey from "./API-Key.tsx";
import { useEffect } from "react";

const hstack = {
  gap: 3,
  flexWrap: "wrap",
  margin: "0px",
  p: 2,
  bg: "glass.bg",
  backdropFilter: "blur(12px)",
  borderRadius: "xl",
  border: "1px solid",
  borderColor: "border.subtle",
  boxShadow: "0 4px 20px -5px rgba(0, 0, 0, 0.05)",
  alignItems: "center",
  ml: 0,
};

const LLMModelChooser = () => {
  const { providers_models, modelsProviders, providers_dic } = Constants();

  const {
    setCurrentLLMProvider,
    setCurrentAPIProvider,
    setCurrentModel,
    setModelMap,
    currentLLMProvider,
    currentAPIProvider,
    setDialogOpen,
    modelMap,
    providerModels,
    currentModel,
  } = useInitStore();

  // Automatically sync persisted store configuration to the backend on page load/refresh
  useEffect(() => {
    const syncPersistedState = async () => {
      const state = useInitStore.getState();

      // 1. Sync API Key / Provider if they exist
      if (state.currentAPIProvider && state.currentAPIKey) {
        try {
          console.log(
            `Syncing persisted API provider: ${state.currentAPIProvider}`,
          );
          await apiKeySelection(state.currentAPIProvider, state.currentAPIKey);
        } catch (error) {
          console.error("Failed to sync API key to backend on mount:", error);
        }
      }

      // 2. Sync LLM Provider if it exists
      if (state.currentLLMProvider) {
        try {
          console.log(
            `Syncing persisted LLM provider: ${state.currentLLMProvider}`,
          );
          await llmSelection(state.currentLLMProvider);
        } catch (error) {
          console.error(
            "Failed to sync LLM provider to backend on mount:",
            error,
          );
        }
      }

      // 3. Sync Model if it exists
      if (state.currentModel) {
        try {
          console.log(`Syncing persisted Model: ${state.currentModel}`);
          await modelSelection(state.currentModel);
        } catch (error) {
          console.error("Failed to sync Model to backend on mount:", error);
        }
      }
    };

    syncPersistedState();
  }, []);

  useEffect(() => {
    if (!currentLLMProvider) return;

    const models = providerModels.get(currentLLMProvider) ?? [];
    setModelMap(models);
  }, [currentLLMProvider, providerModels]);

  const handleAPIProviderKeySelection = (currentAPIProvider: string) => {
    setCurrentAPIProvider(currentAPIProvider);
    setDialogOpen(true);
  };

  const handleProviderSelection = async (provider: string) => {
    setCurrentLLMProvider(provider);
    const models = providers_models.get(provider) || [];
    setModelMap(models);
    setCurrentModel("");

    try {
      await llmSelection(provider);
    } catch (error) {
      console.error("Failed to set LLM provider:", error);
    }
  };

  const handleProviderDoubleClick = (provider: string) => {
    // Get the model documentation link for the provider
    const modelLink = providers_dic.get(provider)?.model_link;

    if (modelLink) {
      // Open the model documentation page in a new tab
      window.open(modelLink, "_blank", "noopener,noreferrer");
    }
  };

  const handleModelSelection = async (model: string) => {
    setCurrentModel(model);
    try {
      await modelSelection(model);
    } catch (error) {
      console.error("Failed to set model:", error);
    }
  };

  return (
    <HStack {...hstack}>
      <MenuHelper
        title={"API Provider"}
        options={modelsProviders}
        selected={currentAPIProvider}
        onSelect={handleAPIProviderKeySelection}
      />

      <MenuHelper
        title={"LLM Providers"}
        options={[...providerModels.keys()]}
        selected={currentLLMProvider}
        onSelect={handleProviderSelection}
        onDoubleClick={handleProviderDoubleClick}
      />

      <MenuHelper
        title={"Models"}
        options={modelMap}
        selected={currentModel}
        onSelect={handleModelSelection}
        disabled={!currentLLMProvider || modelMap.length === 0}
        allowManualInput={true}
      />

      <APIKey provider={currentAPIProvider} title={"API KEY"} />
    </HStack>
  );
};

export default LLMModelChooser;
