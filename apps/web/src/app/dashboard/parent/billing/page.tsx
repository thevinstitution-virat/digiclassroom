import DashboardPlaceholder from '@/components/dashboard/DashboardPlaceholder'
import { CreditCard } from 'lucide-react'

export default function ParentBillingPage() {
  return (
    <DashboardPlaceholder
      title="Billing & Subscription"
      description="Manage your child's plan, payment methods, and invoices."
      icon={CreditCard}
      points={['Current plan & renewal', 'Payment history & invoices', 'Upgrade / change plan']}
    />
  )
}
