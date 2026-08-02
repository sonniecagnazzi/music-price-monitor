import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import CDP from 'chrome-remote-interface';

export type ChromePageSnapshot = {
  url: string;
  title: string;
  text: string;
};

type ChromeTarget = {
  id: string;
  type: string;
  title?: string;
  url?: string;
  webSocketDebuggerUrl?: string;
};

type CdpClient = {
  Page: {
    enable(): Promise<unknown>;
    navigate(params: { url: string }): Promise<{
      errorText?: string;
    }>;
  };
  Runtime: {
    enable(): Promise<unknown>;
    evaluate(params: {
      expression: string;
      returnByValue?: boolean;
    }): Promise<{
      result?: {
        value?: unknown;
        description?: string;
      };
      exceptionDetails?: unknown;
    }>;
  };
  close(): Promise<void>;
};

const CDP_HOST = '127.0.0.1';

const CDP_PORT = Number(
  process.env.MAC_CHROME_DEBUG_PORT || '9222'
);

const CHROME_APP =
  process.env.MAC_CHROME_APP || 'Google Chrome';

const PROFILE_DIRECTORY =
  process.env.MAC_CHROME_PROFILE_DIR ||
  path.join(
    os.homedir(),
    'Library',
    'Application Support',
    'Music Price Monitor',
    'Chrome Runner'
  );

const RUNNER_MARKER = 'music-price-monitor-runner';
const RUNNER_TITLE = 'Music Price Monitor Runner';

const RUNNER_HOME_HTML = `
<!doctype html>
<html lang="it">
  <head>
    <meta charset="utf-8">
    <title>${RUNNER_TITLE}</title>
    <style>
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        background: #111;
        color: #ddd;
        font-family: -apple-system, BlinkMacSystemFont, sans-serif;
      }

      main {
        text-align: center;
      }

      h1 {
        margin: 0 0 10px;
        font-size: 24px;
      }

      p {
        margin: 0;
        color: #888;
      }
    </style>
  </head>
  <body>
    <main>
      <h1>Music Price Monitor</h1>
      <p>Browser runner in attesa</p>
    </main>
  </body>
</html>
`;

const RUNNER_HOME_URL =
  `data:text/html;charset=utf-8,${encodeURIComponent(
    RUNNER_HOME_HTML
  )}#${RUNNER_MARKER}`;

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

