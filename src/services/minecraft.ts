import { Rcon } from 'rcon-client';
import { config } from '../config.js';
import { minecraftUsernameSchema } from '../domain/validation.js';

export class MinecraftService {
  private async command(command: string): Promise<string> {
    const rcon = await Rcon.connect({
      host: config.rcon.host,
      port: config.rcon.port,
      password: config.rcon.password,
      timeout: 5_000
    });
    try {
      return await rcon.send(command);
    } finally {
      await rcon.end();
    }
  }

  async addToWhitelist(username: string): Promise<string> {
    const safeUsername = minecraftUsernameSchema.parse(username);
    const response = await this.command(`whitelist add ${safeUsername}`);
    const list = await this.command('whitelist list');
    if (!whitelistContains(list, safeUsername)) {
      throw new Error(`O Minecraft recusou a whitelist: ${response}`);
    }
    return response;
  }

  async removeFromWhitelist(username: string): Promise<string> {
    const safeUsername = minecraftUsernameSchema.parse(username);
    const response = await this.command(`whitelist remove ${safeUsername}`);
    const list = await this.command('whitelist list');
    if (whitelistContains(list, safeUsername)) {
      throw new Error(`O Minecraft recusou a remoção: ${response}`);
    }
    return response;
  }

  async status(): Promise<string> {
    return this.command('list');
  }
}

function whitelistContains(list: string, username: string): boolean {
  const names = list.toLowerCase().split(/[^a-z0-9_]+/).filter(Boolean);
  return names.includes(username.toLowerCase());
}
