/**
 * Vercel Domains API Integration
 * 
 * Automatically provisions and removes custom domains on the Vercel project.
 * When a tenant saves a custom domain, we call Vercel to add it — Vercel handles
 * SSL provisioning and routing automatically once the CNAME is pointed.
 * 
 * Required env vars:
 *   VERCEL_API_TOKEN   – personal token from vercel.com/account/tokens
 *   VERCEL_PROJECT_ID  – project ID from Vercel dashboard → Settings → General
 *   VERCEL_TEAM_ID     – (optional) only needed if project belongs to a Vercel team
 */

const VERCEL_API = 'https://api.vercel.com';

function getHeaders(): Record<string, string> {
  const token = process.env.VERCEL_API_TOKEN;
  if (!token) throw new Error('VERCEL_API_TOKEN not configured');
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

function teamQuery(): string {
  const teamId = process.env.VERCEL_TEAM_ID;
  return teamId ? `?teamId=${teamId}` : '';
}

function projectId(): string {
  const id = process.env.VERCEL_PROJECT_ID;
  if (!id) throw new Error('VERCEL_PROJECT_ID not configured');
  return id;
}

export interface VercelDomainConfig {
  name: string;
  verified: boolean;
  configured: boolean;
  /** The DNS record type + value the user needs to set */
  verification?: Array<{ type: string; domain: string; value: string }>;
  error?: string;
}

/**
 * Add a custom domain to the Vercel project.
 * Vercel will auto-provision SSL once the CNAME is correct.
 */
export async function addDomainToVercel(domain: string): Promise<VercelDomainConfig> {
  try {
    const res = await fetch(
      `${VERCEL_API}/v10/projects/${projectId()}/domains${teamQuery()}`,
      {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ name: domain }),
      }
    );

    const data: any = await res.json();

    if (!res.ok) {
      // Domain might already exist on this project — that's fine
      if (data.error?.code === 'domain_already_in_use' || data.error?.code === 'domain_already_added') {
        return { name: domain, verified: false, configured: false, error: undefined };
      }
      return {
        name: domain,
        verified: false,
        configured: false,
        error: data.error?.message || `Vercel API error: ${res.status}`,
      };
    }

    return {
      name: data.name || domain,
      verified: data.verified ?? false,
      configured: false,
    };
  } catch (err: any) {
    return {
      name: domain,
      verified: false,
      configured: false,
      error: err.message || 'Failed to reach Vercel API',
    };
  }
}

/**
 * Remove a custom domain from the Vercel project.
 */
export async function removeDomainFromVercel(domain: string): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(
      `${VERCEL_API}/v9/projects/${projectId()}/domains/${domain}${teamQuery()}`,
      {
        method: 'DELETE',
        headers: getHeaders(),
      }
    );

    if (!res.ok) {
      const data: any = await res.json();
      // If domain doesn't exist, that's fine
      if (res.status === 404) return { success: true };
      return { success: false, error: data.error?.message || `Vercel API error: ${res.status}` };
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to reach Vercel API' };
  }
}

/**
 * Get the current configuration/verification status of a domain on Vercel.
 * This tells us if the DNS is properly pointed and SSL is provisioned.
 */
export async function getDomainConfig(domain: string): Promise<VercelDomainConfig> {
  try {
    // Check project domain status
    const res = await fetch(
      `${VERCEL_API}/v9/projects/${projectId()}/domains/${domain}${teamQuery()}`,
      {
        method: 'GET',
        headers: getHeaders(),
      }
    );

    if (!res.ok) {
      if (res.status === 404) {
        return { name: domain, verified: false, configured: false, error: 'Domain not found on Vercel project' };
      }
      const data: any = await res.json();
      return { name: domain, verified: false, configured: false, error: data.error?.message };
    }

    const data: any = await res.json();

    // Also check domain-level verification
    const verifyRes = await fetch(
      `${VERCEL_API}/v6/domains/${domain}/config${teamQuery()}`,
      {
        method: 'GET',
        headers: getHeaders(),
      }
    );

    let configured = false;
    let verification: VercelDomainConfig['verification'] = undefined;

    if (verifyRes.ok) {
      const verifyData: any = await verifyRes.json();
      // misconfigured === false means properly configured
      configured = verifyData.misconfigured === false;
    }

    return {
      name: data.name || domain,
      verified: data.verified ?? false,
      configured,
      verification: data.verification || verification,
    };
  } catch (err: any) {
    return {
      name: domain,
      verified: false,
      configured: false,
      error: err.message || 'Failed to reach Vercel API',
    };
  }
}

/**
 * Check if Vercel integration is configured (env vars present).
 */
export function isVercelConfigured(): boolean {
  return !!(process.env.VERCEL_API_TOKEN && process.env.VERCEL_PROJECT_ID);
}
