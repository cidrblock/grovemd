/** Browser route path without .md → filesystem path with .md */
export function noteUrlToFsPath(notePath: string): string {
  const cleaned = notePath.replace(/^\/+|\/+$/g, "");
  if (!cleaned) return "";
  if (cleaned.toLowerCase().endsWith(".md")) return cleaned;
  return `${cleaned}.md`;
}

/** Filesystem path → /note/... URL segment (no .md) */
export function fsPathToNoteUrl(fsPath: string): string {
  const cleaned = fsPath.replace(/^\/+|\/+$/g, "");
  const withoutMd = cleaned.toLowerCase().endsWith(".md")
    ? cleaned.slice(0, -3)
    : cleaned;
  return `/note/${withoutMd}`;
}

export function parentDir(path: string): string {
  const parts = path.split("/").filter(Boolean);
  parts.pop();
  return parts.join("/");
}

export function joinPath(...parts: string[]): string {
  return parts
    .flatMap((p) => p.split("/"))
    .filter(Boolean)
    .join("/");
}

export function basename(path: string): string {
  const parts = path.split("/").filter(Boolean);
  return parts[parts.length - 1] ?? path;
}
