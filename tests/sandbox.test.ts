import { mkdtemp, mkdir, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { readSandboxFile, resolveInsideSandbox, searchSandbox } from '../src/sandbox.js';

let sandbox: string;
let outside: string;

beforeAll(async () => {
  const base = await mkdtemp(path.join(tmpdir(), 'mcp-sandbox-'));
  sandbox = path.join(base, 'sandbox');
  outside = path.join(base, 'secret');
  await mkdir(path.join(sandbox, 'notes'), { recursive: true });
  await mkdir(outside, { recursive: true });
  await writeFile(path.join(sandbox, 'notes', 'todo.txt'), 'buy milk\nship the release\n');
  await writeFile(path.join(outside, 'passwords.txt'), 'hunter2');
  await symlink(outside, path.join(sandbox, 'escape'));
});

describe('resolveInsideSandbox', () => {
  it('accepts a file inside the sandbox', async () => {
    const { real } = await resolveInsideSandbox(sandbox, 'notes/todo.txt');
    expect(real.endsWith(path.join('notes', 'todo.txt'))).toBe(true);
  });

  it('refuses parent-directory traversal', async () => {
    await expect(resolveInsideSandbox(sandbox, '../secret/passwords.txt')).rejects.toThrow(/outside the sandbox|No file/);
  });

  it('refuses absolute paths outside the sandbox', async () => {
    await expect(resolveInsideSandbox(sandbox, path.join(outside, 'passwords.txt'))).rejects.toThrow(
      /outside the sandbox/,
    );
  });

  it('refuses a symlink inside the sandbox that points outside it', async () => {
    await expect(resolveInsideSandbox(sandbox, 'escape/passwords.txt')).rejects.toThrow(/outside the sandbox/);
  });
});

describe('readSandboxFile', () => {
  it('returns the content of an allowed file', async () => {
    const file = await readSandboxFile(sandbox, 'notes/todo.txt', 1024);
    expect(file.content).toContain('ship the release');
    expect(file.path).toBe(path.join('notes', 'todo.txt'));
  });

  it('refuses files larger than the configured limit', async () => {
    await expect(readSandboxFile(sandbox, 'notes/todo.txt', 4)).rejects.toThrow(/larger than 4 bytes/);
  });

  it('refuses directories', async () => {
    await expect(readSandboxFile(sandbox, 'notes', 1024)).rejects.toThrow(/not a file/);
  });
});

describe('searchSandbox', () => {
  it('returns line-numbered literal matches and skips symlinks', async () => {
    const result = await searchSandbox(sandbox, 'release', { maxResults: 10, maxFileBytes: 1024 });
    expect(result.matches).toEqual([{ file: path.join('notes', 'todo.txt'), line: 2, text: 'ship the release' }]);
  });

  it('never returns content from outside the sandbox', async () => {
    const result = await searchSandbox(sandbox, 'hunter2', { maxResults: 10, maxFileBytes: 1024 });
    expect(result.matches).toEqual([]);
  });
});
