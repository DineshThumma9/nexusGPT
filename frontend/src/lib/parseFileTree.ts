export interface FileNode {
  name: string;
  path: string;
  children?: FileNode[];
}

export function parseFileTreeText(text: string): FileNode[] {
  const lines = text.split("\n").filter((line) => line.trim().length > 0);
  const root: FileNode[] = [];
  const stack: { level: number; node: FileNode }[] = [];

  for (const line of lines) {
    const indentMatch = line.match(/^(\s*|├── |│   |└── )+/);
    let level = 0;

    if (indentMatch) {
      // Calculate level based on spaces (2 spaces = 1 level) or tree characters
      const indentStr = indentMatch[0];
      level =
        indentStr.replace(/├── |└── /g, "    ").replace(/│/g, " ").length / 2;
    }

    const cleanName = line
      .replace(/^(\s*|├── |│   |└── )+/, "")
      .replace(/\/$/, "")
      .trim();
    if (!cleanName) continue;

    const isFolder = line.trim().endsWith("/") || !cleanName.includes(".");

    const node: FileNode = {
      name: cleanName,
      path: cleanName,
      ...(isFolder ? { children: [] } : {}),
    };

    if (level === 0 || stack.length === 0) {
      root.push(node);
      stack.push({ level, node });
    } else {
      // Find parent
      while (stack.length > 0 && stack[stack.length - 1].level >= level) {
        stack.pop();
      }

      if (stack.length > 0) {
        const parent = stack[stack.length - 1].node;
        node.path = `${parent.path}/${cleanName}`;
        if (!parent.children) parent.children = [];
        parent.children.push(node);
      } else {
        root.push(node);
      }

      stack.push({ level, node });
    }
  }

  return root;
}
