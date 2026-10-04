/** Host ports the browser uses to reach each service (they can be changed in the root .env). */
export interface PublicPorts {
  editor: number;
  robot: number;
  dbadmin: number;
  express: number;
  vite: number;
  viteStyle: number;
  referenceApi: number;
  styleApi: number;
  report: number;
}

export interface PlatformConfig {
  port: number;
  /** Read-only course content (modules, openapi, ...). */
  courseDir: string;
  /** The tutorial UI: static HTML, CSS and JavaScript. */
  uiDir: string;
  ports: PublicPorts;
  /** Targets for the service status banner. A missing target is reported as "unknown". */
  status: {
    workspaceUrl?: string;
    robotUrl?: string;
    appUrl?: string;
    dbadminUrl?: string;
    /** host:port of MySQL. */
    db?: string;
  };
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): PlatformConfig {
  const port = (name: string, fallback: number): number => Number(env[name] ?? fallback);
  return {
    port: Number(env.PORT ?? 4000),
    courseDir: env.COURSE_DIR ?? '/course',
    uiDir: env.UI_DIR ?? '/app/ui',
    ports: {
      editor: port('PUBLIC_EDITOR_PORT', 8081),
      robot: port('PUBLIC_ROBOT_PORT', 8083),
      dbadmin: port('PUBLIC_DBADMIN_PORT', 8085),
      express: port('PUBLIC_EXPRESS_PORT', 3000),
      vite: port('PUBLIC_VITE_PORT', 5173),
      viteStyle: port('PUBLIC_VITE_STYLE_PORT', 5174),
      referenceApi: port('PUBLIC_REFERENCE_API_PORT', 3001),
      styleApi: port('PUBLIC_STYLE_API_PORT', 3002),
      report: port('PUBLIC_REPORT_PORT', 9323),
    },
    status: {
      workspaceUrl: env.STATUS_WORKSPACE_URL,
      robotUrl: env.STATUS_ROBOT_URL,
      appUrl: env.STATUS_APP_URL,
      dbadminUrl: env.STATUS_DBADMIN_URL,
      db: env.STATUS_DB,
    },
  };
}