async function isChromeDebugPortReady(): Promise<boolean> {
  const controller = new AbortController();

  const timeout = setTimeout(() => {
    controller.abort();
  }, 1000);

  try {
    const response = await fetch(
      `http://${CDP_HOST}:${CDP_PORT}/json/version`,
      {
        signal: controller.signal,
      }
    );

    if (!response.ok) {
      return false;
    }

    const payload = (await response.json()) as {
      Browser?: string;
    };

    return Boolean(payload.Browser);
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

async function launchDedicatedChrome(): Promise<void> {
  await mkdir(PROFILE_DIRECTORY, {
    recursive: true,
  });

  const args = [
    '-g',
    '-n',
    '-a',
    CHROME_APP,
    '--args',
    `--remote-debugging-port=${CDP_PORT}`,
    `--remote-debugging-address=${CDP_HOST}`,
    `--user-data-dir=${PROFILE_DIRECTORY}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-session-crashed-bubble',
    '--new-window',
    RUNNER_HOME_URL,
  ];

  await new Promise<void>((resolve, reject) => {
    const child = spawn('/usr/bin/open', args, {
      stdio: 'ignore',
    });

    child.once('error', reject);

    child.once('exit', (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(
        new Error(
          `Avvio Chrome fallito con codice ${String(code)}.`
        )
      );
    });
  });
}

async function ensureDedicatedChromeIsRunning(): Promise<void> {
  if (await isChromeDebugPortReady()) {
    return;
  }

  console.log(
    `[mac-browser] Avvio Chrome dedicato sulla porta ${CDP_PORT}...`
  );

  await launchDedicatedChrome();

  const deadline = Date.now() + 30_000;

  while (Date.now() < deadline) {
    if (await isChromeDebugPortReady()) {
      console.log('[mac-browser] Chrome dedicato pronto.');
      return;
    }

    await sleep(250);
  }

  throw new Error(
    `Chrome non ha aperto la porta CDP ${CDP_PORT} entro 30 secondi.`
  );
}

async function findOrCreateRunnerTarget(): Promise<ChromeTarget> {
  const cdp = CDP as unknown as {
    List(options: {
      host: string;
      port: number;
    }): Promise<ChromeTarget[]>;

    New(options: {
      host: string;
      port: number;
      url: string;
    }): Promise<ChromeTarget>;
  };

  const targets = await cdp.List({
    host: CDP_HOST,
    port: CDP_PORT,
  });

  const pages = targets.filter(
    (target) =>
      target.type === 'page' &&
      !String(target.url || '').startsWith('devtools://')
  );

  const markedTarget = pages.find((target) => {
    const url = String(target.url || '');
    const title = String(target.title || '');

    return (
      url.includes(RUNNER_MARKER) ||
      title === RUNNER_TITLE
    );
  });

  if (markedTarget) {
    console.log(
      `[mac-browser] Riutilizzo tab runner: ${markedTarget.id}`
    );

    return markedTarget;
  }

  /*
   * Se il processo precedente è terminato mentre si trovava
   * su Medimops o Momox, riutilizziamo comunque la sua unica
   * pagina anziché crearne un'altra.
   */
  if (pages.length > 0) {
    console.log(
      `[mac-browser] Riutilizzo tab Chrome esistente: ${pages[0].id}`
    );

    return pages[0];
  }

  const newTarget = await cdp.New({
    host: CDP_HOST,
    port: CDP_PORT,
    url: RUNNER_HOME_URL,
  });

  console.log(
    `[mac-browser] Nuova tab runner creata: ${newTarget.id}`
  );

  return newTarget;
}

class PersistentChromeRunner {
  private client: CdpClient | null = null;
  private targetId: string | null = null;

  private async connectionIsAlive(): Promise<boolean> {
    if (!this.client) {
      return false;
    }

    try {
      await this.client.Runtime.evaluate({
        expression: '1',
        returnByValue: true,
      });

      return true;
    } catch {
      return false;
    }
  }

  private async resetConnection(): Promise<void> {
    const client = this.client;

    this.client = null;
    this.targetId = null;

    if (!client) {
      return;
    }

    try {
      await client.close();
    } catch {
      // La connessione potrebbe essere già chiusa.
    }
  }

  async ensureReady(): Promise<void> {
    if (await this.connectionIsAlive()) {
      return;
    }

    await this.resetConnection();
    await ensureDedicatedChromeIsRunning();

    const target = await findOrCreateRunnerTarget();

    const connect = CDP as unknown as (
      options: {
        host: string;
        port: number;
        target: string;
      }
    ) => Promise<CdpClient>;

    const client = await connect({
      host: CDP_HOST,
      port: CDP_PORT,
      target: target.id,
    });

    await client.Page.enable();
    await client.Runtime.enable();

    this.client = client;
    this.targetId = target.id;

    console.log(
      `[mac-browser] Collegato alla tab ${target.id}.`
    );
  }

  private async waitUntilDocumentIsReady(
    timeoutMilliseconds = 60_000
  ): Promise<void> {
    const deadline =
      Date.now() + timeoutMilliseconds;

    while (Date.now() < deadline) {
      try {
        const result =
          await this.client?.Runtime.evaluate({
            expression: 'document.readyState',
            returnByValue: true,
          });

        const readyState = result?.result?.value;

        if (
          readyState === 'interactive' ||
          readyState === 'complete'
        ) {
          return;
        }
      } catch {
        /*
         * Durante una navigazione il contesto JavaScript
         * precedente può sparire. Attendiamo il nuovo.
         */
      }

      await sleep(250);
    }

    throw new Error(
      'Timeout durante il caricamento della pagina Chrome.'
    );
  }

  async navigate(url: string): Promise<void> {
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        await this.ensureReady();

        const response =
          await this.client!.Page.navigate({
            url,
          });

        if (response.errorText) {
          throw new Error(response.errorText);
        }

        await this.waitUntilDocumentIsReady();

        return;
      } catch (error) {
        await this.resetConnection();

        if (attempt === 2) {
          throw error;
        }
      }
    }
  }

  async readPage(): Promise<ChromePageSnapshot> {
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        await this.ensureReady();

        const result =
          await this.client!.Runtime.evaluate({
            expression: `
              (() => ({
                url: window.location.href,
                title: document.title || '',
                text: document.body
                  ? document.body.innerText
                  : ''
              }))()
            `,
            returnByValue: true,
          });

        if (result.exceptionDetails) {
          throw new Error(
            'Chrome non è riuscito a leggere il DOM.'
          );
        }

        const value = result.result?.value as
          | ChromePageSnapshot
          | undefined;

        if (!value) {
          throw new Error(
            'Chrome ha restituito una pagina vuota.'
          );
        }

        return {
          url: String(value.url || ''),
          title: String(value.title || ''),
          text: String(value.text || ''),
        };
      } catch (error) {
        await this.resetConnection();

        if (attempt === 2) {
          throw error;
        }
      }
    }

    throw new Error(
      'Impossibile leggere la pagina Chrome.'
    );
  }

  async leaveWaiting(): Promise<void> {
    await this.navigate(RUNNER_HOME_URL);

    console.log(
      '[mac-browser] Tab runner lasciata in attesa.'
    );
  }

  async disconnect(): Promise<void> {
    /*
     * Chiude soltanto il collegamento CDP.
     * Chrome e la tab rimangono aperti.
     */
    await this.resetConnection();
  }

  getDescription(): string {
    return (
      `porta ${CDP_PORT}, profilo ${PROFILE_DIRECTORY}` +
      (this.targetId
        ? `, tab ${this.targetId}`
        : '')
    );
  }
}

export const persistentChromeRunner =
  new PersistentChromeRunner();
