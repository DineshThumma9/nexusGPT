export const Constants = () => {
  const togetherModels: string[] = [
    "meta-llama/Llama-3.3-70B-Instruct-Turbo",
    "meta-llama/Llama-3.1-405B-Turbo",
    "mistralai/Mixtral-8x7B-Instruct-v0.1",
    "deepseek-ai/DeepSeek-V3-0324",
    "gemma/Gemma-3-27B",
  ];

  const mistralModels: string[] = [
    "mistral-large-latest",
    "mistral-small-latest",
    "codestral-latest",
  ];

  const openaiModels: string[] = [
    "gpt-4o",
    "gpt-4o-mini",
    "o1",
    "o1-mini",
    "gpt-3.5-turbo",
  ];

  const qwenModels: string[] = ["Qwen3-72B-Instruct", "QwQ-32B"];

  const geminiModels: string[] = [
    "gemini-2.5-pro",
    "gemini-2.5-flash",
    "gemini-2.0-flash",
    "gemini-1.5-flash",
    "gemini-1.5-pro",
  ];

  const anthropicModels: string[] = [
    "claude-3-5-sonnet-latest",
    "claude-3-5-haiku-latest",
    "claude-3-opus-latest",
  ];

  const openrouterModels: string[] = [
    "deepseek/deepseek-chat:free",
    "google/gemini-2.5-flash",
    "meta-llama/llama-3.3-70b-instruct",
    "qwen/qwen3-coder:free",
    "deepseek/deepseek-r1:free",
  ];

  const ollamaModels: string[] = [
    "llama3",
    "llama3.1:latest",
    "mistral",
    "qwen2.5-coder",
    "deepseek-coder",
  ];

  const huggingfaceModels: string[] = [
    "meta-llama/Llama-3.2-3B-Instruct",
    "mistralai/Mistral-7B-Instruct-v0.3",
  ];

  const groqModels: string[] = [
    "llama-3.3-70b-versatile",
    "llama-3.1-70b-versatile",
    "llama3-70b-8192",
    "llama3-8b-8192",
    "mixtral-8x7b-32768",
    "gemma2-9b-it",
  ];

  const modelsProviders: string[] = [
    "Openai",
    "Google GenAI",
    "Anthropic",
    "Ollama",
    "Mistral",
    "Openrouter",
    "Hugging Face",
    "Groq",
  ];

  const llms: string[] = [
    "openai",
    "google_genai",
    "anthropic",
    "ollama",
    "mistralai",
    "openrouter",
    "huggingface",
    "groq",
  ];

  const providers_api_link = new Map<string, string>([
    ["openai", "https://platform.openai.com/api-keys"],
    ["google genai", "https://aistudio.google.com/app/apikey"],
    ["google_genai", "https://aistudio.google.com/app/apikey"],
    ["gemini", "https://aistudio.google.com/app/apikey"],
    ["anthropic", "https://console.anthropic.com/settings/keys"],
    ["ollama", "https://ollama.com/"],
    ["mistral", "https://console.mistral.ai/api-keys"],
    ["mistralai", "https://console.mistral.ai/api-keys"],
    ["openrouter", "https://openrouter.ai/settings/keys"],
    ["hugging face", "https://huggingface.co/settings/tokens"],
    ["huggingface", "https://huggingface.co/settings/tokens"],
    ["groq", "https://console.groq.com/keys"],
  ]);

  const api_providers_models = new Map<string, string>([
    ["openai", "https://platform.openai.com/docs/models"],
    ["google genai", "https://ai.google.dev/gemini-api/docs/models"],
    ["google_genai", "https://ai.google.dev/gemini-api/docs/models"],
    ["gemini", "https://ai.google.dev/gemini-api/docs/models"],
    ["anthropic", "https://docs.anthropic.com/en/docs/about-claude/models"],
    ["ollama", "https://ollama.com/library"],
    ["mistral", "https://docs.mistral.ai/getting-started/models/"],
    ["mistralai", "https://docs.mistral.ai/getting-started/models/"],
    ["openrouter", "https://openrouter.ai/models"],
    ["hugging face", "https://huggingface.co/models"],
    ["huggingface", "https://huggingface.co/models"],
    ["groq", "https://console.groq.com/docs/models"],
  ]);

  type ProviderInfo = {
    models: string[];
    api_link: string;
    model_link: string;
  };

  const providers_dic = new Map<string, ProviderInfo>([
    [
      "openai",
      {
        models: openaiModels,
        api_link: providers_api_link.get("openai")!,
        model_link: api_providers_models.get("openai")!,
      },
    ],
    [
      "google_genai",
      {
        models: geminiModels,
        api_link: providers_api_link.get("google_genai")!,
        model_link: api_providers_models.get("google_genai")!,
      },
    ],
    [
      "google genai",
      {
        models: geminiModels,
        api_link: providers_api_link.get("google genai")!,
        model_link: api_providers_models.get("google genai")!,
      },
    ],
    [
      "gemini",
      {
        models: geminiModels,
        api_link: providers_api_link.get("gemini")!,
        model_link: api_providers_models.get("gemini")!,
      },
    ],
    [
      "anthropic",
      {
        models: anthropicModels,
        api_link: providers_api_link.get("anthropic")!,
        model_link: api_providers_models.get("anthropic")!,
      },
    ],
    [
      "ollama",
      {
        models: ollamaModels,
        api_link: providers_api_link.get("ollama")!,
        model_link: api_providers_models.get("ollama")!,
      },
    ],
    [
      "mistralai",
      {
        models: mistralModels,
        api_link: providers_api_link.get("mistralai")!,
        model_link: api_providers_models.get("mistralai")!,
      },
    ],
    [
      "mistral",
      {
        models: mistralModels,
        api_link: providers_api_link.get("mistral")!,
        model_link: api_providers_models.get("mistral")!,
      },
    ],
    [
      "openrouter",
      {
        models: openrouterModels,
        api_link: providers_api_link.get("openrouter")!,
        model_link: api_providers_models.get("openrouter")!,
      },
    ],
    [
      "huggingface",
      {
        models: huggingfaceModels,
        api_link: providers_api_link.get("huggingface")!,
        model_link: api_providers_models.get("huggingface")!,
      },
    ],
    [
      "hugging face",
      {
        models: huggingfaceModels,
        api_link: providers_api_link.get("hugging face")!,
        model_link: api_providers_models.get("hugging face")!,
      },
    ],
    [
      "groq",
      {
        models: groqModels,
        api_link: providers_api_link.get("groq")!,
        model_link: api_providers_models.get("groq")!,
      },
    ],
  ]);

  const providers_models = new Map<string, string[]>([
    ["openai", openaiModels],
    ["google genai", geminiModels],
    ["anthropic", anthropicModels],
    ["ollama", ollamaModels],
    ["mistral", mistralModels],
    ["openrouter", openrouterModels],
    ["hugging face", huggingfaceModels],
    ["groq", groqModels],
  ]);

  return {
    llms,
    providers_dic,
    providers_api_link,
    providers_models,
    ollamaModels,
    openrouterModels,
    modelsProviders,
  };
};
