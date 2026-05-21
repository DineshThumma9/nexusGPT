// GitQuery.tsx
import { Field, HStack, Input, InputGroup, VStack } from "@chakra-ui/react";
import SelectOptions from "./Select.tsx";

const inputStyles = {
  borderRadius: "xl",
  border: "1px solid",
  borderColor: "border.default",
  bg: "glass.bg",
  color: "fg.default",
  _placeholder: { color: "fg.muted" },
  _hover: {
    borderColor: "brand.500",
    bg: "bg.subtle",
  },
  _focus: {
    borderColor: "brand.500",
    boxShadow: "0 0 0 1px token(colors.brand.500)",
    bg: "bg.subtle",
  },
  transition: "all 0.2s ease",
};

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
  setDirOption: (val: string[]) => void; // Fixed: should accept string[]
  setFileExtOption: (val: string[]) => void; // Fixed: should accept string[]
}

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
    <VStack gap={6} align="stretch">
      <InputGroup
        startAddon="https://github.com/"
        endAddon=".git"
        css={{
          "& > div": {
            bg: "bg.muted",
            border: "1px solid",
            borderColor: "border.subtle",
            borderRadius: "xl",
            color: "fg.subtle",
          },
        }}
      >
        <Input
          placeholder="owner/repository"
          value={`${owner}/${repo}`}
          readOnly
          {...inputStyles}
        />
      </InputGroup>

      <HStack gap={4}>
        <Field.Root flex={1}>
          <Field.Label color="white" fontSize="sm" fontWeight="medium">
            Owner *
          </Field.Label>
          <Input
            placeholder="github-username"
            value={owner}
            onChange={(e) => setOwner(e.target.value)}
            {...inputStyles}
          />
        </Field.Root>
        <Field.Root flex={1}>
          <Field.Label color="fg.default" fontSize="sm" fontWeight="medium">
            Repository *
          </Field.Label>
          <Input
            placeholder="repo-name"
            value={repo}
            onChange={(e) => setRepo(e.target.value)}
            {...inputStyles}
          />
        </Field.Root>
      </HStack>

      <HStack gap={4}>
        <Field.Root flex={1}>
          <Field.Label color="fg.default" fontSize="sm" fontWeight="medium">
            Branch
          </Field.Label>
          <Input
            placeholder="main"
            value={branch}
            onChange={(e) => setBranch(e.target.value)}
            {...inputStyles}
          />
        </Field.Root>
        <Field.Root flex={1}>
          <Field.Label color="fg.default" fontSize="sm" fontWeight="medium">
            Commit (optional)
          </Field.Label>
          <Input
            placeholder="commit-hash"
            value={commit}
            onChange={(e) => setCommit(e.target.value)}
            {...inputStyles}
          />
        </Field.Root>
      </HStack>

      <VStack gap={4} align="stretch">
        <HStack gap={4} align="flex-end">
          <Field.Root flex={1}>
            <Field.Label color="white" fontSize="sm" fontWeight="medium">
              Directory Filters (comma-separated)
            </Field.Label>
            <Input
              placeholder="src/, docs/, tests/"
              value={dirInput}
              onChange={(e) => setDirInput(e.target.value)}
              {...inputStyles}
            />
          </Field.Root>
          <SelectOptions value={dirOption} setValue={setDirOption} />
        </HStack>

        <HStack gap={4} align="flex-end">
          <Field.Root flex={1}>
            <Field.Label color="white" fontSize="sm" fontWeight="medium">
              File Extension Filters (comma-separated)
            </Field.Label>
            <Input
              placeholder=".ts, .tsx, .js, .jsx"
              value={fileExtInput}
              onChange={(e) => setFileExtInput(e.target.value)}
              {...inputStyles}
            />
          </Field.Root>
          <SelectOptions value={fileExtOption} setValue={setFileExtOption} />
        </HStack>
      </VStack>
    </VStack>
  );
};

export default GitQuery;
