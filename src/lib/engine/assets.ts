/** `asset:<id>` references point at images stored locally in IndexedDB. */
export const ASSET_PREFIX = 'asset:';

export function isAssetRef(src: string | undefined | null): boolean {
  return typeof src === 'string' && src.startsWith(ASSET_PREFIX);
}

export function assetIdOf(src: string): string {
  return src.slice(ASSET_PREFIX.length);
}

export function assetRef(id: string): string {
  return `${ASSET_PREFIX}${id}`;
}

export const TRANSPARENT_PIXEL = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
