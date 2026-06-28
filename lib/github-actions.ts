type DispatchMode = 'all' | 'single';

type DispatchOptions = {
  mode: DispatchMode;
  monitorId?: string;
};

function getRequiredEnv(name: string): string {
  const value = process.env[name];

  if (!value || !value.trim()) {
    throw new Error(`Variabile ambiente mancante: ${name}`);
  }

  return value.trim();
}

function getWorkflowRef(): string {
  return process.env.GITHUB_WORKFLOW_REF?.trim() || 'main';
}

export async function dispatchMonitorWorkflow(options: DispatchOptions) {
  const owner = getRequiredEnv('GITHUB_OWNER');
  const repo = getRequiredEnv('GITHUB_REPO');
  const workflowFile = getRequiredEnv('GITHUB_WORKFLOW_FILE');
  const token = getRequiredEnv('GITHUB_ACTIONS_TOKEN');
  const ref = getWorkflowRef();

  if (options.mode === 'single' && !options.monitorId) {
    throw new Error('monitorId obbligatorio per controllo singolo.');
  }

  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${workflowFile}/dispatches`,
    {
      method: 'POST',
      headers: {
        accept: 'application/vnd.github+json',
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
        'x-github-api-version': '2022-11-28'
      },
      body: JSON.stringify({
        ref,
        inputs: {
          mode: options.mode,
          monitor_id: options.monitorId || ''
        }
      })
    }
  );

  if (response.status === 204) {
    return {
      ok: true,
      ref,
      mode: options.mode,
      monitorId: options.monitorId || null
    };
  }

  const text = await response.text();

  throw new Error(
    `GitHub Actions non avviato. HTTP ${response.status}. ${text || response.statusText}`
  );
}
