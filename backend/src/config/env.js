import dotenv from 'dotenv';

dotenv.config();

const requiredVars = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_JWT_SECRET',
];

for (const key of requiredVars) {
  if (!process.env[key]) {
    // Non-fatal at boot to keep transition safe in dev.
    // Handlers will fail loudly when the missing value is used.
    console.warn(`[backend] Missing env var: ${key}`);
  }
}

export const env = {
  port: Number(process.env.BACKEND_PORT || 4000),
  supabaseUrl: process.env.SUPABASE_URL || '',
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  supabaseJwtSecret: process.env.SUPABASE_JWT_SECRET || '',
  defaultTenantId: process.env.DEFAULT_TENANT_ID || 'default',
  frontendOrigin: process.env.FRONTEND_ORIGIN || '*',
};
