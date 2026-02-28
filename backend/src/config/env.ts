const required = (name: string): string => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
};

const optional = (name: string, fallback: string): string =>
  process.env[name] || fallback;

export const env = {
  nodeEnv: optional("NODE_ENV", "development"),
  port: Number(optional("BACKEND_PORT", "8787")),
  corsOrigin: optional("CORS_ORIGIN", "http://localhost:5173"),
  supabaseUrl: required("SUPABASE_URL"),
  supabaseServiceRoleKey: required("SUPABASE_SERVICE_ROLE_KEY"),
};

