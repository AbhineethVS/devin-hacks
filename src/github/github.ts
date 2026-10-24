import { notImplemented } from "../notImplemented";

/** A GitHub URL resolved to either one raw file or a tree to list (skills/github-file-loading). */
export type GitHubTarget =
  | { kind: "file"; rawUrl: string; path: string }
  | { kind: "tree"; owner: string; repo: string; ref?: string; path: string };

// STUB (Card 7): parse blob, raw, tree and repo-root URLs; throw a helpful error otherwise.
export function parseGitHubUrl(_url: string): GitHubTarget {
  return notImplemented("parseGitHubUrl", "Card 7");
}

// STUB (Card 7): fetch via raw.githubusercontent.com with a sessionStorage cache.
export async function fetchRawFile(_rawUrl: string): Promise<string> {
  throw new Error("Not implemented: fetchRawFile (Card 7)");
}
