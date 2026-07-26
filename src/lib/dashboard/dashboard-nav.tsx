// src/lib/dashboard/dashboard-nav.tsx
// ============================================================================
// CANONICAL ROLE → DASHBOARD → FEATURES MATRIX  (single source of truth)
// ============================================================================
// TRIO NOTE: the TIER STRUCTURE below is shared across the three apps —
//   DigiClassroom Pro · PDLMS · Vidyaverse.
// Only the per-tier FEATURE CONTENT differs by app domain. Keep the tiers and
// their access rules identical across the trio; swap the nav items per app.
//
//   Tier              DCP role               Dashboard
//   ----------------  ---------------------  ----------------------
//   Platform Owner    super_admin            /dashboard/super-admin  (sole platform tier)
//   Institution Admin admin | owner |        /dashboard/institution
//                     org_admin
//   Teacher           teacher                /dashboard/teacher
//   Student           student                /dashboard/user
//   Parent (DCP-only) parent                 /dashboard/parent
//
// B2B2C: the platform dashboard is super_admin-ONLY (the layout redirects every
// other role), so PLATFORM_NAV is organised into SECTIONS rather than gated by
// `ownerOnly`. The `section` field drives the grouped sidebar headers.

import {
  Home, Users, FileText, Folder, Target, Database, BarChart3, Activity,
  Brain, Settings, ShieldCheck, CreditCard, Flag, Building2, AlertTriangle,
  CheckCircle, BookOpen, GraduationCap, ClipboardCheck, MessageSquare,
  Bookmark, Heart, Rocket, Search, FolderTree, User, CalendarCheck, LineChart,
  SlidersHorizontal,
} from 'lucide-react';
import type { Role, OrgRole } from '@/auth/permissions';

export interface DashboardNavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  description?: string;
  featured?: boolean;
  gradient?: string;
  /** Grouped-sidebar section label (e.g. 'Institutions'). Consecutive items
   *  sharing a section render together under one header. */
  section?: string;
  /** @deprecated platform dashboard is super_admin-only; retained for back-compat. */
  ownerOnly?: boolean;
}

// ── Platform dashboard — super_admin ONLY, grouped into sections ─────────────
// Order reflects platform-owner priorities: tenant governance first, then the
// global content/AI surfaces, then platform controls.
export const PLATFORM_NAV: DashboardNavItem[] = [
  // Overview
  { section: 'Overview', name: 'Dashboard', href: '/dashboard/super-admin', icon: Home, description: 'Platform overview & metrics' },

  // Institutions (B2B) — the core of the platform, promoted to the top
  { section: 'Institutions', name: 'Organizations', href: '/dashboard/super-admin/organizations', icon: Building2, description: 'All institutions', gradient: 'from-violet-500 to-purple-600' },
  { section: 'Institutions', name: 'Onboard Institution', href: '/dashboard/super-admin/onboarding', icon: Rocket, description: 'Create a new institution', gradient: 'from-violet-500 to-purple-600' },
  { section: 'Institutions', name: 'Subscription Plans', href: '/dashboard/super-admin/plans', icon: CreditCard, description: 'Billing & plan management', gradient: 'from-emerald-500 to-green-600' },

  // People & Access
  { section: 'People & Access', name: 'Users', href: '/dashboard/super-admin/users', icon: Users, description: 'All users & role assignment' },
  { section: 'People & Access', name: 'Teacher Approvals', href: '/dashboard/super-admin/teacher-verification', icon: CheckCircle, description: 'Direct (B2C) teacher applications' },
  { section: 'People & Access', name: 'Join Requests', href: '/dashboard/super-admin/join-requests', icon: ClipboardCheck, description: 'Student requests to join institutions' },

  // Content & Knowledge — global content management
  { section: 'Content & Knowledge', name: 'Content', href: '/dashboard/super-admin/content', icon: FileText, description: 'NCERT content & ingestion' },
  { section: 'Content & Knowledge', name: 'Study Materials', href: '/dashboard/super-admin/materials', icon: Folder, description: 'Materials & Drive sync' },
  { section: 'Content & Knowledge', name: 'Practest Engine', href: '/dashboard/super-admin/practest', icon: Target, description: 'Assessment & question bank' },

  // AI & Infrastructure
  { section: 'AI & Infrastructure', name: 'Sarvagya AI', href: '/dashboard/super-admin/sarvagya', icon: Brain, description: 'Document-AI microservice', gradient: 'from-amber-500 to-orange-500' },
  { section: 'AI & Infrastructure', name: 'Vector DB', href: '/dashboard/super-admin/database', icon: Database, description: 'AI knowledge base' },
  { section: 'AI & Infrastructure', name: 'Performance', href: '/dashboard/super-admin/performance', icon: Activity, description: 'System monitoring' },

  // Insights
  { section: 'Insights', name: 'Analytics', href: '/dashboard/super-admin/quality-metrics', icon: BarChart3, description: 'Usage & RAG quality' },

  // Platform Control
  { section: 'Platform Control', name: 'Feature Flags', href: '/dashboard/super-admin/feature-flags', icon: Flag, description: 'Platform toggles', gradient: 'from-sky-500 to-blue-600' },
  { section: 'Platform Control', name: 'Platform Settings', href: '/dashboard/super-admin/settings', icon: Settings, description: 'Global configuration' },
  { section: 'Platform Control', name: 'Danger Zone', href: '/dashboard/super-admin/danger-zone', icon: AlertTriangle, description: 'Destructive operations', gradient: 'from-red-500 to-rose-600' },
];

