import type { Bindings } from '../types/env';

const ACCESS_POLICIES = [
  {
    accountId: '74a7af3d03b159edc357bcdc8d903556',
    applicationId: 'b63d3bd9-4aea-4618-8221-f13d26f9519e',
    policyId: '3fe62b03-bb97-47d3-8839-02001fee7ce0',
    label: 'Admin ERP hostname',
  },
  {
    accountId: '74a7af3d03b159edc357bcdc8d903556',
    applicationId: '1dbcd4ff-450d-497c-abb4-d841f3904675',
    policyId: '2e71687b-0135-44cc-b3b9-d1c7ae1652f3',
    label: 'Pages deployment and preview hostnames',
  },
] as const;

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
  target: (typeof ACCESS_POLICIES)[number],
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
  if (!env.CF_ACCESS_API_TOKEN) {
    return {
      status: 'pending',
      message: 'Cloudflare Access sync is not configured yet. Add the CF_ACCESS_API_TOKEN secret to the staging Pages Function.',
    };
  }

  try {
    for (const target of ACCESS_POLICIES) {
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
