import DashboardLayout from '@/components/layout/DashboardLayout'
import UserSidebarWrapper from '@/components/core/layout/UserSidebarWrapper'

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  return (
    <DashboardLayout sidebar={<UserSidebarWrapper />}>
      {children}
    </DashboardLayout>
  )
}
