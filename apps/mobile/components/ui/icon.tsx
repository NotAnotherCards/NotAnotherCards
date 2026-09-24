import { cssInterop } from 'nativewind';
import {
  BookMarked,
  BookOpen,
  Flame,
  Globe,
  GraduationCap,
  Info,
  Library,
  LogOut,
  Medal,
  Settings,
  Sparkles,
  Trophy,
  User,
  type LucideIcon,
} from 'lucide-react-native';

// Lucide icons take a `color` prop, not classes. Mapping className onto it
// lets icons use the same semantic tokens as text (text-muted-foreground,
// text-destructive) and follow dark mode through global.css, the way
// react-native-reusables' iconWithClassName does. Add icons here as they
// are used; web's set is lucide-react, same names.
function withClassName(icon: LucideIcon): LucideIcon {
  cssInterop(icon, {
    className: { target: 'style', nativeStyleToProp: { color: true } },
  });
  return icon;
}

export const BookMarkedIcon = withClassName(BookMarked);
export const BookOpenIcon = withClassName(BookOpen);
export const FlameIcon = withClassName(Flame);
export const GlobeIcon = withClassName(Globe);
export const GraduationCapIcon = withClassName(GraduationCap);
export const InfoIcon = withClassName(Info);
export const LibraryIcon = withClassName(Library);
export const LogOutIcon = withClassName(LogOut);
export const MedalIcon = withClassName(Medal);
export const SettingsIcon = withClassName(Settings);
export const SparklesIcon = withClassName(Sparkles);
export const TrophyIcon = withClassName(Trophy);
export const UserIcon = withClassName(User);
export type { LucideIcon };
