import {
  Home,
  Brain,
  Users,
  StickyNote,
  CalendarClock,
  CheckSquare,
  Target,
  Sparkles,
  MessageCircleQuestion,
  Settings,
  Palette,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export const navItems: NavItem[] = [
  { href: "/", label: "Home", icon: Home },
  { href: "/memory", label: "Memory", icon: Brain },
  { href: "/people", label: "People", icon: Users },
  { href: "/notes", label: "Notes", icon: StickyNote },
  { href: "/meetings", label: "Meetings", icon: CalendarClock },
  { href: "/colors", label: "Colors", icon: Palette },
  { href: "/tasks", label: "Tasks", icon: CheckSquare },
  { href: "/goals", label: "Goals", icon: Target },
  { href: "/reflections", label: "Reflections", icon: Sparkles },
  { href: "/assistant", label: "AI Assistant", icon: MessageCircleQuestion },
  { href: "/settings", label: "Settings", icon: Settings },
];
