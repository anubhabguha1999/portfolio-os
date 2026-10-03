import { BRAND } from '@/config/brand';
import { cn } from '@/utils/cn';

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn('size-6', className)} aria-hidden="true">
      <defs>
        <linearGradient id="lg-mark" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#b3a8ff" />
          <stop offset="1" stopColor="#6a58f5" />
        </linearGradient>
      </defs>
      <rect x="1" y="1" width="30" height="30" rx="9" fill="url(#lg-mark)" />
      <path d="M10 22V10h6.2a4.2 4.2 0 0 1 0 8.4H10" fill="none" stroke="#0b0716" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="22.5" cy="22" r="2" fill="#0b0716" />
    </svg>
  );
}

export function Logo({ className, compact }: { className?: string; compact?: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-2 font-semibold tracking-tight whitespace-nowrap', className)}>
      <LogoMark className="shrink-0" />
      {!compact && <span className="text-[14px]">{BRAND.name}</span>}
    </span>
  );
}
