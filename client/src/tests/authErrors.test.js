import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiRequest } from '../services/common';
import { getAuthErrorDetails } from '../utils/authError';
import { saasAPI, TENANT_TOKEN_KEY, SUPER_TOKEN_KEY, canAccessModule, canAccessPath } from '../services/saasAPI';
import { authAPI } from '../services/authAPI';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  localStorage.clear();
});

describe('SaaS isolation and access', () => {
  const company = { status: 'active', modules: ['dashboard', 'inventory', 'users'] };
  const user = { role: 'User', isActive: true, permissions: ['inventory', 'users'] };

  it('requires both enabled company modules and user permissions', () => {
    expect(canAccessModule(user, company, 'inventory')).toBe(true);
    expect(canAccessModule(user, company, 'dashboard')).toBe(false);
    expect(canAccessModule(user, company, 'users')).toBe(false);
    expect(canAccessModule({ ...user, role: 'Admin' }, company, 'users')).toBe(true);
    expect(canAccessModule({ ...user, role: 'Admin' }, company, 'reports')).toBe(false);
    expect(canAccessModule(user, { ...company, status: 'inactive' }, 'inventory')).toBe(false);
    expect(canAccessModule({ ...user, isActive: false }, company, 'inventory')).toBe(false);
    expect(canAccessPath(user, company, '/app/inventory')).toBe(true);
    expect(canAccessPath(user, company, '/inventory')).toBe(false);
    expect(canAccessPath(user, company, '/app/unknown')).toBe(false);
  });

  it('never sends original or SuperAdmin tokens to tenant APIs', async () => {
    vi.spyOn(localStorage, 'getItem').mockImplementation(key => ({ token: 'original-token', [TENANT_TOKEN_KEY]: 'tenant-token', [SUPER_TOKEN_KEY]: 'super-token' })[key]);
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true }) });
    vi.stubGlobal('fetch', fetchMock);
    await apiRequest('/inventory');
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer tenant-token');
    expect(fetchMock.mock.calls[0][0]).not.toContain('3050');
    expect(fetchMock.mock.calls[0][0]).not.toContain('railway');
    await saasAPI.companies();
    expect(fetchMock.mock.calls[1][1].headers.Authorization).toBe('Bearer super-token');
    await saasAPI.register({ companyName: 'Test Textiles' });
    expect(fetchMock.mock.calls[2][1].headers.Authorization).toBeUndefined();
    await authAPI.login('YF001', 'admin', 'secret');
    expect(fetchMock.mock.calls[3][1].headers.Authorization).toBeUndefined();
    expect(JSON.parse(fetchMock.mock.calls[3][1].body)).toEqual({ companyCode: 'YF001', email: 'admin', password: 'secret' });
  });

  it('does not fall back to the original token when SaaS tokens are missing', async () => {
    vi.spyOn(localStorage, 'getItem').mockImplementation(key => key === 'token' ? 'original-token' : null);
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true }) });
    vi.stubGlobal('fetch', fetchMock);
    await apiRequest('/inventory');
    await saasAPI.companies();
    expect(fetchMock.mock.calls.every(([, config]) => !config.headers.Authorization)).toBe(true);
  });
});

describe('authentication error handling', () => {
  it('keeps invalid login credentials separate from session expiry', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: vi.fn().mockResolvedValue({
        code: 'INVALID_CREDENTIALS',
        message: 'The email or password you entered is incorrect.',
      }),
    }));

    await expect(apiRequest('/auth/login')).rejects.toMatchObject({
      status: 401,
      code: 'INVALID_CREDENTIALS',
    });
  });

  it('presents server downtime as a retryable maintenance state', () => {
    expect(getAuthErrorDetails({
      status: 503,
      code: 'SERVICE_UNAVAILABLE',
      message: 'YarnFlow is temporarily unavailable.',
    })).toMatchObject({
      type: 'maintenance',
      canRetry: true,
    });
  });

  it('presents connection failures as a retryable network state', () => {
    expect(getAuthErrorDetails({ code: 'NETWORK_ERROR' })).toMatchObject({
      type: 'network',
      canRetry: true,
    });
  });

  it('stops waiting and exposes a retryable timeout error', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn((url, config) => new Promise((resolve, reject) => {
      config.signal.addEventListener('abort', () => {
        reject(new DOMException('Request aborted', 'AbortError'));
      });
    })));

    const request = expect(apiRequest('/auth/login')).rejects.toMatchObject({
      code: 'REQUEST_TIMEOUT',
      retryable: true,
    });
    await vi.advanceTimersByTimeAsync(15000);
    await request;
  });

  it('presents duplicate registration as a non-retryable account state', () => {
    expect(getAuthErrorDetails({
      status: 409,
      code: 'EMAIL_ALREADY_REGISTERED',
    }, 'register')).toMatchObject({
      type: 'account',
      title: 'Account already exists',
      canRetry: false,
    });
  });
});
