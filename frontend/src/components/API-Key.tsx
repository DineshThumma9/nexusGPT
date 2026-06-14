"use client";
import { useRef, useState, useEffect } from "react";
import { apiKeySelection } from "../api/session-api.ts";
import useInitStore from "../store/initStore.ts";
import { Constants } from "../entities/Constants.ts";
import { ExternalLink } from "lucide-react";
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

interface Props {
  provider: string;
  title: string;
  link?: string;
}

const APIKey = ({ provider, title, link }: Props) => {
  const {
    dialogOpen,
    setDialogOpen,
    currentAPIProvider,
    currentAPIKey,
    setCurrentAPIKey,
  } = useInitStore();

  // Get the constants to access API links
  const constants = Constants();
  const apiLink = constants.providers_api_link.get(provider.toLowerCase());

  const ref = useRef<HTMLInputElement>(null);
  const [apiKey, setAPIKey] = useState("");

  // Focus the input when dialog opens
  useEffect(() => {
    if (dialogOpen) {
      setTimeout(() => {
        ref.current?.focus();
      }, 50);
    }
  }, [dialogOpen]);

  const handleDialogChange = (open: boolean) => {
    setDialogOpen(open);

    // Clear local state when dialog closes
    if (!open) {
      setAPIKey("");
    }
  };

  const handleApiKeySelect = async () => {
    // Validation
    if (!currentAPIProvider) {
      return;
    }

    if (!apiKey || apiKey.trim() === "") {
      return;
    }

    const keyToSave = apiKey;

    // Optimistic UI Update
    setCurrentAPIKey(keyToSave);
    setDialogOpen(false);
    setAPIKey(""); // Clear local state

    try {
      await apiKeySelection(currentAPIProvider, keyToSave);
    } catch (error) {
      console.error("Error in handleApiKeySelect:", error);
    }
  };

  return (
    <Dialog open={dialogOpen} onOpenChange={handleDialogChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center flex justify-center items-center gap-1">
            <span>Enter Your API Key -</span>
            {apiLink ? (
              <a
                href={apiLink}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:text-primary/80 underline flex items-center gap-1 transition-all"
              >
                {provider}
                <ExternalLink size={14} />
              </a>
            ) : (
              <span className="text-primary">{provider}</span>
            )}
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4 py-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="apiKey" className="font-medium text-sm">
              {title}
            </Label>
            <Input
              id="apiKey"
              ref={ref}
              placeholder="Enter your API KEY"
              value={apiKey}
              onChange={(e) => setAPIKey(e.target.value)}
              className="w-full"
            />
          </div>
        </div>
        <DialogFooter className="sm:justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => handleDialogChange(false)}
          >
            Cancel
          </Button>
          <Button type="button" onClick={handleApiKeySelect}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default APIKey;
