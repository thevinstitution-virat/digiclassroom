import DashboardPlaceholder from '@/components/dashboard/DashboardPlaceholder'
import { CreditCard } from 'lucide-react'

export default function InstitutionBillingPage() {
  return (
    <DashboardPlaceholder
      title="Billing & Subscription"
      description="Your institution's plan, seats, invoices, and payment methods."
      icon={CreditCard}
      points={['Plan & seat allocation', 'Invoices & payment history', 'Upgrade / manage subscription']}
    />
  )
}
