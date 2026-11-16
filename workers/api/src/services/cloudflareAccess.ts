import type { Bindings } from '../types/env';

const ACCESS_POLICIES_BY_ENV = {
  staging: [
    { accountId: '74a7af3d03b159edc357bcdc8d903556', applicationId: 'b63d3bd9-4aea-4618-8221-f13d26f9519e', policyId: '3fe62b03-bb97-47d3-8839-02001fee7ce0', label: 'Staging Admin ERP hostname' },
    { accountId: '74a7af3d03b159edc357bcdc8d903556', applicationId: '1dbcd4ff-450d-497c-abb4-d841f3904675', policyId: '2e71687b-0135-44cc-b3b9-d1c7ae1652f3', label: 'Staging Pages deployment and preview hostnames' },
  ],
  production: [
    { accountId: '74a7af3d03b159edc357bcdc8d903556', applicationId: '6c1ef6fc-418f-4f17-a38f-75d90fa2cce1', policyId: '9c1d9354-5887-46dd-bf35-97eb66279da4', label: 'Live Admin ERP hostname' },
    { accountId: '74a7af3d03b159edc357bcdc8d903556', applicationId: 'd71574dd-f676-4f90-825b-aa3000f9717f', policyId: 'add98604-0c3c-45db-8684-bb4569605ae6', label: 'Live Admin ERP preview hostnames' },
  ],
} as const;

type AccessPolicyTarget = (typeof ACCESS_POLICIES_BY_ENV)[keyof typeof ACCESS_POLICIES_BY_ENV][number];

function getAccessPolicies(environment: string): readonly AccessPolicyTarget[] {
  if (environment === 'production') return ACCESS_POLICIES_BY_ENV.production;
  if (environment === 'staging') return ACCESS_POLICIES_BY_ENV.staging;
  return [];
}

type AccessPolicy = {
  id?: string;
  name: string;
  decision: string;
  include: Array<Record<string, unknown>>;
  exclude?: Array<Record<string, unknown>>;
  require?: Array<Record<string, unknown>>;
  precedence?: number;
};

type AccessApiResponse<T> = {
  success: boolean;
  result?: T;
  errors?: Array<{ code: number; message: string }>;
};

export type AccessSyncResult =
  | { status: 'synced'; message: string }
  | { status: 'pending' | 'failed'; message: string };

function hasBroadAllowRule(rules: Array<Record<string, unknown>>): boolean {
  return rules.some((rule) =>
    'everyone' in rule ||
    'email_domain' in rule ||
    'any_valid_service_token' in rule
  );
}

async function syncEmailToPolicy(
  token: string,
  target: AccessPolicyTarget,
  email: string
): Promise<string | null> {
  const endpoint = `https://api.cloudflare.com/client/v4/accounts/${target.accountId}/access/apps/${target.applicationId}/policies/${target.policyId}`;
  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  const getResponse = await fetch(endpoint, {
    method: 'GET',
    headers,
    signal: AbortSignal.timeout(8000),
  });
  const policyResponse = await getResponse.json() as AccessApiResponse<AccessPolicy>;
  if (!getResponse.ok || !policyResponse.success || !policyResponse.result) {
    return `Could not read the ${target.label} Access policy. Check the API token permissions and policy IDs.`;
  }

  const policy = policyResponse.result;
  if ((policy.id && policy.id !== target.policyId) || policy.decision !== 'allow' || !Array.isArray(policy.include)) {
    return `The ${target.label} Access policy did not match the expected Allow policy. No changes were made to it.`;
  }

  const alreadyIncluded = policy.include.some((rule) => {
    const emailRule = rule.email as { email?: string } | undefined;
    return emailRule?.email?.toLowerCase() === email;
  });
  if (alreadyIncluded) return null;

  if (hasBroadAllowRule(policy.include)) {
    return `The ${target.label} Access policy contains a broad Allow rule. Automatic changes were stopped for safety.`;
  }

  const updatedPolicy = {
    name: policy.name,
    decision: policy.decision,
    include: [...policy.include, { email: { email } }],
    exclude: policy.exclude || [],
    require: policy.require || [],
    ...(typeof policy.precedence === 'number' ? { precedence: policy.precedence } : {}),
  };

  const putResponse = await fetch(endpoint, {
    method: 'PUT',
    headers,
    body: JSON.stringify(updatedPolicy),
    signal: AbortSignal.timeout(8000),
  });
  const updateResult = await putResponse.json() as AccessApiResponse<AccessPolicy>;
  if (!putResponse.ok || !updateResult.success) {
    return `Cloudflare rejected the ${target.label} policy update. Check token permissions and review it in Zero Trust.`;
  }
  return null;
}