// ── Institution dashboard (admin | owner | org_admin) — org-scoped, grouped ──
// Every item is scoped to the admin's OWN institution (NO platform-level options).
// Sections mirror the platform sidebar one tier down: roster → academics →
// insights → account.
export const INSTITUTION_NAV: DashboardNavItem[] = [
  // Overview
  { section: 'Overview', name: 'Dashboard', href: '/dashboard/institution', icon: Home, description: 'Institution overview' },

  // People — the institution's roster
  { section: 'People', name: 'Teachers', href: '/dashboard/institution/teachers', icon: GraduationCap, description: 'Invite & manage teachers' },
  { section: 'People', name: 'Students', href: '/dashboard/institution/students', icon: Users, description: 'Enroll & manage students' },
  { section: 'People', name: 'Join Requests', href: '/dashboard/institution/join-requests', icon: ClipboardCheck, description: 'Approve students requesting to join' },

  // Academics — structure, materials & the modules students get
  { section: 'Academics', name: 'Classes', href: '/dashboard/institution/classes', icon: BookOpen, description: 'Classes & sections' },
  { section: 'Academics', name: 'Content', href: '/dashboard/institution/content', icon: FileText, description: "Your institution's materials" },
  { section: 'Academics', name: 'Features', href: '/dashboard/institution/features', icon: SlidersHorizontal, description: 'Enable modules for your students', gradient: 'from-sky-500 to-blue-600' },

  // Insights
  { section: 'Insights', name: 'Analytics', href: '/dashboard/institution/analytics', icon: LineChart, description: 'Engagement & performance' },

  // Account — the institution's own subscription & profile
  { section: 'Account', name: 'Billing', href: '/dashboard/institution/billing', icon: CreditCard, description: 'Subscription & invoices' },
  { section: 'Account', name: 'Settings', href: '/dashboard/institution/settings', icon: Settings, description: 'Institution profile & branding' },
];

// ── Teacher dashboard ───────────────────────────────────────────────────────
export const TEACHER_NAV: DashboardNavItem[] = [
  { name: 'Dashboard', href: '/dashboard/teacher', icon: Home, description: 'Teaching overview' },
  { name: 'My Classes', href: '/dashboard/teacher/classes', icon: BookOpen, description: 'Classes you teach', featured: true },
  { name: 'Students', href: '/dashboard/teacher/students', icon: Users, description: 'Your students' },
  { name: 'Content Validation', href: '/dashboard/teacher/validation', icon: ClipboardCheck, description: 'Review & approve content' },
  { name: 'AI Tutor', href: '/dashboard/user/ai-tutor', icon: Brain, description: 'Teaching assistant', featured: true, gradient: 'from-purple-500 to-indigo-600' },
];

