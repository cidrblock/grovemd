function decodeSegment(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

/** Browser route path without .md → filesystem path with .md */
export function noteUrlToFsPath(notePath: string): string {
  const cleaned = notePath.replace(/^\/+|\/+$/g, "");
  if (!cleaned) return "";
  const decoded = cleaned.split("/").map(decodeSegment).join("/");
  if (decoded.toLowerCase().endsWith(".md")) return decoded;
  return `${decoded}.md`;
}

/** Filesystem path → /note/... URL (no .md; each segment encoded) */
export function fsPathToNoteUrl(fsPath: string): string {
  const cleaned = fsPath.replace(/^\/+|\/+$/g, "");
  const withoutMd = cleaned.toLowerCase().endsWith(".md")
    ? cleaned.slice(0, -3)
    : cleaned;
  const encoded = withoutMd.split("/").filter(Boolean).map(encodeURIComponent).join("/");
  return `/note/${encoded}`;
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