export async function syncApprovedEmailToCloudflareAccess(
  env: Bindings,
  emailInput: string
): Promise<AccessSyncResult> {
  const email = emailInput.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { status: 'failed', message: 'The applicant email address is invalid.' };
  }
  const targets = getAccessPolicies(env.ENVIRONMENT);
  if (targets.length === 0) return { status: 'pending', message: 'Cloudflare Access sync is disabled for this environment.' };
  if (!env.CF_ACCESS_API_TOKEN) {
    return {
      status: 'pending',
      message: 'Cloudflare Access sync is not configured yet. Add the CF_ACCESS_API_TOKEN secret to the ERP Worker for this environment.',
    };
  }

  try {
    for (const target of targets) {
      const error = await syncEmailToPolicy(env.CF_ACCESS_API_TOKEN, target, email);
      if (error) return { status: 'failed', message: error };
    }
    return {
      status: 'synced',
      message: 'The approved email is allowed on the Admin ERP hostname and its deployment/preview URLs.',
    };
  } catch {
    return {
      status: 'failed',
      message: 'Cloudflare Access could not be reached. The ERP account remains approved; retry the Access sync.',
    };
  }
}

async function removeEmailFromPolicy(
  token: string,
  target: AccessPolicyTarget,
  email: string
): Promise<string | null> {
  const endpoint = `https://api.cloudflare.com/client/v4/accounts/${target.accountId}/access/apps/${target.applicationId}/policies/${target.policyId}`;
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  const response = await fetch(endpoint, { method: 'GET', headers, signal: AbortSignal.timeout(8000) });
  const policyResponse = await response.json() as AccessApiResponse<AccessPolicy>;
  if (!response.ok || !policyResponse.success || !policyResponse.result) {
    return `Could not read the ${target.label} Access policy; the account remains blocked by ERP status.`;
  }
  const policy = policyResponse.result;
  if ((policy.id && policy.id !== target.policyId) || policy.decision !== 'allow' || !Array.isArray(policy.include)) {
    return `The ${target.label} Access policy did not match the expected Allow policy. No changes were made.`;
  }
  if (hasBroadAllowRule(policy.include)) {
    return `The ${target.label} Access policy contains a broad Allow rule. Review it manually; ERP status still blocks this account.`;
  }
  const include = policy.include.filter((rule) => {
    const emailRule = rule.email as { email?: string } | undefined;
    return emailRule?.email?.toLowerCase() !== email;
  });
  if (include.length === policy.include.length) return null;
  if (include.length === 0) return `Refusing to remove the final Access allow rule from ${target.label}.`;
  const updatedPolicy = {
    name: policy.name,
    decision: policy.decision,
    include,
    exclude: policy.exclude || [],
    require: policy.require || [],
    ...(typeof policy.precedence === 'number' ? { precedence: policy.precedence } : {}),
  };
  const putResponse = await fetch(endpoint, {
    method: 'PUT', headers, body: JSON.stringify(updatedPolicy), signal: AbortSignal.timeout(8000),
  });
  const updateResult = await putResponse.json() as AccessApiResponse<AccessPolicy>;
  if (!putResponse.ok || !updateResult.success) {
    return `Cloudflare rejected removal from the ${target.label} Access policy; ERP status still blocks this account.`;
  }
  return null;
}

export async function revokeEmailFromCloudflareAccess(
  env: Bindings,
  emailInput: string
): Promise<AccessSyncResult> {
  const email = emailInput.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { status: 'failed', message: 'The account email address is invalid.' };
  }
  const targets = getAccessPolicies(env.ENVIRONMENT);
  if (targets.length === 0) return { status: 'pending', message: 'Cloudflare Access sync is disabled for this environment; ERP account status still blocks sign-in.' };
  if (!env.CF_ACCESS_API_TOKEN) {
    return { status: 'pending', message: 'Access revocation is not configured; ERP account status still blocks sign-in.' };
  }
  try {
    for (const target of targets) {
      const error = await removeEmailFromPolicy(env.CF_ACCESS_API_TOKEN, target, email);
      if (error) return { status: 'failed', message: error };
    }
    return { status: 'synced', message: 'The exact email was removed from ERP and preview Access allowlists.' };
  } catch {
    return { status: 'failed', message: 'Cloudflare Access revocation failed; ERP account status still blocks sign-in.' };
  }
}
