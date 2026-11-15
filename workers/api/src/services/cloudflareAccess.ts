import type { Bindings } from '../types/env';

const ACCOUNT_ID = '74a7af3d03b159edc357bcdc8d903556';
const APPLICATION_ID = 'b63d3bd9-4aea-4618-8221-f13d26f9519e';
const POLICY_ID = '3fe62b03-bb97-47d3-8839-02001fee7ce0';

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

  const endpoint = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/access/apps/${APPLICATION_ID}/policies/${POLICY_ID}`;
  const headers = {
    Authorization: `Bearer ${env.CF_ACCESS_API_TOKEN}`,
    'Content-Type': 'application/json',
  };

  try {
    const getResponse = await fetch(endpoint, { method: 'GET', headers, signal: AbortSignal.timeout(8000) });
    const policyResponse = await getResponse.json() as AccessApiResponse<AccessPolicy>;
    if (!getResponse.ok || !policyResponse.success || !policyResponse.result) {
      return { status: 'failed', message: 'Could not read the configured Cloudflare Access policy. Check the API token permissions and policy IDs.' };
    }

    const policy = policyResponse.result;
    if (policy.id && policy.id !== POLICY_ID) {
      return { status: 'failed', message: 'Cloudflare returned a different Access policy than the configured policy.' };
    }
    if (policy.decision !== 'allow' || !Array.isArray(policy.include)) {
      return { status: 'failed', message: 'The configured Access policy is not an Allow policy. No changes were made.' };
    }

    const alreadyIncluded = policy.include.some((rule) => {
      const emailRule = rule.email as { email?: string } | undefined;
      return emailRule?.email?.toLowerCase() === email;
    });
    if (alreadyIncluded) {
      return { status: 'synced', message: 'This email is already included in the Cloudflare Access Allow policy.' };
    }

    if (hasBroadAllowRule(policy.include)) {
      return { status: 'failed', message: 'The Access policy contains a broad Allow rule. Automatic changes were stopped for safety.' };
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
      return { status: 'failed', message: 'Cloudflare rejected the Access policy update. Check token permissions and review the policy in Zero Trust.' };
    }

    return { status: 'synced', message: 'The approved email was added to the Cloudflare Access Allow policy.' };
  } catch {
    return { status: 'failed', message: 'Cloudflare Access could not be reached. The ERP account remains approved; retry the Access sync.' };
  }
}
