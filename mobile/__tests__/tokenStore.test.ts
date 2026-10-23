import { tokenStore } from '../src/services/tokenStore';
import { Platform } from 'react-native';

// jest-expo runs the native project with Platform.OS = 'ios' (and a 'web'
// project). The token store is a no-op on web and persists via SecureStore on
// native. We assert behavior for the current platform.
describe('tokenStore', () => {
  afterEach(async () => {
    await tokenStore.clear();
  });

  test('save then authHeaders round-trips the access token on native', async () => {
    await tokenStore.save({ access_token: 'acc-123', refresh_token: 'ref-456' });
    const headers = await tokenStore.authHeaders();
    if (Platform.OS === 'web') {
      // Web relies on the cookie — no auth headers are produced.
      expect(headers).toEqual({});
    } else {
      expect(headers.Authorization).toBe('Bearer acc-123');
      expect(headers['X-Refresh-Token']).toBe('ref-456');
    }
  });

  test('clear removes tokens so no auth header is sent', async () => {
    await tokenStore.save({ access_token: 'acc-123', refresh_token: 'ref-456' });
    await tokenStore.clear();
    const headers = await tokenStore.authHeaders();
    expect(headers.Authorization).toBeUndefined();
  });

  test('save ignores a null/empty token payload', async () => {
    await tokenStore.save(null);
    const headers = await tokenStore.authHeaders();
    expect(headers.Authorization).toBeUndefined();
  });
});
