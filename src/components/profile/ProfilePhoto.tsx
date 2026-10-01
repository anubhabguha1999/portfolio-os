import { useImageUrls } from '@/studio/images/service';
import { photoKey } from '@/studio/model/resolve';
import type { ProfileImage } from '@/studio/model/types';

/** The profile photo rendered as a circle. Loaded lazily: it pulls in the image pipeline. */
export default function ProfilePhoto({ image, className }: { image: ProfileImage; className?: string }) {
  const variant = image.variants.find((v) => v.id === image.usage.portfolio) ?? image.variants[0];
  const key = variant ? photoKey(variant.id, 'circle') : '';
  const url = useImageUrls(key ? [key] : [])(key);
  return url ? <img src={url} alt="" className={className} /> : null;
}
