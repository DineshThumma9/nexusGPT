import { useState, useMemo, useEffect } from "react";
import { RefreshCw } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "./ui/tooltip";
import { Button } from "./ui/button";
import { Constants } from "../entities/Constants.ts";
import {
  apiKeySelection,
  llmSelection,
  modelSelection,
} from "../api/session-api.ts";
import { getApiModels } from "../api/setup-api.ts";
import MenuHelper from "./MenuHelper.tsx";
import useInitStore from "../store/initStore.ts";
import APIKey from "./API-Key.tsx";
import { PROVIDERS_CONFIG, type ProviderID } from "../entities/Constants.ts";

const flattenArray = (val: any): string[] => {
  if (!val) return [];
  if (typeof val === "string") return [val];
  if (Array.isArray(val)) {
    return val.reduce((acc: string[], item: any) => {
      return acc.concat(flattenArray(item));
    }, []);
  }
  return [];
};

const formatTitleCase = (str: string): string => {
  if (!str) return str;
  return str
    .split(/[\s_-]+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
};

const formatModelName = (name: string): string => {
  if (!name) return name;
  return name
    .replace(/\//g, " - ")
    .replace(/[_-]/g, " ")
    .split(" ")
    .map((word) => {
      if (!word) return word;
      if (!isNaN(Number(word))) return word;
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");
};

const LLMModelChooser = () => {
  const { providers_models, providers_dic, llms } = useMemo(
    () => Constants(),
    [],
  );

  const formatProviderID = (id: string) => {
    return (
      PROVIDERS_CONFIG[id as ProviderID]?.displayName || formatTitleCase(id)
    );
  };

  const {
    setCurrentLLMProvider,
    setCurrentAPIProvider,
    setCurrentModel,
    setModelMap,
    currentLLMProvider,
    currentAPIProvider,
    setDialogOpen,
    modelMap,
    currentModel,
    fetchedModels,
    lastFetchedModelsTime,
    setFetchedModels,
  } = useInitStore();

  const [refreshing, setRefreshing] = useState(false);

  // Merge default hardcoded models with dynamically fetched models
  const activeProviderModels = useMemo(() => {
    const merged = new Map<string, string[]>(providers_models);
    if (fetchedModels) {
      Object.entries(fetchedModels).forEach(([provider, models]) => {
        if (models && models.length > 0) {
          merged.set(provider, models);
        }
      });
    }
    return merged;
  }, [providers_models, fetchedModels]);

  const fetchModelsFromApi = async () => {
    try {
      const data = await getApiModels();
      const normalized: Record<string, string[]> = {};
      Object.entries(data).forEach(([key, val]) => {
        const normalizedKey = key as ProviderID;
        const flatModels = flattenArray(val);
        if (flatModels.length > 0) {
          normalized[normalizedKey] = flatModels;
        }
      });

      if (Object.keys(normalized).length > 0) {
        setFetchedModels(normalized, Date.now());
        console.log("Successfully updated dynamic API models:", normalized);
        return normalized;
      }
    } catch (error) {
      console.error("Failed to fetch dynamic API models:", error);
    }
    return null;
  };

  // Automatically sync persisted store configuration to the backend on page load/refresh
  useEffect(() => {
    const syncPersistedState = async () => {
      const state = useInitStore.getState();

      // 1. Sync API Key / Provider if they exist
      if (state.currentAPIProvider && state.currentAPIKey) {
        try {
          await apiKeySelection(state.currentAPIProvider, state.currentAPIKey);
        } catch (error) {
          console.error("Failed to sync API key to backend on mount:", error);
        }
      }

      // 2. Sync LLM Provider if it exists
      if (state.currentLLMProvider) {
        try {
          await llmSelection(state.currentLLMProvider);
        } catch (error) {
          console.error(
            "Failed to sync LLM provider to backend on mount:",
            error,
          );
        }
      }

      // 3. Sync Model if it exists
      if (state.currentModel && state.currentLLMProvider) {
        try {
          await modelSelection(state.currentModel, state.currentLLMProvider);
        } catch (error) {
          console.error("Failed to sync Model to backend on mount:", error);
        }
      }

      // 4. Background fetch check (once a day / 24 hours check)
      const ONE_DAY = 24 * 60 * 60 * 1000;
      const now = Date.now();
      if (
        !state.lastFetchedModelsTime ||
        !state.fetchedModels ||
        now - state.lastFetchedModelsTime > ONE_DAY
      ) {
        console.log("Cached models expired or empty. Loading fresh list...");
        await fetchModelsFromApi();
      }
    };

    syncPersistedState();
  }, []);

  useEffect(() => {
    if (!currentLLMProvider) return;

    const models = activeProviderModels.get(currentLLMProvider) ?? [];
    const isDifferent =
      models.length !== modelMap.length ||
      models.some((m, idx) => m !== modelMap[idx]);

    if (isDifferent) {
      setModelMap(models);
    }
  }, [currentLLMProvider, activeProviderModels, modelMap, setModelMap]);

  const handleAPIProviderKeySelection = (currentAPIProvider: string) => {
    setCurrentAPIProvider(currentAPIProvider);
    setDialogOpen(true);
  };

  const handleProviderSelection = async (provider: string) => {
    setCurrentLLMProvider(provider);
    const models = activeProviderModels.get(provider) || [];
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
    if (!currentLLMProvider) {
      console.warn("Cannot set model: no LLM provider selected");
      return;
    }
    try {
      await modelSelection(model, currentLLMProvider);
    } catch (error) {
      console.error("Failed to set model:", error);
    }
  };

  const handleManualRefresh = async () => {
    setRefreshing(true);
    const result = await fetchModelsFromApi();
    if (result && currentLLMProvider) {
      // If the currently selected provider got new models, refresh the models list option
      const newModels = result[currentLLMProvider] || [];
      if (newModels.length > 0) {
        setModelMap(newModels);
      }
    }
    setRefreshing(false);
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5 md:gap-3 p-1.5 md:p-2 bg-glass-bg backdrop-blur-xl border border-glass-border rounded-xl shadow-sm">
      <MenuHelper
        title={"API Provider"}
        options={llms}
        selected={currentAPIProvider}
        onSelect={handleAPIProviderKeySelection}
        formatOption={formatProviderID}
      />

      <MenuHelper
        title={"LLM Providers"}
        options={[...activeProviderModels.keys()]}
        selected={currentLLMProvider}
        onSelect={handleProviderSelection}
        onDoubleClick={handleProviderDoubleClick}
        formatOption={formatProviderID}
      />

      <MenuHelper
        title={"Models"}
        options={modelMap}
        selected={currentModel}
        onSelect={handleModelSelection}
        disabled={!currentLLMProvider || modelMap.length === 0}
        allowManualInput={true}
        formatOption={formatModelName}
      />

      <APIKey provider={currentAPIProvider} title={"API KEY"} />

      <TooltipProvider>
        <Tooltip delayDuration={400}>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleManualRefresh}
              disabled={refreshing}
              className="min-w-[28px] h-[28px] md:min-w-[32px] md:h-[32px] rounded-xl text-muted-foreground hover:bg-white/10 hover:text-foreground focus-visible:ring-1"
            >
              <RefreshCw
                className={`w-[14px] h-[14px] md:w-[16px] md:h-[16px] ${refreshing ? "animate-spin" : ""}`}
              />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">
            <p>
              {refreshing
                ? "Fetching models..."
                : "Refresh available models from your API keys"}
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
};

export default LLMModelChooser;
