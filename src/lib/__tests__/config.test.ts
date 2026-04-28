// src/lib/__tests__/config.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  getServerConfig,
  getPublicConfig,
  maskToken,
  getMissingCredentials,
  isHookSecretValid,
} from '@/lib/config';

const ORIGINAL_ENV = { ...process.env };

function resetEnv() {
  process.env = { ...ORIGINAL_ENV };
  delete process.env.VTEX_ACCOUNT;
  delete process.env.VTEX_ENVIRONMENT;
  delete process.env.VTEX_APP_KEY;
  delete process.env.VTEX_APP_TOKEN;
  delete process.env.DEMO_HOOK_SECRET;
  delete process.env.AUTO_COMMIT_FEED;
  delete process.env.SIMULATE_ERP_FAILURE;
  delete process.env.INTEGRATION_MODE;
}

describe('config — getServerConfig', () => {
  beforeEach(resetEnv);
  afterEach(resetEnv);

  it('reads from process.env', () => {
    process.env.VTEX_ACCOUNT = 'demoacct';
    process.env.VTEX_APP_KEY = 'k';
    process.env.VTEX_APP_TOKEN = 'super-secret-token-value';
    const cfg = getServerConfig();
    expect(cfg.account).toBe('demoacct');
    expect(cfg.appKey).toBe('k');
    expect(cfg.appToken).toBe('super-secret-token-value');
  });

  it('defaults environment to vtexcommercestable.com.br', () => {
    expect(getServerConfig().environment).toBe('vtexcommercestable.com.br');
  });

  it('defaults autoCommitFeed and simulateErpFailure to false', () => {
    const cfg = getServerConfig();
    expect(cfg.autoCommitFeed).toBe(false);
    expect(cfg.simulateErpFailure).toBe(false);
  });

  it('parses AUTO_COMMIT_FEED=true correctly', () => {
    process.env.AUTO_COMMIT_FEED = 'true';
    expect(getServerConfig().autoCommitFeed).toBe(true);
  });

  it('parses SIMULATE_ERP_FAILURE=1 correctly', () => {
    process.env.SIMULATE_ERP_FAILURE = '1';
    expect(getServerConfig().simulateErpFailure).toBe(true);
  });

  it('honors INTEGRATION_MODE=FEED', () => {
    process.env.INTEGRATION_MODE = 'FEED';
    expect(getServerConfig().integrationMode).toBe('FEED');
  });

  it('defaults integrationMode to HOOK', () => {
    expect(getServerConfig().integrationMode).toBe('HOOK');
  });
});

describe('config — getPublicConfig (CONFIG-05, SEC-04 GUARD)', () => {
  beforeEach(resetEnv);
  afterEach(resetEnv);

  it('returns appTokenConfigured=false when token is empty', () => {
    const pub = getPublicConfig();
    expect(pub.appTokenConfigured).toBe(false);
    // The literal token field must NOT exist on the public config.
    expect((pub as Record<string, unknown>).appToken).toBeUndefined();
  });

  it('returns appTokenConfigured=true when token is set', () => {
    process.env.VTEX_APP_TOKEN = 'secret-token-value';
    const pub = getPublicConfig();
    expect(pub.appTokenConfigured).toBe(true);
    expect((pub as Record<string, unknown>).appToken).toBeUndefined();
  });

  it('JSON-serialized public config never contains the token value', () => {
    process.env.VTEX_APP_TOKEN = 'this-must-never-appear';
    const json = JSON.stringify(getPublicConfig());
    expect(json).not.toContain('this-must-never-appear');
    // Check the raw key "appToken" (as a JSON key, not "appTokenConfigured") is absent.
    expect(json).not.toContain('"appToken":');
  });

  it('JSON-serialized public config never contains the demo-hook-secret', () => {
    process.env.DEMO_HOOK_SECRET = 'hidden-hook-secret';
    const json = JSON.stringify(getPublicConfig());
    expect(json).not.toContain('hidden-hook-secret');
    expect(json).not.toContain('demoHookSecret');
  });
});

describe('config — maskToken', () => {
  it('returns *** for empty input', () => {
    expect(maskToken(undefined)).toBe('***');
    expect(maskToken(null)).toBe('***');
    expect(maskToken('')).toBe('***');
  });

  it('returns *** for short tokens (<= 6 chars)', () => {
    expect(maskToken('abc')).toBe('***');
    expect(maskToken('abcdef')).toBe('***');
  });

  it('returns first4 + *** + last2 for long tokens', () => {
    expect(maskToken('1234567890')).toBe('1234***90');
  });
});

describe('config — getMissingCredentials', () => {
  beforeEach(resetEnv);
  afterEach(resetEnv);

  it('reports all four missing on empty env', () => {
    // environment defaults to vtexcommercestable.com.br so it is never missing.
    const missing = getMissingCredentials();
    expect(missing).toContain('account');
    expect(missing).toContain('appKey');
    expect(missing).toContain('appToken');
  });

  it('reports empty array when fully configured', () => {
    process.env.VTEX_ACCOUNT = 'a';
    process.env.VTEX_APP_KEY = 'k';
    process.env.VTEX_APP_TOKEN = 't';
    expect(getMissingCredentials()).toEqual([]);
  });
});

describe('config — isHookSecretValid', () => {
  beforeEach(resetEnv);
  afterEach(resetEnv);

  it('returns true when DEMO_HOOK_SECRET is unset (validation disabled)', () => {
    expect(isHookSecretValid('anything')).toBe(true);
    expect(isHookSecretValid(null)).toBe(true);
  });

  it('returns true when header matches secret', () => {
    process.env.DEMO_HOOK_SECRET = 'open-sesame';
    expect(isHookSecretValid('open-sesame')).toBe(true);
  });

  it('returns false when header is missing or wrong', () => {
    process.env.DEMO_HOOK_SECRET = 'open-sesame';
    expect(isHookSecretValid('wrong')).toBe(false);
    expect(isHookSecretValid(null)).toBe(false);
  });
});
