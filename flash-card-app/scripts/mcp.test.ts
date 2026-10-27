import { beforeEach, expect, mock, test } from 'bun:test';
import { z } from 'zod';

type Tool = (
  input: Record<string, unknown>,
) => Promise<{ content: { text: string }[]; isError?: boolean }>;
const handlers = new Map<string, Tool>();
const schemas = new Map<string, z.ZodType>();
let serve!: (req: Request, context: { supabase: unknown }) => Promise<unknown>;
mock.module('jsr:@supabase/functions-js/edge-runtime.d.ts', () => ({}));
mock.module('npm:zod@^4.3.6', () => ({ z }));
mock.module('npm:@supabase/middleware@^0.5.0', () => ({
  pipeline: (_middleware: unknown, handler: typeof serve) => handler,
}));
mock.module('npm:@supabase/server@^1.6.0', () => ({
  withOAuthProtectedResource: () => ({}),
  withSupabase: () => ({}),
}));
mock.module('npm:@modelcontextprotocol/server@^2.0.0', () => ({
  McpServer: class {
    registerTool(name: string, options: { inputSchema: z.ZodType }, handler: Tool) {
      handlers.set(name, handler);
      schemas.set(name, options.inputSchema);
    }
  },
  createMcpHandler: (factory: () => unknown) => {
    factory();
    return { fetch: async () => new Response() };
  },
}));
Object.assign(globalThis, {
  Deno: {
    serve: (handler: typeof serve) => {
      serve = handler;
    },
  },
});
await import('../supabase/functions/mcp/index.ts');

interface Row {
  id: string;
  user_id: string;
  question: string;
  answer: string;
  reported: boolean;
  column: number;
  subject_id: string | null;
  review_interval_started_on: string;
  created_at: string;
}
let rows: Row[];
const operations: string[] = [];

function client(userId: string) {
  return {
    from(table: string) {
      let filtered = () => (table === 'cards' ? rows.filter((row) => row.user_id === userId) : []);
      let values: Partial<Row> | undefined;
      let page: [number, number] | undefined;
      const query = {
        select: () => query,
        eq(field: keyof Row, value: unknown) {
          operations.push(`eq:${field}`);
          const previous = filtered;
          filtered = () => previous().filter((row) => row[field] === value);
          return query;
        },
        order: () => query,
        range(start: number, end: number) {
          operations.push('range');
          page = [start, end];
          return query;
        },
        update(input: Partial<Row>) {
          values = input;
          return query;
        },
        async maybeSingle() {
          const row = filtered()[0];
          if (row && values) Object.assign(row, values);
          return { data: row ?? null, error: null };
        },
        then(resolve: (result: { data: Row[]; error: null }) => unknown) {
          const data = filtered();
          return Promise.resolve(
            resolve({ data: page ? data.slice(page[0], page[1] + 1) : data, error: null }),
          );
        },
      };
      return query;
    },
  };
}

async function invoke(name: string, input: Record<string, unknown>, user = 'one') {
  await serve(new Request('https://example.test/mcp'), { supabase: client(user) });
  const result = await handlers.get(name)!(
    schemas.get(name)!.parse(input) as Record<string, unknown>,
  );
  return result.isError ? null : JSON.parse(result.content[0].text);
}

beforeEach(() => {
  operations.length = 0;
  rows = Array.from({ length: 6 }, (_, index) => ({
    id: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
    user_id: index === 5 ? 'two' : 'one',
    question: `Q${index}`,
    answer: 'R',
    reported: index !== 0 && index !== 3,
    subject_id: null,
    column: 2,
    review_interval_started_on: '2026-10-01',
    created_at: '2026-10-01',
  }));
});

test('list_cards applies both reported values before pagination; omission keeps all visible cards', async () => {
  expect(
    (await invoke('list_cards', { reported: true, limit: 1, offset: 1 })).map(
      (row: Row) => row.question,
    ),
  ).toEqual(['Q2']);
  expect(operations.indexOf('eq:reported')).toBeLessThan(operations.indexOf('range'));
  expect((await invoke('list_cards', { reported: false })).map((row: Row) => row.question)).toEqual(
    ['Q0', 'Q3'],
  );
  expect(await invoke('list_cards', {})).toHaveLength(5);
  expect(await invoke('list_cards', {}, 'two')).toHaveLength(1);
});

test('get_card exposes reports and user-scoped queries cannot see another account', async () => {
  expect(await invoke('get_card', { id: rows[1].id })).toMatchObject({
    reported: true,
    question: 'Q1',
  });
  expect(await invoke('get_card', { id: rows[5].id })).toBeNull();
});

test('update_card clears the report together with content and preserves progress', async () => {
  const original = { ...rows[1] };
  expect(
    await invoke('update_card', { id: original.id, question: 'Fixed', answer: 'New' }),
  ).toMatchObject({ reported: false });
  expect(rows[1]).toEqual({ ...original, question: 'Fixed', answer: 'New', reported: false });
  expect(
    await invoke('update_card', { id: rows[5].id, question: 'Fixed', answer: 'New' }),
  ).toBeNull();
  expect(rows[5].reported).toBe(true);
});
