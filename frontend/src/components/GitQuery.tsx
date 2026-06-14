// GitQuery.tsx
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import SelectOptions from "./Select.tsx";

interface Props {
  owner: string;
  repo: string;
  branch: string;
  commit: string;
  dirInput: string;
  fileExtInput: string;
  dirOption: string[];
  fileExtOption: string[];
  setOwner: (val: string) => void;
  setRepo: (val: string) => void;
  setBranch: (val: string) => void;
  setCommit: (val: string) => void;
  setDirInput: (val: string) => void;
  setFileExtInput: (val: string) => void;
  setDirOption: (val: string[]) => void;
  setFileExtOption: (val: string[]) => void;
}

const inputClassName =
  "rounded-xl border border-border bg-background/50 text-foreground placeholder:text-muted-foreground hover:border-primary hover:bg-muted focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary focus-visible:bg-muted transition-all duration-200";

const GitQuery = ({
  owner,
  repo,
  branch,
  commit,
  dirInput,
  fileExtInput,
  dirOption,
  fileExtOption,
  setOwner,
  setRepo,
  setBranch,
  setCommit,
  setDirInput,
  setFileExtInput,
  setDirOption,
  setFileExtOption,
}: Props) => {
  return (
    <div className="flex flex-col gap-6 w-full">
      <div className="flex items-center bg-muted border border-border rounded-xl text-muted-foreground overflow-hidden">
        <div className="px-3 py-2 bg-muted border-r border-border text-sm whitespace-nowrap">
          https://github.com/
        </div>
        <Input
          placeholder="owner/repository"
          value={owner && repo ? `${owner}/${repo}` : ""}
          readOnly
          className="border-none rounded-none focus-visible:ring-0 bg-transparent flex-1 shadow-none h-full"
        />
        <div className="px-3 py-2 bg-muted border-l border-border text-sm whitespace-nowrap">
          .git
        </div>
      </div>

      <div className="flex gap-4">
        <div className="flex flex-col flex-1 gap-2">
          <Label className="text-foreground text-sm font-medium">Owner *</Label>
          <Input
            placeholder="github-username"
            value={owner}
            onChange={(e) => setOwner(e.target.value)}
            className={inputClassName}
          />
        </div>
        <div className="flex flex-col flex-1 gap-2">
          <Label className="text-foreground text-sm font-medium">
            Repository *
          </Label>
          <Input
            placeholder="repo-name"
            value={repo}
            onChange={(e) => setRepo(e.target.value)}
            className={inputClassName}
          />
        </div>
      </div>

      <div className="flex gap-4">
        <div className="flex flex-col flex-1 gap-2">
          <Label className="text-foreground text-sm font-medium">Branch</Label>
          <Input
            placeholder="main"
            value={branch}
            onChange={(e) => setBranch(e.target.value)}
            className={inputClassName}
          />
        </div>
        <div className="flex flex-col flex-1 gap-2">
          <Label className="text-foreground text-sm font-medium">
            Commit (optional)
          </Label>
          <Input
            placeholder="commit-hash"
            value={commit}
            onChange={(e) => setCommit(e.target.value)}
            className={inputClassName}
          />
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex items-end gap-4">
          <div className="flex flex-col flex-1 gap-2">
            <Label className="text-foreground text-sm font-medium">
              Directory Filters (comma-separated)
            </Label>
            <Input
              placeholder="src/, docs/, tests/"
              value={dirInput}
              onChange={(e) => setDirInput(e.target.value)}
              className={inputClassName}
            />
          </div>
          <SelectOptions value={dirOption} setValue={setDirOption} />
        </div>

        <div className="flex items-end gap-4">
          <div className="flex flex-col flex-1 gap-2">
            <Label className="text-foreground text-sm font-medium">
              File Extension Filters (comma-separated)
            </Label>
            <Input
              placeholder=".ts, .tsx, .js, .jsx"
              value={fileExtInput}
              onChange={(e) => setFileExtInput(e.target.value)}
              className={inputClassName}
            />
          </div>
          <SelectOptions value={fileExtOption} setValue={setFileExtOption} />
        </div>
      </div>
    </div>
  );
};

export default GitQuery;
