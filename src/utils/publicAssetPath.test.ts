import { describe, it, expect, vi, afterEach } from 'vitest';
import { publicAssetPath } from './publicAssetPath';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('publicAssetPath', () => {
  it('prefixes a relative path with BASE_URL', () => {
    vi.stubEnv('BASE_URL', '/grim-triad/');
    expect(publicAssetPath('assets/factions/necrons/icon.png')).toBe(
      '/grim-triad/assets/factions/necrons/icon.png',
    );
  });

  it('strips a leading slash from the given path before prefixing, avoiding a double slash', () => {
    vi.stubEnv('BASE_URL', '/grim-triad/');
    expect(publicAssetPath('/assets/factions/necrons/icon.png')).toBe(
      '/grim-triad/assets/factions/necrons/icon.png',
    );
  });

  it('still works correctly when BASE_URL is just "/" (root-served deployments)', () => {
    vi.stubEnv('BASE_URL', '/');
    expect(publicAssetPath('assets/factions/necrons/icon.png')).toBe(
      '/assets/factions/necrons/icon.png',
    );
  });

  it('gives the same result regardless of whether the input path had a leading slash', () => {
    vi.stubEnv('BASE_URL', '/grim-triad/');
    expect(publicAssetPath('assets/foo.png')).toBe(publicAssetPath('/assets/foo.png'));
  });
});