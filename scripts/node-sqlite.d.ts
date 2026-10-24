declare module "node:sqlite" {
  export class DatabaseSync {
    constructor(path: string);
    prepare(sql: string): {
      all: (...params: unknown[]) => Record<string, unknown>[];
      get: (...params: unknown[]) => Record<string, unknown> | undefined;
    };
    close(): void;
  }
}
