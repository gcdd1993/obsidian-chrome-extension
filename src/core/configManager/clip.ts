import { STORAGE_KEYS } from '@/config';
import { storage } from '@/isomorphic/storage';
import { ConfigManagerBase } from './base';

export type IClipConfig = {
  // 是否在文章底部加入链接
  addLink: boolean;
  // Obsidian Local REST API 地址
  obsidianApiUrl: string;
  // Obsidian Local REST API Key
  obsidianApiKey: string;
  // Obsidian 导出根目录
  obsidianExportDir: string;
};

export type ClipConfigKey = keyof IClipConfig;

class ClipConfigManager extends ConfigManagerBase {
  protected configKey: string = STORAGE_KEYS.SETTINGS.CLIP_CONFIG;
  protected defaultConfig: IClipConfig = {
    addLink: true,
    obsidianApiUrl: 'https://127.0.0.1:27124',
    obsidianApiKey: '',
    obsidianExportDir: 'Yuque Export',
  };

  async get() {
    const config: IClipConfig = (await storage.get(this.configKey)) || {};
    const result = this.mergerBaseConfig(config) as IClipConfig;
    return result;
  }

  async update(key: ClipConfigKey, value: IClipConfig[ClipConfigKey]) {
    const config = await this.get();
    const result: IClipConfig = {
      ...config,
      [key]: value,
    };
    await storage.update(this.configKey, result);
    return result;
  }
}

export const clipConfigManager = new ClipConfigManager();
