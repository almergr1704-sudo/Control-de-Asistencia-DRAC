/**
 * Utility to resolve API URLs correctly across Web browser and Electron file:// protocol.
 */
export const getApiUrl = (endpoint: string): string => {
  const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  if (typeof window !== 'undefined' && window.location.protocol === 'file:') {
    return `http://localhost:3000${path}`;
  }
  return path;
};
