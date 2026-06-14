"use client";

import React, { useState, useEffect } from "react";
import { getMcpConfig, saveMcpConfig, getMcpToolCount } from "../api/setup-api";
import { toast } from "sonner";
import {
  FiSave,
  FiX,
  FiCheck,
  FiAlertTriangle,
  FiCode,
  FiEye,
} from "react-icons/fi";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { ScrollArea } from "./ui/scroll-area";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "./ui/accordion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import {
  Trash2,
  Plus,
  Server,
  Key,
  Link as LinkIcon,
  Edit3,
  Power,
} from "lucide-react";
import { Switch } from "./ui/switch";

interface Props {
  onClose: () => void;
  onError?: () => void; // called when background save fails so parent can show red indicator
}

const PLACEHOLDER_JSON = `[
  {
    "type": "http",
    "server_url": "",
    "auth_header": "Authorization",
    "api_key": "",
    "is_active": false
  }
]`;

export const McpConfigDialog = ({ onClose, onError }: Props) => {
  const [rawJson, setRawJson] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<string>("visual");
  const [toolCount, setToolCount] = useState<{
    total_available: number;
    active: number;
  } | null>(null);

  // Validation states
  const [isValid, setIsValid] = useState(true);
  const [validationError, setValidationError] = useState("");

  useEffect(() => {
    fetchConfig();
    fetchToolCount();
  }, []);

  const fetchToolCount = async () => {
    try {
      const count = await getMcpToolCount();
      setToolCount(count);
    } catch (error) {
      console.error("Failed to fetch MCP tool count:", error);
    }
  };

  const fetchConfig = async () => {
    setLoading(true);
    try {
      const data = await getMcpConfig();
      setRawJson(JSON.stringify(data, null, 2));
    } catch (error) {
      console.error("Failed to fetch MCP config:", error);
      toast.error("Failed to load MCP server configuration.");
      // Fallback to empty default structure
      setRawJson(PLACEHOLDER_JSON);
    } finally {
      setLoading(false);
    }
  };

  // Real-time JSON validation
  useEffect(() => {
    const trimmed = rawJson.trim();
    if (!trimmed) {
      setIsValid(true);
      setValidationError("");
      return;
    }
    try {
      const parsed = JSON.parse(trimmed);
      if (typeof parsed !== "object" || parsed === null) {
        setIsValid(false);
        setValidationError("JSON must be an object");
      } else {
        setIsValid(true);
        setValidationError("");
      }
    } catch (err: any) {
      setIsValid(false);
      setValidationError(err.message || "Invalid JSON syntax");
    }
  }, [rawJson]);

  const handleFormatJson = () => {
    try {
      const parsed = JSON.parse(rawJson);
      setRawJson(JSON.stringify(parsed, null, 2));
      toast.success("JSON formatted successfully.");
    } catch (err: any) {
      toast.error(err.message || "Invalid JSON, cannot format.");
    }
  };

  const handleAddTemplate = (templateName: string) => {
    let currentArr: any[] = [];
    try {
      if (rawJson.trim()) {
        const parsed = JSON.parse(rawJson);
        if (Array.isArray(parsed)) {
          currentArr = parsed;
        } else if (typeof parsed === "object" && parsed !== null) {
          // Fallback if they had old object structure
          currentArr = [];
        }
      }
    } catch (e) {
      // Ignore parse failure, we start with empty structure
    }

    const templates: Record<string, any> = {
      "remote-search": {
        type: "http",
        server_url: "https://mcp.brave.com/sse",
        auth_header: "Authorization",
        api_key: "Bearer YOUR_API_KEY",
      },

      "github-mcp": {
        type: "http",
        server_url: "https://api.githubcopilot.com/mcp/",
        auth_header: "Authorization",
        api_key: "Bearer <API_KEY>",
      },
    };

    const templateToAdd = templates[templateName] || {
      type: "http",
      server_url: "https://api.example.com/mcp",
      auth_header: "Authorization",
      api_key: "",
      is_active: false,
    };

    currentArr.push(templateToAdd);
    setRawJson(JSON.stringify(currentArr, null, 2));

    toast.info(`Added ${templateName} server config template.`);
  };

  // Helper to parse safely for visual builder
  const parsedServers = React.useMemo(() => {
    if (!isValid || !rawJson.trim()) return [];
    try {
      const parsed = JSON.parse(rawJson);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }, [rawJson, isValid]);

  const updateServerField = (index: number, field: string, value: any) => {
    try {
      const updated = [...parsedServers];
      updated[index] = { ...updated[index], [field]: value };
      setRawJson(JSON.stringify(updated, null, 2));
    } catch (e) {
      toast.error("Failed to update visual configuration.");
    }
  };

  const handleToggleActive = async (index: number, checked: boolean) => {
    try {
      const updated = [...parsedServers];
      updated[index] = { ...updated[index], is_active: checked };
      const newJson = JSON.stringify(updated, null, 2);
      setRawJson(newJson);

      try {
        await saveMcpConfig(updated);
        toast.success(
          `Server ${checked ? "activated" : "deactivated"} successfully.`,
        );
        fetchToolCount();
      } catch (error: any) {
        setRawJson(JSON.stringify(parsedServers, null, 2));
        toast.error("Failed to toggle server state.");
        onError?.();
      }
    } catch (e) {
      toast.error("Failed to update configuration.");
    }
  };

  const updateServerFields = (
    index: number,
    updates: Record<string, string>,
  ) => {
    try {
      const updated = [...parsedServers];
      updated[index] = { ...updated[index], ...updates };
      setRawJson(JSON.stringify(updated, null, 2));
    } catch (e) {
      toast.error("Failed to update visual configuration.");
    }
  };

  const removeServer = (index: number) => {
    try {
      const updated = parsedServers.filter((_, i) => i !== index);
      setRawJson(JSON.stringify(updated, null, 2));
      toast.success("Removed server configuration.");
    } catch (e) {
      toast.error("Failed to remove configuration.");
    }
  };

  const handleSave = async () => {
    if (!isValid) {
      toast.error("Cannot save invalid JSON configuration.");
      return;
    }

    // Optimistic UI: immediately close and show success
    const parsedConfig = rawJson.trim() ? JSON.parse(rawJson) : [];
    onClose();
    toast.success("MCP Server configuration updated successfully.");

    // Fire API request in the background
    saveMcpConfig(parsedConfig).catch((error: any) => {
      console.error("Failed to save MCP config:", error);
      let errorMsg = "Could not write configuration to disk.";
      if (error.response?.data?.detail) {
        if (Array.isArray(error.response.data.detail)) {
          errorMsg = error.response.data.detail
            .map((e: any) => `${e.loc?.join(".") || "Field"}: ${e.msg}`)
            .join(", ");
        } else {
          errorMsg = String(error.response.data.detail);
        }
      }
      // Signal parent to show red border on the MCP icon
      onError?.();
      toast.error(errorMsg);
    });
  };

  return (
    <Dialog open={true} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-[700px] w-[95vw] p-0 rounded-xl overflow-hidden border-border/50 bg-background/95 backdrop-blur-xl shadow-xl">
        <DialogHeader className="p-6 pb-2 flex flex-row items-center justify-between space-y-0">
          <DialogTitle className="text-xl font-semibold tracking-tight flex items-center gap-3">
            MCP Servers Configuration
            {toolCount && (
              <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium border border-primary/20">
                <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse"></span>
                {toolCount.active} / {toolCount.total_available} Tools Active
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="p-6 pt-2 text-foreground space-y-4">
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="w-full"
          >
            <TabsList className="inline-flex w-full justify-start! border-b border-border/50 bg-transparent p-0 mb-4 h-auto rounded-none">
              <TabsTrigger
                value="visual"
                className="relative h-10 rounded-none border-b-2 border-transparent bg-transparent px-4 pb-3 pt-2 font-semibold text-muted-foreground shadow-none transition-none data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=active]:shadow-none data-[state=active]:bg-transparent"
              >
                <FiEye className="mr-2" /> Visual Builder
              </TabsTrigger>
              <TabsTrigger
                value="edit"
                className="relative h-10 rounded-none border-b-2 border-transparent bg-transparent px-4 pb-3 pt-2 font-semibold text-muted-foreground shadow-none transition-none data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=active]:shadow-none data-[state=active]:bg-transparent"
              >
                <FiCode className="mr-2" /> Raw JSON
              </TabsTrigger>
            </TabsList>

            <TabsContent value="edit" className="mt-0 outline-none">
              <div className="flex flex-col gap-3">
                {/* Textarea Editor */}
                <div className="relative">
                  {loading ? (
                    <div className="flex flex-col p-4 h-[350px] bg-card rounded-xl border border-border gap-4 animate-pulse">
                      <div className="h-5 bg-muted rounded w-[90%]" />
                      <div className="h-5 bg-muted rounded w-[70%]" />
                      <div className="h-5 bg-muted rounded w-[85%]" />
                    </div>
                  ) : (
                    <textarea
                      value={rawJson}
                      onChange={(e) => setRawJson(e.target.value)}
                      disabled={loading}
                      className={`w-full h-[350px] p-4 rounded-xl bg-black/20 text-foreground font-mono text-sm leading-relaxed outline-none resize-none transition-all duration-200 border ${
                        isValid ? "border-border" : "border-destructive"
                      }`}
                      placeholder={PLACEHOLDER_JSON}
                    />
                  )}
                </div>

                {/* Prettifier and validation warning */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 w-full">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleFormatJson}
                    disabled={loading || !rawJson.trim()}
                  >
                    Format JSON
                  </Button>

                  {/* Validation Status Indicator */}
                  <div className="flex items-center gap-1.5">
                    {isValid ? (
                      <>
                        <FiCheck className="text-green-500" size={14} />
                        <span className="text-xs text-green-500 font-medium">
                          Valid JSON
                        </span>
                      </>
                    ) : (
                      <>
                        <FiAlertTriangle className="text-red-500" size={14} />
                        <span
                          className="text-xs text-red-500 font-medium max-w-[300px] truncate"
                          title={validationError}
                        >
                          {validationError}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                <div className="h-px bg-border my-1" />

                {/* Templates Helper Bar */}
                <div className="flex flex-col gap-2">
                  <span className="text-xs font-semibold text-muted-foreground">
                    Quick Add Server Templates:
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {["remote-search", "remote-postgres", "custom-http"].map(
                      (t) => (
                        <Button
                          key={t}
                          size="sm"
                          variant="secondary"
                          onClick={() => handleAddTemplate(t)}
                          className="rounded-lg h-7 px-3 text-xs"
                        >
                          <Plus className="w-3 h-3 mr-1" /> {t}
                        </Button>
                      ),
                    )}
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="visual" className="mt-0 outline-none">
              <ScrollArea className="h-[450px] pr-4 bg-background">
                {!isValid ? (
                  <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-sm gap-2">
                    <FiAlertTriangle className="w-8 h-8 text-destructive" />
                    <p>Cannot render Visual Builder.</p>
                    <p className="text-xs">
                      Your JSON configuration is invalid.
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setActiveTab("edit")}
                      className="mt-2"
                    >
                      Fix in Raw JSON
                    </Button>
                  </div>
                ) : parsedServers.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-sm gap-4 py-12">
                    <Server className="w-12 h-12 text-muted" />
                    <p>No MCP Servers configured.</p>
                    <div className="flex gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleAddTemplate("remote-search")}
                      >
                        <Plus className="w-4 h-4 mr-1" /> Add Remote Search
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleAddTemplate("github-mcp")}
                      >
                        <Plus className="w-4 h-4 mr-1" /> Add GitHub MCP
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Accordion
                    type="multiple"
                    className="w-full"
                    defaultValue={parsedServers.map((_, i) => `item-${i}`)}
                  >
                    {parsedServers.map((server, index) => (
                      <AccordionItem
                        key={index}
                        value={`item-${index}`}
                        className="border border-border/50 bg-black/10 rounded-xl px-5 mb-4 shadow-sm overflow-hidden transition-all duration-200"
                      >
                        <div className="flex items-center justify-between">
                          <AccordionTrigger className="hover:no-underline flex-1 py-5">
                            <div className="flex items-center gap-4 text-left">
                              <div className="p-2 bg-primary/10 rounded-lg text-primary">
                                <Server className="w-5 h-5" />
                              </div>
                              <div>
                                <h3 className="font-mono font-semibold text-sm text-foreground">
                                  {server.server_url || "Unnamed Server"}
                                </h3>
                                <p className="text-xs text-primary/80 font-mono uppercase tracking-widest mt-1">
                                  {server.type === "http"
                                    ? "HTTP (POST)"
                                    : server.type === "sse"
                                      ? "SSE (GET)"
                                      : server.type || "http"}
                                </p>
                              </div>
                            </div>
                          </AccordionTrigger>
                          <div className="flex items-center gap-3 pr-2">
                            <div
                              className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium border ${server.is_active === true ? "bg-green-500/10 text-green-500 border-green-500/20" : "bg-muted/50 text-muted-foreground border-border/50"}`}
                            >
                              <Power className="w-3 h-3" />
                              {server.is_active === true
                                ? "Active"
                                : "Inactive"}
                            </div>
                            <Switch
                              className="data-[state=checked]:bg-green-500"
                              checked={server.is_active === true}
                              onCheckedChange={(checked) =>
                                handleToggleActive(index, checked)
                              }
                            />
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-full w-9 h-9 z-10 transition-colors"
                              onClick={(e) => {
                                e.stopPropagation();
                                removeServer(index);
                              }}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                        <AccordionContent className="pb-6 pt-2">
                          <div className="flex flex-col gap-6">
                            {/* Transport and URL Fields */}
                            <div className="grid grid-cols-12 gap-4">
                              <div className="col-span-12 md:col-span-3 space-y-1">
                                <Label className="flex items-center gap-2 text-xs font-semibold text-foreground uppercase tracking-wider mb-1">
                                  TRANSPORT
                                </Label>
                                <Select
                                  value={server.type || "http"}
                                  onValueChange={(value) =>
                                    updateServerField(index, "type", value)
                                  }
                                >
                                  <SelectTrigger className="h-10 text-sm bg-background border border-border focus-visible:ring-primary/50 font-mono transition-all w-full rounded-md px-3">
                                    <SelectValue placeholder="Transport" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem
                                      value="http"
                                      className="font-mono text-sm"
                                    >
                                      HTTP (POST)
                                    </SelectItem>
                                    <SelectItem
                                      value="sse"
                                      className="font-mono text-sm"
                                    >
                                      SSE (GET)
                                    </SelectItem>
                                  </SelectContent>
                                </Select>
                                <p className="text-[11px] text-muted-foreground font-medium pl-1">
                                  Protocol Type
                                </p>
                              </div>
                              <div className="col-span-12 md:col-span-9 space-y-1">
                                <Label className="flex items-center gap-2 text-xs font-semibold text-foreground uppercase tracking-wider mb-1">
                                  URL
                                </Label>
                                <Input
                                  value={server.server_url || ""}
                                  onChange={(e) =>
                                    updateServerField(
                                      index,
                                      "server_url",
                                      e.target.value,
                                    )
                                  }
                                  placeholder="https://example.com/mcp"
                                  className="h-10 text-sm bg-background border-border focus-visible:ring-primary/50 font-mono transition-all w-full"
                                />
                                <p className="text-[11px] text-muted-foreground font-medium pl-1">
                                  The fully qualified endpoint URL for the
                                  server.
                                </p>
                              </div>
                            </div>

                            {/* Auth Settings */}
                            {(() => {
                              const isBearer =
                                server.auth_header?.toLowerCase() ===
                                  "authorization" &&
                                server.api_key
                                  ?.toLowerCase()
                                  .startsWith("bearer ");
                              const displayToken = isBearer
                                ? server.api_key.substring(7)
                                : server.api_key || "";

                              return (
                                <div className="grid grid-cols-12 gap-4">
                                  {/* Auth Type Dropdown */}
                                  <div className="col-span-12 md:col-span-3 space-y-1">
                                    <Label className="flex items-center gap-2 text-xs font-semibold text-foreground uppercase tracking-wider mb-1">
                                      AUTH TYPE
                                    </Label>
                                    <Select
                                      value={isBearer ? "bearer" : "custom"}
                                      onValueChange={(value) => {
                                        if (value === "bearer") {
                                          updateServerFields(index, {
                                            auth_header: "Authorization",
                                            api_key: "Bearer " + displayToken,
                                          });
                                        } else {
                                          updateServerFields(index, {
                                            api_key: displayToken,
                                          });
                                        }
                                      }}
                                    >
                                      <SelectTrigger className="h-10 text-sm bg-background border border-border focus-visible:ring-primary/50 font-mono transition-all w-full rounded-md px-3">
                                        <SelectValue placeholder="Auth Type" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem
                                          value="bearer"
                                          className="font-mono text-sm"
                                        >
                                          Bearer Token
                                        </SelectItem>
                                        <SelectItem
                                          value="custom"
                                          className="font-mono text-sm"
                                        >
                                          Custom Header
                                        </SelectItem>
                                      </SelectContent>
                                    </Select>
                                    <p className="text-[11px] text-muted-foreground font-medium pl-1">
                                      Strategy
                                    </p>
                                  </div>

                                  {isBearer ? (
                                    // Bearer Token Mode (Hide Header Input)
                                    <div className="col-span-12 md:col-span-9 space-y-1">
                                      <Label className="flex items-center gap-2 text-xs font-semibold text-foreground uppercase tracking-wider mb-1">
                                        TOKEN
                                      </Label>
                                      <Input
                                        value={displayToken}
                                        onChange={(e) =>
                                          updateServerField(
                                            index,
                                            "api_key",
                                            "Bearer " + e.target.value,
                                          )
                                        }
                                        placeholder="YOUR_TOKEN"
                                        type="password"
                                        className="h-10 text-sm bg-background border-border focus-visible:ring-primary/50 font-mono transition-all"
                                      />
                                      <p className="text-[11px] text-muted-foreground font-medium pl-1">
                                        "Bearer" prefix is added automatically.
                                      </p>
                                    </div>
                                  ) : (
                                    // Custom Header Mode
                                    <>
                                      <div className="col-span-12 md:col-span-4 space-y-1">
                                        <Label className="flex items-center gap-2 text-xs font-semibold text-foreground uppercase tracking-wider mb-1">
                                          HEADER NAME
                                        </Label>
                                        <Input
                                          value={server.auth_header || ""}
                                          onChange={(e) =>
                                            updateServerField(
                                              index,
                                              "auth_header",
                                              e.target.value,
                                            )
                                          }
                                          placeholder="x-api-key"
                                          className="h-10 text-sm bg-background border-border focus-visible:ring-primary/50 font-mono transition-all"
                                        />
                                        <p className="text-[11px] text-muted-foreground font-medium pl-1">
                                          E.g., Authorization
                                        </p>
                                      </div>
                                      <div className="col-span-12 md:col-span-5 space-y-1">
                                        <Label className="flex items-center gap-2 text-xs font-semibold text-foreground uppercase tracking-wider mb-1">
                                          HEADER VALUE
                                        </Label>
                                        <Input
                                          value={server.api_key || ""}
                                          onChange={(e) =>
                                            updateServerField(
                                              index,
                                              "api_key",
                                              e.target.value,
                                            )
                                          }
                                          placeholder="Token value..."
                                          type="password"
                                          className="h-10 text-sm bg-background border-border focus-visible:ring-primary/50 font-mono transition-all"
                                        />
                                        <p className="text-[11px] text-muted-foreground font-medium pl-1">
                                          Exact value passed.
                                        </p>
                                      </div>
                                    </>
                                  )}
                                </div>
                              );
                            })()}
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                )}
              </ScrollArea>
              {isValid && parsedServers.length > 0 && (
                <div className="mt-4 flex justify-end gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleAddTemplate("custom-http")}
                  >
                    <Plus className="w-4 h-4 mr-1" /> Add Server
                  </Button>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>

        <DialogFooter className="p-6 pt-4 flex flex-col sm:flex-row gap-3">
          <Button
            variant="ghost"
            onClick={onClose}
            className="w-full sm:w-auto"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={!isValid || loading || saving}
            className="w-full sm:w-auto bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <FiSave className="mr-2" /> {saving ? "Saving..." : "Save Config"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default McpConfigDialog;
