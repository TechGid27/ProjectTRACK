import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

/**
 * Persistent session-token store for NATIVE clients.
 *
 * The backend keeps the session in an HTTP-only cookie for the web app, but
 * React Native / the APK cannot rely on a cookie jar. On native we therefore
 * persist the Supabase access/refresh tokens in the OS secure keystore
 * (expo-secure-store) and send them back as Authorization / X-Refresh-Token
 * headers. On web this is a no-op — the cookie handles persistence.
 */

const ACCESS_KEY = 'pt_access_token';
const REFRESH_KEY = 'pt_refresh_token';

const isNative = Platform.OS !== 'web';

export interface SessionTokens {
  access_token: string;
  refresh_token?: string | null;
}

let memoryAccess: string | null = null;
let memoryRefresh: string | null = null;

export const tokenStore = {
  /** Persist tokens after sign-in / OAuth (native only). */
  async save(tokens: SessionTokens | null | undefined): Promise<void> {
    if (!isNative || !tokens?.access_token) return;
    memoryAccess = tokens.access_token;
    memoryRefresh = tokens.refresh_token ?? null;
    try {
      await SecureStore.setItemAsync(ACCESS_KEY, tokens.access_token);
      if (tokens.refresh_token) {
        await SecureStore.setItemAsync(REFRESH_KEY, tokens.refresh_token);
      } else {
        await SecureStore.deleteItemAsync(REFRESH_KEY);
      }
    } catch {
      // Keep the in-memory copy even if the keystore write fails.
    }
  },

  /** Load the stored access token (native only). */
  async getAccessToken(): Promise<string | null> {
    if (!isNative) return null;
    if (memoryAccess) return memoryAccess;
    try {
      memoryAccess = await SecureStore.getItemAsync(ACCESS_KEY);
    } catch {
      memoryAccess = null;
    }
    return memoryAccess;
  },

  /** Load the stored refresh token (native only). */
  async getRefreshToken(): Promise<string | null> {
    if (!isNative) return null;
    if (memoryRefresh) return memoryRefresh;
    try {
      memoryRefresh = await SecureStore.getItemAsync(REFRESH_KEY);
    } catch {
      memoryRefresh = null;
    }
    return memoryRefresh;
  },

  /** Build auth headers for a native request (empty on web). */
  async authHeaders(): Promise<Record<string, string>> {
    if (!isNative) return {};
    const access = await this.getAccessToken();
    if (!access) return {};
    const headers: Record<string, string> = { Authorization: `Bearer ${access}` };
    const refresh = await this.getRefreshToken();
    if (refresh) headers['X-Refresh-Token'] = refresh;
    return headers;
  },

  /** Clear tokens on sign-out (native only). */
  async clear(): Promise<void> {
    memoryAccess = null;
    memoryRefresh = null;
    if (!isNative) return;
    try {
      await SecureStore.deleteItemAsync(ACCESS_KEY);
      await SecureStore.deleteItemAsync(REFRESH_KEY);
    } catch {
      // ignore
    }
  },
};
