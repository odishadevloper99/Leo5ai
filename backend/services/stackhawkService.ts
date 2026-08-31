export interface StackHawkScanRequest {
  targetUrl: string;
  authorizationConfirmed: boolean;
  applicationId?: string;
}

export interface StackHawkFinding {
  title?: string;
  severity?: string;
  endpoint?: string;
  description?: string;
  evidence?: string;
  remediation?: string;
}

export interface StackHawkScanResult {
  success: boolean;
  status?: string;
  scanId?: string;
  findings?: StackHawkFinding[];
  error?: string;
}

const STACKHAWK_API_BASE = 'https://api.stackhawk.com/api/v1';

function normalizeFinding(item: any): StackHawkFinding {
  return {
    title: item?.title || item?.name || item?.pluginName,
    severity: item?.severity || item?.risk || item?.confidence,
    endpoint: item?.endpoint || item?.path || item?.url || item?.request?.url,
    description: item?.description || item?.desc,
    evidence: item?.evidence || item?.proof || item?.requestEvidence,
    remediation: item?.remediation || item?.solution || item?.recommendation
  };
}

async function stackhawkFetch(path: string, init: RequestInit = {}) {
  const apiKey = process.env.STACKHAWK_API_KEY || '';
  if (!apiKey.trim()) throw new Error('Required server-side provider key is not configured.');
  return fetch(`${STACKHAWK_API_BASE}${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey.trim()}`,
      ...(init.headers || {})
    }
  });
}

export async function executeStackHawkScan(req: StackHawkScanRequest): Promise<StackHawkScanResult> {
  if (!req.authorizationConfirmed) {
    return { success: false, error: 'Explicit authorization confirmation is required before starting a security scan.' };
  }
  if (!/^https?:\/\//i.test(req.targetUrl || '')) {
    return { success: false, error: 'A valid http(s) targetUrl is required.' };
  }

  try {
    const start = await stackhawkFetch('/scans', {
      method: 'POST',
      body: JSON.stringify({ targetUrl: req.targetUrl, applicationId: req.applicationId })
    });
    const startText = await start.text();
    if (!start.ok) return { success: false, error: `StackHawk start scan failed with HTTP ${start.status}` };
    const startData = startText ? JSON.parse(startText) : {};
    const scanId = startData?.id || startData?.scanId || startData?.scan?.id;
    if (!scanId) return { success: false, error: 'StackHawk did not return a scan id.' };

    let status = 'started';
    let scanData: any = null;
    for (let i = 0; i < 12; i++) {
      await new Promise((r) => setTimeout(r, 5000));
      const statusRes = await stackhawkFetch(`/scans/${encodeURIComponent(scanId)}`);
      const statusText = await statusRes.text();
      if (!statusRes.ok) return { success: false, scanId, status, error: `StackHawk scan status failed with HTTP ${statusRes.status}` };
      scanData = statusText ? JSON.parse(statusText) : {};
      status = scanData?.status || scanData?.scan?.status || status;
      if (/complete|completed|failed|error|cancelled/i.test(status)) break;
    }

    const findingsRes = await stackhawkFetch(`/scans/${encodeURIComponent(scanId)}/findings`);
    const findingsText = await findingsRes.text();
    const findingsData = findingsRes.ok && findingsText ? JSON.parse(findingsText) : [];
    const rawFindings = Array.isArray(findingsData) ? findingsData : (findingsData?.data || findingsData?.findings || []);

    return {
      success: true,
      scanId,
      status,
      findings: rawFindings.map(normalizeFinding).filter((f: StackHawkFinding) => Object.values(f).some(Boolean))
    };
  } catch (err: any) {
    return { success: false, error: err?.message || String(err) };
  }
}
