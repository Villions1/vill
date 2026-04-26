import { SSHService } from './ssh';

export class ScriptRunnerService {
  async run(sshService: SSHService, connId: string, scriptContent: string): Promise<void> {
    // Replace {{VARIABLE}} patterns should be handled on the frontend side
    // before calling this method, so we just send the script to the terminal
    const lines = scriptContent.split('\n');
    for (const line of lines) {
      sshService.write(connId, line + '\n');
      // Small delay between lines to avoid overwhelming the terminal
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }
}
