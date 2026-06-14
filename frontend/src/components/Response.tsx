import { useEffect, useState } from "react";
import sessionStore from "../store/sessionStore.ts";
import "highlight.js/styles/github-dark.css";
import RagStatusMessage from "./RagStatusMessage.tsx";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
  ConversationEmptyState,
} from "@/components/ai/conversation";
import {
  Message,
  MessageContent,
  MessageResponse,
  MessageAttachments,
  MessageAttachment,
} from "@/components/ai/message";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CodeBlock, CodeBlockCopyButton } from "@/components/ai/code-block";
import {
  Sources,
  SourcesTrigger,
  SourcesContent,
} from "@/components/ai/sources";
import {
  FileTree,
  FileTreeFolder,
  FileTreeFile,
} from "@/components/ai/file-tree";
import {
  Snippet,
  SnippetAddon,
  SnippetText,
  SnippetInput,
  SnippetCopyButton,
} from "@/components/ai/snippet";
import {
  InlineCitation,
  InlineCitationText,
  InlineCitationCard,
  InlineCitationCardTrigger,
  InlineCitationCardBody,
  InlineCitationCarousel,
  InlineCitationCarouselHeader,
  InlineCitationCarouselPrev,
  InlineCitationCarouselNext,
  InlineCitationCarouselIndex,
  InlineCitationCarouselContent,
  InlineCitationCarouselItem,
  InlineCitationSource,
} from "@/components/ai/inline-citation";
import { parseFileTreeText, type FileNode } from "@/lib/parseFileTree";
import { Actions, Action } from "@/components/ai/actions";
import { Shimmer } from "@/components/ai/shimmer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Copy,
  Check,
  CopyIcon,
  ThumbsUpIcon,
  ThumbsDownIcon,
  RefreshCcwIcon,
} from "lucide-react";

const SourcesList = ({ sources }: { sources: any[] }) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (!sources || sources.length === 0) return null;

  return (
    <Sources className="mt-4">
      <SourcesTrigger count={sources.length} />
      <SourcesContent className="space-y-2 mt-2 w-full">
        {sources.map((source: any, index: number) => (
          <div
            key={source.doc_id}
            className="p-3 rounded-sm bg-card border border-border hover:bg-muted transition-colors text-left"
          >
            <div className="flex justify-between items-start mb-2">
              <div className="flex flex-col gap-1 flex-1">
                <div className="flex items-center gap-2">
                  <Badge
                    variant="secondary"
                    className="bg-green-100 text-green-700 hover:bg-green-100 dark:bg-green-900 dark:text-green-300"
                  >
                    #{index + 1}
                  </Badge>
                  <span className="text-sm font-medium text-foreground">
                    {source.metadata.file_name || "Unknown File"}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>Page: {source.metadata.page_label || "N/A"}</span>
                  <span>•</span>
                  <span>Relevance: {(source.score * 100).toFixed(1)}%</span>
                </div>
              </div>
              <TooltipProvider>
                <Tooltip delayDuration={400}>
                  <TooltipTrigger asChild>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleCopy(source.text, source.doc_id)}
                      className="h-7 w-7 p-0 ml-2 shrink-0 text-muted-foreground hover:text-foreground"
                      aria-label="Copy source text"
                    >
                      {copiedId === source.doc_id ? (
                        <Check className="h-4 w-4 text-green-500" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    <p>Copy source text</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {source.text.substring(0, 200)}
              {source.text.length > 200 && "..."}
            </p>
          </div>
        ))}
      </SourcesContent>
    </Sources>
  );
};

const renderFileNode = (node: FileNode) => {
  if (node.children) {
    return (
      <FileTreeFolder key={node.path} name={node.name} path={node.path}>
        {node.children.map(renderFileNode)}
      </FileTreeFolder>
    );
  }
  return <FileTreeFile key={node.path} name={node.name} path={node.path} />;
};

const MarkdownFileTree = ({ text }: { text: string }) => {
  const nodes = parseFileTreeText(text);
  return (
    <FileTree className="my-4 max-w-sm">{nodes.map(renderFileNode)}</FileTree>
  );
};

