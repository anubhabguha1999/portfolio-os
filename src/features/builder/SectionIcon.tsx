import {
  AtSign,
  BadgeCheck,
  Briefcase,
  ChartNoAxesColumn,
  CodeXml,
  FolderKanban,
  GitCommitVertical,
  GraduationCap,
  Handshake,
  Images,
  Layers,
  Mail,
  Newspaper,
  Quote,
  Sparkles,
  Square,
  Trophy,
  User,
  type LucideIcon,
} from 'lucide-react';

const ICONS: Record<string, LucideIcon> = {
  AtSign,
  BadgeCheck,
  Briefcase,
  ChartNoAxesColumn,
  CodeXml,
  FolderKanban,
  GitCommitVertical,
  GraduationCap,
  Handshake,
  Images,
  Layers,
  Mail,
  Newspaper,
  Quote,
  Sparkles,
  Trophy,
  User,
};

export function SectionIcon({ name, className }: { name: string; className?: string }) {
  const Icon = ICONS[name] ?? Square;
  return <Icon className={className} aria-hidden="true" />;
}
