import React, { useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import { Box } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import type { Components } from "react-markdown";
import { SpoilerText } from "./SpoilerText";

interface MarkdownRendererProps {
  text: string;
}

/**
 * Pre-process Discord-style spoiler syntax ||text|| into
 * <spoiler>text</spoiler> HTML tags for rehype-raw to parse.
 */
function preprocessSpoilers(text: string): string {
  return text.replace(/\|\|(.+?)\|\|/gs, "<spoiler>$1</spoiler>");
}

const MarkdownRendererInner: React.FC<MarkdownRendererProps> = ({ text }) => {
  const theme = useTheme();

  const processed = useMemo(() => preprocessSpoilers(text), [text]);

  const components = useMemo<Components>(
    () => ({
      // Use span instead of p to avoid block-level nesting issues
      p: ({ children }) => (
        <span style={{ display: "block", margin: 0 }}>{children}</span>
      ),

      // Styled code blocks and inline code
      code: ({ children, className }) => {
        const isBlock = className?.startsWith("language-");
        if (isBlock) {
          return (
            <Box
              component="code"
              sx={{
                display: "block",
                backgroundColor: theme.palette.mode === "dark"
                  ? "rgba(0,0,0,0.4)"
                  : "rgba(0,0,0,0.06)",
                borderRadius: "4px",
                padding: "8px 12px",
                fontFamily: "monospace",
                fontSize: "0.85em",
                overflowX: "auto",
                whiteSpace: "pre",
                my: 0.5,
              }}
            >
              {children}
            </Box>
          );
        }
        return (
          <Box
            component="code"
            sx={{
              backgroundColor: theme.palette.mode === "dark"
                ? "rgba(0,0,0,0.4)"
                : "rgba(0,0,0,0.06)",
              borderRadius: "3px",
              padding: "1px 4px",
              fontFamily: "monospace",
              fontSize: "0.85em",
            }}
          >
            {children}
          </Box>
        );
      },

      pre: ({ children }) => (
        <Box component="pre" sx={{ m: 0 }}>
          {children}
        </Box>
      ),

      // Blockquote with left border
      blockquote: ({ children }) => (
        <Box
          component="blockquote"
          sx={{
            borderLeft: `3px solid ${theme.palette.divider}`,
            margin: "4px 0",
            paddingLeft: "12px",
            color: theme.palette.text.secondary,
          }}
        >
          {children}
        </Box>
      ),

      // Links open in new tab
      a: ({ href, children }) => (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: theme.palette.primary.main }}
        >
          {children}
        </a>
      ),

      // Disable image rendering
      img: () => null,

      // Spoiler text (from preprocessed ||text|| syntax)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      spoiler: ({ children }: any) => <SpoilerText>{children}</SpoilerText>,
    }),
    [theme]
  );

  if (!text) return null;

  return (
    <Box
      component="span"
      sx={{
        "& > span:only-child": { display: "inline" },
        "& del": { textDecoration: "line-through" },
        "& ul, & ol": { m: 0, pl: 3 },
        "& h1, & h2, & h3": {
          fontSize: "1em",
          fontWeight: 700,
          m: "4px 0",
        },
      }}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw]}
        components={components}
      >
        {processed}
      </ReactMarkdown>
    </Box>
  );
};

export const MarkdownRenderer = React.memo(MarkdownRendererInner);