/** Renders bash/snippet fenced blocks as a copyable input pill */
const MarkdownSnippet = ({
  text,
  language,
}: {
  text: string;
  language: string;
}) => {
  return (
    <Snippet code={text} className="my-3 w-full">
      <SnippetAddon>
        <SnippetText>{language === "snippet" ? "$" : language}</SnippetText>
      </SnippetAddon>
      <SnippetInput className="flex-1 px-4 py-2" />
      <SnippetCopyButton />
    </Snippet>
  );
};

/**
 * Renders inline citations for markdown links whose href starts with "cite:".
 * e.g. [some text](cite:https://source1.com,https://source2.com)
 * Regular links render as normal <a> tags.
 */
const MarkdownLink = ({
  href,
  children,
}: {
  href?: string;
  children?: React.ReactNode;
}) => {
  if (href?.startsWith("cite:")) {
    const urls = href.slice(5).split(",").filter(Boolean);
    const validUrls = urls.filter((u) => {
      try {
        new URL(u);
        return true;
      } catch {
        return false;
      }
    });

    if (validUrls.length === 0) return <span>{children}</span>;

    return (
      <InlineCitation>
        <InlineCitationText>{children}</InlineCitationText>
        <InlineCitationCard>
          <InlineCitationCardTrigger sources={validUrls} />
          <InlineCitationCardBody>
            <InlineCitationCarousel>
              <InlineCitationCarouselHeader>
                <InlineCitationCarouselPrev />
                <InlineCitationCarouselNext />
                <InlineCitationCarouselIndex />
              </InlineCitationCarouselHeader>
              <InlineCitationCarouselContent>
                {validUrls.map((url) => {
                  let hostname = url;
                  try {
                    hostname = new URL(url).hostname;
                  } catch {}
                  return (
                    <InlineCitationCarouselItem key={url}>
                      <InlineCitationSource
                        title={hostname}
                        url={url}
                        description={`Source: ${url}`}
                      />
                    </InlineCitationCarouselItem>
                  );
                })}
              </InlineCitationCarouselContent>
            </InlineCitationCarousel>
          </InlineCitationCardBody>
        </InlineCitationCard>
      </InlineCitation>
    );
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-primary underline underline-offset-2 hover:opacity-80 transition-opacity"
    >
      {children}
    </a>
  );
};

const markdownComponents = {
  // ── Links / Citations ───────────────────────────────────────────────────
  a: ({ href, children }: any) => (
    <MarkdownLink href={href}>{children}</MarkdownLink>
  ),

  // ── Lists (Tailwind resets browser defaults — must re-add) ──────────────
  ol: ({ node, children, start, ...props }: any) => (
    <ol
      className="my-3 pl-6 list-decimal space-y-1.5 [&_ol]:mt-1.5 [&_ul]:mt-1.5"
      start={start}
      {...props}
    >
      {children}
    </ol>
  ),
  ul: ({ node, children, ...props }: any) => (
    <ul
      className="my-3 pl-6 list-disc space-y-1.5 [&_ol]:mt-1.5 [&_ul]:mt-1.5"
      {...props}
    >
      {children}
    </ul>
  ),
  li: ({ node, children, ...props }: any) => (
    <li className="leading-relaxed pl-0.5" {...props}>
      {children}
    </li>
  ),

  // ── Paragraphs & headings ───────────────────────────────────────────────
  p: ({ node, children, ...props }: any) => (
    <p className="my-2 leading-relaxed" {...props}>
      {children}
    </p>
  ),
  h1: ({ node, children, ...props }: any) => (
    <h1 className="mt-6 mb-2 text-xl font-bold" {...props}>
      {children}
    </h1>
  ),
  h2: ({ node, children, ...props }: any) => (
    <h2 className="mt-5 mb-2 text-lg font-semibold" {...props}>
      {children}
    </h2>
  ),
  h3: ({ node, children, ...props }: any) => (
    <h3 className="mt-4 mb-1.5 text-base font-semibold" {...props}>
      {children}
    </h3>
  ),

  // ── Inline emphasis ─────────────────────────────────────────────────────
  strong: ({ node, children, ...props }: any) => (
    <strong className="font-semibold" {...props}>
      {children}
    </strong>
  ),
  em: ({ node, children, ...props }: any) => (
    <em className="italic" {...props}>
      {children}
    </em>
  ),

  // ── Block elements ──────────────────────────────────────────────────────
  blockquote: ({ node, children, ...props }: any) => (
    <blockquote
      className="my-3 border-l-2 border-muted-foreground/40 pl-4 text-muted-foreground italic"
      {...props}
    >
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-4 border-border" />,

  // ── Code ────────────────────────────────────────────────────────────────
  code: ({ node, inline, className, children, ...props }: any) => {
    const match = /language-(\w+)/.exec(className || "");
    const codeString = String(children).replace(/\n$/, "");
    const isBlock = Boolean(match) || codeString.includes("\n");

    if (isBlock) {
      const language = match ? match[1] : "text";
      if (language === "file-tree" || language === "filetree") {
        return <MarkdownFileTree text={codeString} />;
      }
      if (language === "snippet" || language === "bash" || language === "sh") {
        if (!codeString.includes("\n") && codeString.length < 100) {
          return <MarkdownSnippet text={codeString} language={language} />;
        }
      }
      return (
        <CodeBlock
          code={codeString}
          language={language as any}
          className="my-4"
        >
          <CodeBlockCopyButton />
        </CodeBlock>
      );
    }
    // Inline code
    return (
      <code
        className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.85em] text-foreground"
        {...props}
      >
        {children}
      </code>
    );
  },
};

