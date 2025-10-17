import type { SharedConfig, ConfigListener } from './types';

class ConfigService {
  private config: SharedConfig = {
    rps: 10,
    primaryAlgorithm: 'token-bucket',
    secondaryAlgorithm: 'leaky-bucket',
  };

  private listeners: ConfigListener[] = [];

  constructor() {
    // Load from localStorage if available
    const stored = localStorage.getItem('sharedConfig');
    if (stored) {
      try {
        this.config = JSON.parse(stored);
      } catch (e) {
        console.warn('Failed to parse stored config, using defaults');
      }
    }
  }

  subscribe(listener: ConfigListener): void {
    this.listeners.push(listener);
    // Immediately notify with current config
    listener(this.config);
  }

  unsubscribe(listener: ConfigListener): void {
    const index = this.listeners.indexOf(listener);
    if (index > -1) {
      this.listeners.splice(index, 1);
    }
  }

  getConfig(): SharedConfig {
    return { ...this.config };
  }

  updateRPS(value: number): void {
    this.config.rps = value;
    this.broadcast();
    this.persist();
  }

  updatePrimaryAlgorithm(algorithm: 'token-bucket' | 'leaky-bucket'): void {
    this.config.primaryAlgorithm = algorithm;
    this.broadcast();
    this.persist();
  }

  updateSecondaryAlgorithm(algorithm: 'token-bucket' | 'leaky-bucket'): void {
    this.config.secondaryAlgorithm = algorithm;
    this.broadcast();
    this.persist();
  }

  private broadcast(): void {
    this.listeners.forEach(listener => listener(this.config));
  }

  private persist(): void {
    localStorage.setItem('sharedConfig', JSON.stringify(this.config));
  }
}

// Export singleton instance
export const configService = new ConfigService();
