/**
 * Bot Execution Sandbox
 *
 * In production, bots run in isolated Docker containers with:
 * - 256MB memory limit
 * - 10s CPU timeout
 * - No network access except to BTA API
 * - Read-only filesystem
 *
 * For MVP, bots connect via WebSocket from user's machine.
 * This module provides the container management interface for future use.
 */

export interface SandboxConfig {
  memoryLimit: string;
  cpuTimeout: number;
  networkPolicy: 'restricted' | 'none';
  image: string;
}

export const DEFAULT_SANDBOX_CONFIG: SandboxConfig = {
  memoryLimit: '256m',
  cpuTimeout: 10000,
  networkPolicy: 'restricted',
  image: 'bot-trade-arena/bot-runner:latest',
};

export class BotSandbox {
  // Placeholder for Docker-based execution
  // Implementation requires docker-node SDK

  async run(
    botCode: string,
    config: SandboxConfig = DEFAULT_SANDBOX_CONFIG,
  ): Promise<{ success: boolean; output: string }> {
    console.log(
      '[Sandbox] Docker execution not yet implemented. Bots run externally via WebSocket.',
    );
    return {
      success: false,
      output: 'Sandbox not available in MVP. Connect your bot via WebSocket.',
    };
  }
}

export const botSandbox = new BotSandbox();
