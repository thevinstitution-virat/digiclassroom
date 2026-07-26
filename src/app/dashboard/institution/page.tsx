// src/app/dashboard/institution/page.tsx — institution-admin landing (auto-built from INSTITUTION_NAV)
import Link from 'next/link'
import { INSTITUTION_NAV } from '@/lib/dashboard/dashboard-nav'

export default function InstitutionDashboardPage() {
  const cards = INSTITUTION_NAV.filter((i) => i.href !== '/dashboard/institution')

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="bg-gradient-to-r from-violet-600 to-blue-600 bg-clip-text text-2xl font-bold text-transparent">
        Institution Dashboard
      </h1>
      <p className="mt-2 text-gray-600 dark:text-gray-300">
        Manage your institution&apos;s teachers, students, classes, and content.
      </p>

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => {
          const Icon = card.icon
          return (
            <Link
              key={card.href}
              href={card.href}
              className="group rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md dark:border-gray-700 dark:bg-gray-800"
            >
              <div
                className={`mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${card.gradient ?? 'from-violet-500 to-blue-600'} shadow`}
              >
                <Icon className="h-6 w-6 text-white" />
              </div>
              <h3 className="font-bold text-gray-900 dark:text-white">{card.name}</h3>
              {card.description && (
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{card.description}</p>
              )}
            </Link>
          )
        })}
      </div>
    </div>
  )
}
