export type RoleCode =
  | 'super_admin'
  | 'finance_manager'
  | 'vet_staff'
  | 'rescue_coord'
  | 'adoption_coord'
  | 'volunteer'
  | 'auditor';

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  roleCode: RoleCode;
  roleName: string;
  permissions: string[];
}

export interface Bindings {
  DB: D1Database;
  PUBLIC_MEDIA?: R2Bucket;
  PRIVATE_VAULT?: R2Bucket;
  RATE_LIMIT_KV?: KVNamespace;
  ENVIRONMENT: 'development' | 'staging' | 'production';
  PUBLIC_SITE_ORIGIN: string;
  ADMIN_ERP_ORIGIN: string;
  CF_ACCESS_TEAM_DOMAIN: string;
  CF_ACCESS_AUD: string;
  CF_ACCESS_API_TOKEN?: string;
  PUBLIC_MEDIA_BASE_URL: string;
  DEV_BOOTSTRAP_ADMIN_EMAIL?: string;
  STAGING_BOOTSTRAP_ADMIN_EMAIL?: string;
  ROLE_MANAGEMENT_ADMIN_EMAIL?: string;
  TURNSTILE_SECRET_KEY?: string;
  RAZORPAY_KEY_ID?: string;
  RAZORPAY_KEY_SECRET?: string;
  RAZORPAY_WEBHOOK_SECRET?: string;
  SIGNED_URL_SECRET: string;
}

export interface AppVariables {
  authEmail: string;
  authUser: AuthUser;
  requestId: string;
}
