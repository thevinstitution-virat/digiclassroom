'use client'

import React, { useState, useRef, useEffect } from 'react'
import { useListOrganizations, useActiveOrganization, organization } from '@/auth/client'
import { Building2, Check, ChevronDown, PlusCircle } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface OrganizationSwitcherProps {
  isCollapsed?: boolean;
}

export default function OrganizationSwitcher({ isCollapsed = false }: OrganizationSwitcherProps) {
  const router = useRouter()
  const { data: activeOrg } = useActiveOrganization()
  const { data: orgs } = useListOrganizations()
  
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown when outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSwitch = async (orgId: string) => {
    try {
      await organization.setActive({ organizationId: orgId });
      setIsOpen(false);
      router.refresh();
    } catch (e) {
      console.error("Error switching org", e);
    }
  }

  return (
    <div className="relative w-full" ref={dropdownRef}>
      <button 
        onClick={() => !isCollapsed && setIsOpen(!isOpen)}
        className={`w-full flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'} p-3 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors border border-transparent hover:border-gray-200 dark:hover:border-gray-700`}
      >
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center flex-shrink-0">
            <Building2 className="w-4 h-4" />
          </div>
          {!isCollapsed && (
            <div className="flex flex-col items-start truncate text-left">
              <span className="text-sm font-semibold text-gray-900 dark:text-white truncate w-full">
                {activeOrg ? activeOrg.name : 'Select Institution'}
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {activeOrg ? 'Active Workspace' : 'Click to choose'}
              </span>
            </div>
          )}
        </div>
        {!isCollapsed && (
          <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
        )}
      </button>

      {/* Dropdown */}
      {!isCollapsed && isOpen && (
        <div className="absolute top-full left-0 mt-2 w-full bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-100 dark:border-gray-700 py-2 z-50">
          <div className="px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider">
            Your Institutions
          </div>
          
          <div className="max-h-64 overflow-y-auto px-2">
            {orgs && orgs.length > 0 ? (
              orgs.map((org: any) => (
                <button
                  key={org.id}
                  onClick={() => handleSwitch(org.id)}
                  className={`w-full flex items-center justify-between p-2 rounded-lg text-sm text-left transition-colors ${
                    activeOrg?.id === org.id 
                    ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 font-medium' 
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                  }`}
                >
                  <span className="truncate pr-2">{org.name}</span>
                  {activeOrg?.id === org.id && <Check className="w-4 h-4 flex-shrink-0" />}
                </button>
              ))
            ) : (
              <div className="px-2 py-3 text-sm text-gray-500 text-center">
                No institutions found
              </div>
            )}
          </div>

          <div className="border-t border-gray-100 dark:border-gray-700 mt-2 pt-2 px-2">
            <button
              onClick={() => {
                setIsOpen(false);
                router.push('/dashboard/super-admin/onboarding');
              }}
              className="w-full flex items-center gap-2 p-2 rounded-lg text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Create Institution</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