// ── Student dashboard ───────────────────────────────────────────────────────
export const STUDENT_NAV: DashboardNavItem[] = [
  { name: 'Dashboard', href: '/dashboard/user', icon: Home, description: 'Overview & activities', gradient: 'from-slate-500 to-gray-600' },
  { name: 'AI Tutor', href: '/dashboard/user/ai-tutor', icon: Brain, description: 'Chat with your AI teacher', featured: true, gradient: 'from-purple-500 to-indigo-600' },
  { name: 'Sarvagya', href: '/dashboard/sarvagya', icon: Search, description: 'AI research assistant', featured: true, gradient: 'from-amber-500 to-orange-500' },
  { name: 'Study Materials', href: '/dashboard/user/materials', icon: BookOpen, description: 'Course content', featured: true, gradient: 'from-green-500 to-emerald-500' },
  { name: 'Practest', href: '/dashboard/user/practest', icon: FileText, description: 'AI assessment engine', featured: true, gradient: 'from-blue-500 to-cyan-500' },
  { name: 'Sanchika', href: '/dashboard/user/sanchika', icon: FolderTree, description: 'Smart notes workspace', featured: true, gradient: 'from-cyan-500 to-blue-600' },
  { name: 'Dictionary', href: '/dashboard/user/dictionary', icon: Bookmark, description: 'English-Hindi dictionary', featured: true, gradient: 'from-pink-500 to-rose-500' },
  { name: 'Mitram', href: '/dashboard/user/mitram', icon: Heart, description: 'Focus & aptitude', featured: true, gradient: 'from-teal-500 to-blue-500' },
  { name: 'Productivity', href: '/dashboard/user/productivity', icon: Rocket, description: 'Study tools', featured: true, gradient: 'from-orange-500 to-red-500' },
  { name: 'Subscription', href: '/dashboard/user/pricing', icon: CreditCard, description: 'Plan & billing', gradient: 'from-slate-400 to-slate-500' },
  { name: 'Profile', href: '/dashboard/user/profile', icon: User, description: 'Settings & preferences', gradient: 'from-indigo-500 to-purple-500' },
];

// ── Parent dashboard (DCP-specific tier) ────────────────────────────────────
export const PARENT_NAV: DashboardNavItem[] = [
  { name: 'Dashboard', href: '/dashboard/parent', icon: Home, description: "Your child's overview" },
  { name: 'Child Progress', href: '/dashboard/parent/progress', icon: LineChart, description: 'Learning progress & scores', featured: true, gradient: 'from-green-500 to-emerald-500' },
  { name: 'Reports', href: '/dashboard/parent/reports', icon: FileText, description: 'ParentPulse reports', featured: true, gradient: 'from-blue-500 to-indigo-500' },
  { name: 'Attendance', href: '/dashboard/parent/attendance', icon: CalendarCheck, description: 'Engagement & attendance' },
  { name: 'Messages', href: '/dashboard/parent/messages', icon: MessageSquare, description: 'School communication' },
  { name: 'Billing', href: '/dashboard/parent/billing', icon: CreditCard, description: 'Subscription & payments' },
  { name: 'Profile', href: '/dashboard/parent/profile', icon: User, description: 'Account settings' },
];

// ── Role → home dashboard (mirrors /api/me resolveDashboard) ─────────────────
export function dashboardHome(globalRole: Role, orgRole: OrgRole | null): string {
  // B2B2C: super_admin is the ONLY platform tier; admin = institution administrator.
  if (globalRole === 'super_admin') return '/dashboard/super-admin';
  if (globalRole === 'admin' || orgRole === 'owner' || orgRole === 'org_admin') return '/dashboard/institution';
  if (globalRole === 'teacher') return '/dashboard/teacher';
  if (globalRole === 'parent') return '/dashboard/parent';
  return '/dashboard/user';
}

/** Filter a nav list by whether the viewer is the platform owner (super_admin). */
export function visibleNav(items: DashboardNavItem[], isOwner: boolean): DashboardNavItem[] {
  return isOwner ? items : items.filter((i) => !i.ownerOnly);
}
