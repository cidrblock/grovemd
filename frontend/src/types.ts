export type TreeNode = {
  id: string;
  name: string;
  path: string;
  type: "file" | "directory";
  children?: TreeNode[];
};

export type DocumentPayload = {
  path: string;
  content: string;
  /** Nanosecond mtime as a decimal string (JS Number cannot hold ns safely). */
  mtime: string;
};

export type SearchHit = {
  path: string;
  line: number;
  preview: string;
};

export type SaveState =
  | "saved"
  | "modified"
  | "saving"
  | "conflict"
  | "changed-externally";

export type OpenTab = {
  path: string;
  content: string;
  originalContent: string;
  mtime: string;
  saveState: SaveState;
};

export type FsEvent = {
  event: "created" | "modified" | "deleted" | "moved";
  path: string;
};
