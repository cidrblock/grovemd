import { useEffect, useRef } from "react";
import {
  MDXEditor,
  type MDXEditorMethods,
  headingsPlugin,
  listsPlugin,
  quotePlugin,
  thematicBreakPlugin,
  markdownShortcutPlugin,
  linkPlugin,
  linkDialogPlugin,
  imagePlugin,
  tablePlugin,
  codeBlockPlugin,
  codeMirrorPlugin,
  diffSourcePlugin,
  frontmatterPlugin,
  toolbarPlugin,
  UndoRedo,
  BoldItalicUnderlineToggles,
  CodeToggle,
  ListsToggle,
  BlockTypeSelect,
  CreateLink,
  InsertTable,
  InsertCodeBlock,
  InsertThematicBreak,
  InsertImage,
  InsertFrontmatter,
  DiffSourceToggleWrapper,
  Separator,
  ConditionalContents,
  ChangeCodeMirrorLanguage,
} from "@mdxeditor/editor";
import "@mdxeditor/editor/style.css";
import { useWorkspace } from "../state/WorkspaceContext";

const plugins = [
  headingsPlugin({ allowedHeadingLevels: [1, 2, 3, 4, 5, 6] }),
  listsPlugin(),
  quotePlugin(),
  thematicBreakPlugin(),
  linkPlugin(),
  linkDialogPlugin(),
  imagePlugin(),
  tablePlugin(),
  frontmatterPlugin(),
  codeBlockPlugin({ defaultCodeBlockLanguage: "txt" }),
  codeMirrorPlugin({
    codeBlockLanguages: {
      txt: "Plain text",
      md: "Markdown",
      js: "JavaScript",
      ts: "TypeScript",
      tsx: "TSX",
      jsx: "JSX",
      py: "Python",
      sh: "Shell",
      bash: "Bash",
      json: "JSON",
      yaml: "YAML",
      yml: "YAML",
      css: "CSS",
      html: "HTML",
      sql: "SQL",
      go: "Go",
      rust: "Rust",
    },
  }),
  diffSourcePlugin({ viewMode: "rich-text" }),
  markdownShortcutPlugin(),
  toolbarPlugin({
    toolbarContents: () => (
      <DiffSourceToggleWrapper>
        <ConditionalContents
          options={[
            {
              when: (editor) => editor?.editorType === "codeblock",
              contents: () => <ChangeCodeMirrorLanguage />,
            },
            {
              fallback: () => (
                <>
                  <UndoRedo />
                  <Separator />
                  <BoldItalicUnderlineToggles />
                  <CodeToggle />
                  <Separator />
                  <ListsToggle />
                  <Separator />
                  <BlockTypeSelect />
                  <Separator />
                  <CreateLink />
                  <InsertImage />
                  <InsertTable />
                  <InsertCodeBlock />
                  <InsertThematicBreak />
                  <InsertFrontmatter />
                </>
              ),
            },
          ]}
        />
      </DiffSourceToggleWrapper>
    ),
  }),
];

export function Editor() {
  const { openDocument, setContent, revealLine, setRevealLine } = useWorkspace();
  const editorRef = useRef<MDXEditorMethods>(null);
  const lastEmitted = useRef(openDocument?.content ?? "");

  // External content updates (SSE reload, conflict resolve) while same tab is open
  useEffect(() => {
    if (!openDocument || !editorRef.current) return;
    if (openDocument.content === lastEmitted.current) return;
    editorRef.current.setMarkdown(openDocument.content);
    lastEmitted.current = openDocument.content;
  }, [openDocument?.content, openDocument?.path]);

  // Search jump: WYSIWYG has no line API — focus editor; preview still shows hits
  useEffect(() => {
    if (revealLine == null) return;
    editorRef.current?.focus(undefined, { defaultSelection: "rootStart" });
    setRevealLine(null);
  }, [revealLine, setRevealLine, openDocument?.path]);

  if (!openDocument) return null;

  return (
    <MDXEditor
      key={openDocument.path}
      ref={editorRef}
      className="grove-mdxeditor mdxeditor-full-height"
      contentEditableClassName="grove-mdx-content"
      markdown={openDocument.content}
      onChange={(md) => {
        lastEmitted.current = md;
        if (md === openDocument.content) return;
        setContent(md);
      }}
      plugins={plugins}
    />
  );
}
