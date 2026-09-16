declare module "embedded-postgres" {
  interface PostgresOptions {
    databaseDir?: string;
    user?: string;
    password?: string;
    port?: number;
    persistent?: true | false;
  }

  export default class EmbeddedPostgres {
    constructor(options?: PostgresOptions);
    initialise(): Promise<void>;
    start(): Promise<void>;
    stop(): Promise<void>;
    createDatabase(name: string): Promise<void>;
  }
}
