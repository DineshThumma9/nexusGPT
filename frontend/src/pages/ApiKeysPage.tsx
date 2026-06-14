import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BiTrash, BiEdit, BiArrowBack, BiCopy, BiCheck } from "react-icons/bi";
import { getApiConfigs, setApiProvider } from "../api/setup-api";
import type { ApiConfig } from "../api/setup-api";

import { PROVIDERS_CONFIG } from "../entities/Constants";

import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { Loader2 } from "lucide-react";

const ApiKeysPage = () => {
  const navigate = useNavigate();
  const [keys, setKeys] = useState<ApiConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Form state
  const [selectedProvider, setSelectedProvider] = useState("");
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [apiKeyError, setApiKeyError] = useState<string | null>(null);

  const fetchKeys = async () => {
    try {
      setLoading(true);
      const data = await getApiConfigs();
      setKeys(data);
    } catch (err) {
      console.error("Failed to load API keys:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchKeys();
  }, []);

  const handleSave = async () => {
    if (!selectedProvider) return;
    setApiKeyError(null);
    try {
      setIsSubmitting(true);
      await setApiProvider(selectedProvider, apiKeyInput);
      await fetchKeys();
      // Reset form
      setApiKeyInput("");
      setSelectedProvider("");
      setIsEditing(false);
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      if (detail?.error_type === "invalid_api_key") {
        setApiKeyError(detail.message || "Invalid API key");
      } else {
        console.error("Failed to save key:", err);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (provider: string) => {
    try {
      setLoading(true);
      await setApiProvider(provider, "");
      await fetchKeys();
      if (selectedProvider === provider) {
        setSelectedProvider("");
        setApiKeyInput("");
        setIsEditing(false);
      }
    } catch (err) {
      console.error("Failed to delete key:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (config: ApiConfig) => {
    setSelectedProvider(config.provider);
    setApiKeyInput(config.encrypted_key);
    setIsEditing(true);
  };

  const handleCopy = (provider: string, val: string) => {
    navigator.clipboard.writeText(val);
    setCopiedId(provider);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getUnusedProviders = () => {
    const usedProviders = new Set(keys.map((k) => k.provider));
    return Object.values(PROVIDERS_CONFIG).filter(
      (p) => !usedProviders.has(p.id),
    );
  };

  const getDisplayName = (id: string) => {
    if (!id) return "";
    const config = Object.values(PROVIDERS_CONFIG).find((p) => p.id === id);
    return config ? config.displayName : id.toUpperCase();
  };

  // Mask the API key for display
  const maskKey = (key: string) => {
    if (!key) return "Not Set / Empty";
    if (key.length <= 8) return "********";
    return key.substring(0, 4) + "..." + key.substring(key.length - 4);
  };

  return (
    <div className="min-h-screen bg-background py-4 md:py-8 px-4 md:px-8 lg:px-12">
      <div className="max-w-7xl mx-auto p-0">
        {/* Header */}
        <div className="flex justify-between items-center mb-4 md:mb-8 border-b border-border pb-4 md:pb-6">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full hover:bg-muted"
              onClick={() => navigate(-1)}
              aria-label="Go back"
            >
              <BiArrowBack size={20} />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-foreground">
                API Keys Dashboard
              </h1>
              <div className="text-sm text-muted-foreground mt-1">
                Manage credentials and endpoints for LLM providers securely
              </div>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-12 h-12 animate-spin text-primary" />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Left Side: Keys Grid (8 columns) */}
            <div className="col-span-1 lg:col-span-8">
              <div className="flex flex-col gap-6">
                <div className="text-lg font-semibold text-foreground">
                  Active Providers ({keys.length})
                </div>

                {keys.length === 0 ? (
                  <div className="p-6 md:p-12 bg-panel rounded-2xl border border-dashed border-border text-center backdrop-blur-xl">
                    <div className="text-base text-muted-foreground mb-4">
                      No API keys configured yet.
                    </div>
                    <div className="text-sm text-muted-foreground/80">
                      Use the form on the right to configure your first provider
                      key.
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {keys.map((config) => (
                      <div
                        key={config.provider}
                        className="p-4 md:p-6 bg-panel rounded-2xl border border-border shadow-md backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:border-primary/50"
                      >
                        <div className="flex flex-col gap-4">
                          <div className="flex justify-between items-center">
                            <div className="font-bold text-base text-primary tracking-wider">
                              {getDisplayName(config.provider)}
                            </div>
                            <div className="flex gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 rounded-lg"
                                onClick={() => handleEdit(config)}
                                aria-label="Edit Key"
                              >
                                <BiEdit size={16} />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 rounded-lg text-red-500 hover:text-red-600 hover:bg-red-100/10 dark:hover:bg-red-900/20"
                                onClick={() => handleDelete(config.provider)}
                                aria-label="Delete Key"
                              >
                                <BiTrash size={16} />
                              </Button>
                            </div>
                          </div>

                          <div className="flex justify-between items-center bg-muted p-3 rounded-xl border border-border gap-2">
                            <div className="font-mono text-xs text-foreground overflow-hidden text-ellipsis whitespace-nowrap">
                              {maskKey(config.encrypted_key)}
                            </div>
                            {config.encrypted_key && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 rounded-md shrink-0"
                                onClick={() =>
                                  handleCopy(
                                    config.provider,
                                    config.encrypted_key,
                                  )
                                }
                                aria-label="Copy Key"
                              >
                                {copiedId === config.provider ? (
                                  <BiCheck size={16} className="text-primary" />
                                ) : (
                                  <BiCopy size={14} />
                                )}
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Right Side: Add / Update Form (4 columns) */}
            <div className="col-span-1 lg:col-span-4">
              <div
                className={`p-4 md:p-6 bg-panel rounded-2xl border ${
                  isEditing ? "border-primary/50" : "border-border"
                } shadow-lg backdrop-blur-xl sticky top-8`}
              >
                <div className="flex flex-col gap-5">
                  <div className="text-lg font-semibold text-foreground">
                    {isEditing ? "Update API Key" : "Add Provider Key"}
                  </div>

                  {isEditing ? (
                    <div className="p-3 bg-primary/10 text-primary rounded-xl text-xs font-medium">
                      Editing API key for{" "}
                      <span className="font-bold">
                        {getDisplayName(selectedProvider)}
                      </span>
                    </div>
                  ) : (
                    <div>
                      <div className="mb-2 font-medium text-sm text-foreground">
                        Provider
                      </div>
                      <Select
                        value={selectedProvider}
                        onValueChange={setSelectedProvider}
                      >
                        <SelectTrigger className="w-full h-12 rounded-xl bg-muted border-border font-normal text-sm">
                          <SelectValue placeholder="Select a provider" />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                          {getUnusedProviders().map((p) => (
                            <SelectItem
                              key={p.id}
                              value={p.id}
                              className="rounded-md"
                            >
                              {p.displayName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <div>
                    <div className="mb-2 font-medium text-sm text-foreground">
                      API Key
                    </div>
                    <Input
                      placeholder="sk-..."
                      value={apiKeyInput}
                      onChange={(e) => {
                        setApiKeyInput(e.target.value);
                        if (apiKeyError) setApiKeyError(null); // clear on edit
                      }}
                      type="password"
                      className={`h-12 rounded-xl bg-muted border ${
                        apiKeyError
                          ? "border-red-500 focus-visible:ring-red-500"
                          : "border-border"
                      }`}
                    />
                    {apiKeyError && (
                      <div className="mt-1.5 text-xs text-red-500 font-medium flex items-center gap-1">
                        ⚠ {apiKeyError}
                      </div>
                    )}
                  </div>

                  <div className="flex gap-3 pt-2">
                    {isEditing && (
                      <Button
                        variant="ghost"
                        className="flex-1 rounded-xl"
                        onClick={() => {
                          setIsEditing(false);
                          setSelectedProvider("");
                          setApiKeyInput("");
                        }}
                      >
                        Cancel
                      </Button>
                    )}
                    <Button
                      className="flex-[2] rounded-xl text-primary-foreground"
                      disabled={
                        !selectedProvider || !apiKeyInput.trim() || isSubmitting
                      }
                      onClick={handleSave}
                    >
                      {isSubmitting && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      {isEditing ? "Update Key" : "Save Key"}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ApiKeysPage;
