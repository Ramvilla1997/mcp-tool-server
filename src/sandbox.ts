import { readdir, readFile, realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import { ToolInputError } from './errors.js';

export class SandboxError extends ToolInputError {
  constructor(message: string) {
    super(message);
    this.name = 'SandboxError';
  }
}

export interface ResolvedPath {
  root: string;
  real: string;
}

function isInside(root: string, target: string): boolean {
  const relative = path.relative(root, target);
  return relative === '' || (relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
}

/**
 * Resolves a requested path against the sandbox root and refuses anything that
 * lands outside it. realpath() follows symlinks first, so a link inside the sandbox
 * that points outside it is refused too.
 */
export async function resolveInsideSandbox(sandboxRoot: string, requested: string): Promise<ResolvedPath> {
  const root = await realpath(sandboxRoot);
  const candidate = path.resolve(root, requested);

  let real: string;
  try {
    real = await realpath(candidate);
  } catch {
    throw new SandboxError(`No file or directory at "${requested}"`);
  }

  if (!isInside(root, real)) {
    throw new SandboxError('The path is outside the sandbox');
  }
  return { root, real };
}

export async function readSandboxFile(
  sandboxRoot: string,
  requested: string,
  maxBytes: number,
): Promise<{ path: string; bytes: number; content: string }> {
  const { root, real } = await resolveInsideSandbox(sandboxRoot, requested);
  const info = await stat(real);
  if (!info.isFile()) {
    throw new ToolInputError('The path is not a file');
  }
  if (info.size > maxBytes) {
    throw new ToolInputError(`The file is larger than ${maxBytes} bytes`);
  }
  return {
    path: path.relative(root, real),
    bytes: info.size,
    content: await readFile(real, 'utf8'),
  };
}

export interface SearchMatch {
  file: string;
  line: number;
  text: string;
}

const MAX_DEPTH = 5;
const MAX_FILES = 500;
const MAX_LINE_CHARACTERS = 200;

/** Literal substring search. Regular expressions are deliberately not accepted, which rules out ReDoS. */
export async function searchSandbox(
  sandboxRoot: string,
  query: string,
  options: { maxResults: number; maxFileBytes: number },
): Promise<{ matches: SearchMatch[]; filesScanned: number; truncated: boolean }> {
  const root = await realpath(sandboxRoot);
  const state = { filesScanned: 0, matches: [] as SearchMatch[], truncated: false };

  await walk(root, root, 0, state, query, options);
  return { matches: state.matches, filesScanned: state.filesScanned, truncated: state.truncated };
}

interface WalkState {
  filesScanned: number;
  matches: SearchMatch[];
  truncated: boolean;
}

async function walk(
  root: string,
  directory: string,
  depth: number,
  state: WalkState,
  query: string,
  options: { maxResults: number; maxFileBytes: number },
): Promise<void> {
  if (depth > MAX_DEPTH) {
    return;
  }

  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    if (state.matches.length >= options.maxResults || state.filesScanned >= MAX_FILES) {
      state.truncated = true;
      return;
    }

    const full = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) {
      continue;
    }
    if (entry.isDirectory()) {
      await walk(root, full, depth + 1, state, query, options);
      continue;
    }
    if (!entry.isFile()) {
      continue;
    }

    const info = await stat(full);
    if (info.size > options.maxFileBytes) {
      continue;
    }

    state.filesScanned += 1;
    const lines = (await readFile(full, 'utf8')).split('\n');
    lines.forEach((text, index) => {
      if (text.includes(query) && state.matches.length < options.maxResults) {
        state.matches.push({
          file: path.relative(root, full),
          line: index + 1,
          text: text.slice(0, MAX_LINE_CHARACTERS),
        });
      }
    });
  }
}
