import { Daytona, CodeLanguage } from '@daytona/sdk';

let daytonaClient: Daytona | null = null;

function getDaytonaClient(): Daytona {
  if (!daytonaClient) {
    const apiKey = process.env.DAYTONA_API_KEY;
    if (!apiKey) {
      throw new Error('DAYTONA_API_KEY environment variable is required for Daytona execution.');
    }
    daytonaClient = new Daytona({ apiKey });
  }
  return daytonaClient;
}

export interface DaytonaExecutionResult {
  success: boolean;
  exitCode: number;
  output: string;
  durationMs: number;
}

export async function executeDaytonaCommand(command: string, timeoutSec = 60): Promise<DaytonaExecutionResult> {
  const startTime = Date.now();
  const daytona = getDaytonaClient();
  let sandbox: any = null;
  try {
    sandbox = await daytona.create({
      language: CodeLanguage.PYTHON,
      autoDeleteInterval: 5,
    }, { timeout: 30 });

    const res = await sandbox.process.executeCommand(command, undefined, undefined, timeoutSec);
    const durationMs = Date.now() - startTime;
    const output = res.result || res.artifacts?.stdout || '';
    const exitCode = res.exitCode ?? 0;
    const success = exitCode === 0;

    return {
      success,
      exitCode,
      output,
      durationMs,
    };
  } catch (err: any) {
    const durationMs = Date.now() - startTime;
    return {
      success: false,
      exitCode: err?.exitCode || 1,
      output: `Daytona Execution Error: ${err?.message || String(err)}`,
      durationMs,
    };
  } finally {
    if (sandbox) {
      try {
        await daytona.delete(sandbox);
      } catch (cleanupErr) {
        console.error('Failed to cleanup Daytona sandbox:', cleanupErr);
      }
    }
  }
}

export async function executeDaytonaCode(code: string, language: 'python' | 'typescript' | 'javascript' = 'python', timeoutSec = 60): Promise<DaytonaExecutionResult> {
  const startTime = Date.now();
  const daytona = getDaytonaClient();
  let sandbox: any = null;
  try {
    const langEnum = language === 'typescript' ? CodeLanguage.TYPESCRIPT : language === 'javascript' ? CodeLanguage.JAVASCRIPT : CodeLanguage.PYTHON;
    sandbox = await daytona.create({
      language: langEnum,
      autoDeleteInterval: 5,
    }, { timeout: 30 });

    const res = await sandbox.process.codeRun(code, {}, timeoutSec);
    const durationMs = Date.now() - startTime;
    const output = res.result || res.artifacts?.stdout || '';
    const exitCode = res.exitCode ?? 0;
    const success = exitCode === 0;

    return {
      success,
      exitCode,
      output,
      durationMs,
    };
  } catch (err: any) {
    const durationMs = Date.now() - startTime;
    return {
      success: false,
      exitCode: err?.exitCode || 1,
      output: `Daytona Code Run Error: ${err?.message || String(err)}`,
      durationMs,
    };
  } finally {
    if (sandbox) {
      try {
        await daytona.delete(sandbox);
      } catch (cleanupErr) {
        console.error('Failed to cleanup Daytona sandbox:', cleanupErr);
      }
    }
  }
}
