import { ToolInputError } from '../errors.js';

const PATH_GRAMMAR = /^(?:[A-Za-z_][\w-]*|\[\d{1,4}\])(?:\.[A-Za-z_][\w-]*|\[\d{1,4}\])*$/;
const PATH_TOKENS = /[A-Za-z_][\w-]*|\[\d{1,4}\]/g;

/**
 * Reads one value out of a JSON document using a restricted path such as `orders[0].total`.
 * It never evaluates the path, so there is no code path to injection.
 */
export function extractJsonPath(json: string, path: string): unknown {
  if (!PATH_GRAMMAR.test(path)) {
    throw new ToolInputError('path must look like orders[0].total');
  }

  let current: unknown;
  try {
    current = JSON.parse(json);
  } catch {
    throw new ToolInputError('json is not valid JSON');
  }

  for (const token of path.match(PATH_TOKENS) ?? []) {
    if (token.startsWith('[')) {
      const index = Number(token.slice(1, -1));
      if (!Array.isArray(current) || index >= current.length) {
        throw new ToolInputError(`there is no item at index ${index}`);
      }
      current = current[index];
      continue;
    }

    if (!isRecord(current) || !Object.hasOwn(current, token)) {
      throw new ToolInputError(`there is no property "${token}"`);
    }
    current = current[token];
  }

  return current;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
