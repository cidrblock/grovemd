import type { DocumentPayload, SearchHit, TreeNode } from "../types";

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = (await res.json()) as { detail?: string };
      if (body.detail) detail = body.detail;
    } catch {
      /* ignore */
    }
    const err = new Error(detail) as Error & { status: number };
    err.status = res.status;
    throw err;
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  health: () => request<{ status: string }>("/api/health"),
  tree: () => request<TreeNode[]>("/api/tree"),
  files: () => request<string[]>("/api/files"),
  read: (path: string) =>
    request<DocumentPayload>(`/api/file?path=${encodeURIComponent(path)}`),
  save: (path: string, content: string, expected_mtime: string | null) =>
    request<DocumentPayload>("/api/file", {
      method: "PUT",
      body: JSON.stringify({ path, content, expected_mtime }),
    }),
  createFile: (path: string, content = "") =>
    request<DocumentPayload>("/api/file", {
      method: "POST",
      body: JSON.stringify({ path, content }),
    }),
  createDirectory: (path: string) =>
    request<{ path: string }>("/api/directory", {
      method: "POST",
      body: JSON.stringify({ path }),
    }),
  rename: (from: string, to: string) =>
    request<{ from: string; to: string }>("/api/path", {
      method: "PATCH",
      body: JSON.stringify({ from, to }),
    }),
  remove: (path: string) =>
    request<{ path: string }>(`/api/path?path=${encodeURIComponent(path)}`, {
      method: "DELETE",
    }),
  search: (q: string) =>
    request<SearchHit[]>(`/api/search?q=${encodeURIComponent(q)}`),
};
