export type ProviderID =
  | "openai"
  | "google_genai"
  | "anthropic"
  | "mistralai"
  | "openrouter"
  | "huggingface"
  | "groq";

export type ProviderConfig = {
  id: ProviderID;
  displayName: string;
  apiLink: string;
  modelLink: string;
  defaultModels: string[];
};

export const PROVIDERS_CONFIG: Record<ProviderID, ProviderConfig> = {
  openai: {
    id: "openai",
    displayName: "OpenAI",
    apiLink: "https://platform.openai.com/api-keys",
    modelLink: "https://platform.openai.com/docs/models",
    defaultModels: ["gpt-4o", "gpt-4o-mini", "o1", "o1-mini", "gpt-3.5-turbo"],
  },
  google_genai: {
    id: "google_genai",
    displayName: "Google GenAI",
    apiLink: "https://aistudio.google.com/app/apikey",
    modelLink: "https://ai.google.dev/gemini-api/docs/models",
    defaultModels: [
      "gemini-2.5-pro",
      "gemini-2.5-flash",
      "gemini-2.0-flash",
      "gemini-1.5-flash",
      "gemini-1.5-pro",
    ],
  },
  anthropic: {
    id: "anthropic",
    displayName: "Anthropic",
    apiLink: "https://console.anthropic.com/settings/keys",
    modelLink: "https://docs.anthropic.com/en/docs/about-claude/models",
    defaultModels: [
      "claude-3-5-sonnet-latest",
      "claude-3-5-haiku-latest",
      "claude-3-opus-latest",
    ],
  },
  mistralai: {
    id: "mistralai",
    displayName: "Mistral",
    apiLink: "https://console.mistral.ai/api-keys",
    modelLink: "https://docs.mistral.ai/getting-started/models/",
    defaultModels: [
      "mistral-large-latest",
      "mistral-small-latest",
      "codestral-latest",
    ],
  },
  openrouter: {
    id: "openrouter",
    displayName: "Openrouter",
    apiLink: "https://openrouter.ai/settings/keys",
    modelLink: "https://openrouter.ai/models",
    defaultModels: [
      "deepseek/deepseek-chat:free",
      "google/gemini-2.5-flash",
      "meta-llama/llama-3.3-70b-instruct",
      "qwen/qwen3-coder:free",
      "deepseek/deepseek-r1:free",
    ],
  },
  huggingface: {
    id: "huggingface",
    displayName: "Hugging Face",
    apiLink: "https://huggingface.co/settings/tokens",
    modelLink: "https://huggingface.co/models",
    defaultModels: [
      "meta-llama/Llama-3.2-3B-Instruct",
      "mistralai/Mistral-7B-Instruct-v0.3",
    ],
  },
  groq: {
    id: "groq",
    displayName: "Groq",
    apiLink: "https://console.groq.com/keys",
    modelLink: "https://console.groq.com/docs/models",
    defaultModels: [
      "llama-3.3-70b-versatile",
      "llama-3.1-70b-versatile",
      "llama3-70b-8192",
      "llama3-8b-8192",
      "mixtral-8x7b-32768",
      "gemma2-9b-it",
    ],
  },
};

export const Constants = () => {
  const llms = Object.keys(PROVIDERS_CONFIG) as string[];
  const modelsProviders = Object.values(PROVIDERS_CONFIG).map(
    (p) => p.displayName,
  );

  const providers_api_link = new Map<string, string>();
  const api_providers_models = new Map<string, string>();
  const providers_models = new Map<string, string[]>();

  type ProviderInfo = {
    models: string[];
    api_link: string;
    model_link: string;
  };
  const providers_dic = new Map<string, ProviderInfo>();

  Object.values(PROVIDERS_CONFIG).forEach((config) => {
    // Only map the definitive, standardized ID
    providers_api_link.set(config.id, config.apiLink);
    api_providers_models.set(config.id, config.modelLink);
    providers_models.set(config.id, config.defaultModels);

    providers_dic.set(config.id, {
      models: config.defaultModels,
      api_link: config.apiLink,
      model_link: config.modelLink,
    });
  });

  return {
    llms,
    providers_dic,
    providers_api_link,
    providers_models,
    modelsProviders,
    openrouterModels: PROVIDERS_CONFIG.openrouter.defaultModels,
  };
};