const Response = () => {
  const [messages, setMessages] = useState<any[]>([]);
  const [isWaitingForIndexing, setIsWaitingForIndexing] = useState(false);

  useEffect(() => {
    const unsubscribe = sessionStore.subscribe((state) => {
      setMessages(state.messages);
      setIsWaitingForIndexing(state.isWaitingForIndexing);
    });

    setMessages(sessionStore.getState().messages);
    setIsWaitingForIndexing(sessionStore.getState().isWaitingForIndexing);
    return unsubscribe;
  }, []);

  return (
    <TooltipProvider>
      <Conversation className="relative h-full w-full bg-background scroll-smooth">
        <ConversationContent className="pt-20 md:pt-16 pb-40 md:pb-36 max-w-3xl mx-auto">
          {messages.length === 0 && !isWaitingForIndexing ? (
            <ConversationEmptyState
              title="Start a conversation"
              description="Choose a model and start chatting. Your messages will appear here."
            />
          ) : (
            <>
              {messages.map((msg, idx) => {
                const isUser = msg.sender === "user";
                return (
                  <Message
                    from={isUser ? "user" : "assistant"}
                    key={msg.message_id || idx}
                  >
                    <MessageContent>
                      {isUser ? (
                        <div className="whitespace-pre-wrap break-words">
                          {msg.content}
                        </div>
                      ) : (
                        <>
                          {msg.content ? (
                            <MessageResponse components={markdownComponents}>
                              {msg.content}
                            </MessageResponse>
                          ) : (
                            <div className="flex h-6 items-center">
                              {msg.isStreaming ? (
                                <Shimmer className="text-sm font-medium">
                                  Generating response...
                                </Shimmer>
                              ) : (
                                <span className="text-sm text-muted-foreground">
                                  Empty response.
                                </span>
                              )}
                            </div>
                          )}
                          {msg.sources && <SourcesList sources={msg.sources} />}
                        </>
                      )}
                    </MessageContent>
                    {isUser && msg.files && msg.files.length > 0 && (
                      <MessageAttachments>
                        {msg.files.map((file: string, fileIdx: number) => (
                          <MessageAttachment
                            key={`${file}-${fileIdx}`}
                            data={{
                              filename: file,
                              mediaType: "text/plain",
                              type: "file" as const,
                              url: "",
                            }}
                          />
                        ))}
                      </MessageAttachments>
                    )}
                    {!isUser && msg.content && (
                      <Actions className="mt-1">
                        <Action
                          onClick={() =>
                            navigator.clipboard.writeText(msg.content)
                          }
                          tooltip="Copy to clipboard"
                        >
                          <CopyIcon className="size-4" />
                        </Action>
                        <Action tooltip="Regenerate response">
                          <RefreshCcwIcon className="size-4" />
                        </Action>
                        <Action tooltip="Good response">
                          <ThumbsUpIcon className="size-4" />
                        </Action>
                        <Action tooltip="Bad response">
                          <ThumbsDownIcon className="size-4" />
                        </Action>
                      </Actions>
                    )}
                  </Message>
                );
              })}
              <RagStatusMessage />
            </>
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>
    </TooltipProvider>
  );
};

export default Response;
