/**
 * DigiClassroom Design System - Educational Components
 * Specialized components for educational applications
 */

import React, { useState } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'

// Utility function for class name merging
const cn = (...classes: (string | undefined | null | boolean)[]) => {
  return classes.filter(Boolean).join(' ')
}

// ===== ADMIN SIDEBAR COMPONENT =====

export interface NavigationItem {
  name: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  description?: string
  featured?: boolean
  badge?: string | number
}

export interface AdminSidebarProps {
  navigation: NavigationItem[]
  user?: {
    firstName?: string | null
    lastName?: string | null
    emailAddress?: string | null
  } | null
  brandName: string
  brandSubtitle: string
  isCollapsed?: boolean
  onToggle?: () => void
}

export const AdminSidebar: React.FC<AdminSidebarProps> = ({
  navigation,
  user,
  brandName,
  brandSubtitle,
  isCollapsed = false,
  onToggle
}) => {
  return (
    <div className={`
      flex h-full flex-col border-r transition-all duration-200 ease-in-out
      ${isCollapsed ? 'w-16' : 'w-64'}
      bg-white/90 backdrop-blur-xl border-gray-200/30
      shadow-xl rounded-r-2xl
    `}>
      {/* Header */}
      <div className="flex h-20 shrink-0 items-center px-4 border-b border-gray-200/30">
        <div className="flex items-center w-full">
          <div className="flex items-center flex-1 min-w-0">
            <div className="w-10 h-10 bg-gradient-to-r from-vg-primary-500 to-vg-secondary-500 rounded-xl flex items-center justify-center shadow-lg">
              <span className="font-bold text-sm text-white">VG</span>
            </div>
            {!isCollapsed && (
              <div className="ml-3 flex-1 min-w-0">
                <h1 className="text-lg font-bold text-gray-900 truncate">{brandName}</h1>
                <p className="text-xs text-gray-500 truncate">{brandSubtitle}</p>
              </div>
            )}
          </div>
          <button
            onClick={onToggle}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
        {navigation.map((item) => (
          <a
            key={item.name}
            href={item.href}
            className={`
              group flex items-center px-3 py-3 text-sm font-medium rounded-xl
              transition-all duration-200 hover:bg-gradient-to-r hover:from-vg-primary-50 hover:to-vg-secondary-50
              hover:text-vg-primary-700 text-gray-700
              ${item.featured ? 'bg-gradient-to-r from-vg-primary-50 to-vg-secondary-50 text-vg-primary-700' : ''}
            `}
          >
            <item.icon className="w-5 h-5 flex-shrink-0" />
            {!isCollapsed && (
              <>
                <span className="ml-3 flex-1">{item.name}</span>
                {item.badge && (
                  <span className="ml-2 px-2 py-1 text-xs bg-vg-primary-100 text-vg-primary-700 rounded-full">
                    {item.badge}
                  </span>
                )}
              </>
            )}
          </a>
        ))}
      </nav>

      {/* User Profile */}
      {user && (
        <div className="p-4 border-t border-gray-200/30">
          <div className="flex items-center">
            <div className="w-8 h-8 bg-gradient-to-r from-vg-primary-500 to-vg-secondary-500 rounded-full flex items-center justify-center">
              <span className="text-xs font-medium text-white">
                {user.firstName?.[0]}{user.lastName?.[0]}
              </span>
            </div>
            {!isCollapsed && (
              <div className="ml-3 flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {user.firstName} {user.lastName}
                </p>
                <p className="text-xs text-gray-500 truncate">{user.emailAddress}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ===== DASHBOARD STATS CARD =====

export interface StatsCardProps {
  title: string
  value: string | number
  icon: React.ComponentType<{ className?: string }>
  trend?: {
    value: number
    isPositive: boolean
  }
  color?: 'blue' | 'green' | 'purple' | 'orange' | 'red'
  className?: string
}

export const StatsCard: React.FC<StatsCardProps> = ({
  title,
  value,
  icon: Icon,
  trend,
  color = 'blue',
  className
}) => {
  const colorClasses = {
    blue: 'from-blue-500 to-blue-600 bg-blue-100',
    green: 'from-green-500 to-green-600 bg-green-100',
    purple: 'from-purple-500 to-purple-600 bg-purple-100',
    orange: 'from-orange-500 to-orange-600 bg-orange-100',
    red: 'from-red-500 to-red-600 bg-red-100'
  }

  return (
    <div className={cn(
      "p-6 bg-gradient-to-r from-white to-gray-50 rounded-2xl border hover:shadow-lg transition-all duration-300 transform hover:scale-[1.02]",
      className
    )}>
      <div className="flex items-center justify-between mb-4">
        <div className={`w-12 h-12 bg-gradient-to-r ${colorClasses[color]} rounded-xl flex items-center justify-center shadow-lg`}>
          <Icon className="h-6 w-6 text-white" />
        </div>
        {trend && (
          <div className={`flex items-center text-sm ${trend.isPositive ? 'text-green-600' : 'text-red-600'}`}>
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                d={trend.isPositive ? "M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" : "M13 17h8m0 0V9m0 8l-8-8-4 4-6-6"} />
            </svg>
            {Math.abs(trend.value)}%
          </div>
        )}
      </div>
      <div>
        <p className="text-sm font-bold text-gray-700 mb-2">{title}</p>
        <p className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
          {typeof value === 'number' ? value.toLocaleString() : value}
        </p>
      </div>
    </div>
  )
}

// ===== AI CHAT MESSAGE COMPONENT =====

export interface ChatMessageProps {
  message: {
    id: string
    role: 'user' | 'assistant'
    content: string
    timestamp: Date
  }
  isTyping?: boolean
}

export const ChatMessage: React.FC<ChatMessageProps> = ({ message, isTyping }) => {
  return (
    <div className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'} mb-4`}>
      <div className={`flex max-w-[80%] ${message.role === 'user' ? 'flex-row-reverse' : 'flex-row'} items-start space-x-3`}>
        {/* Avatar */}
        <div className={`w-8 h-8 rounded-xl flex items-center justify-center shadow-md ${
          message.role === 'user'
            ? 'bg-gradient-to-r from-vg-primary-500 to-vg-secondary-500 text-white'
            : 'bg-gradient-to-r from-gray-100 to-gray-200 text-gray-600'
        }`}>
          {message.role === 'user' ? (
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          )}
        </div>

        {/* Message Bubble */}
        <div className={`rounded-2xl px-4 py-3 ${
          message.role === 'user' 
            ? 'bg-gradient-to-r from-vg-primary-500 to-vg-secondary-500 text-white ml-4' 
            : 'bg-white/80 backdrop-blur-sm text-gray-900 mr-4 border border-gray-200'
        }`}>
          <div className="text-sm leading-relaxed">
            {isTyping ? (
              <div className="flex items-center space-x-1">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
              </div>
            ) : (
              message.content
            )}
          </div>
          <div className={`text-xs mt-2 ${
            message.role === 'user' ? 'text-white/70' : 'text-gray-500'
          }`}>
            {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
      </div>
    </div>
  )
}

// ===== EDUCATIONAL CONTENT CARD =====

export interface ContentCardProps {
  title: string
  description: string
  subject: 'mathematics' | 'science' | 'economics' | 'general'
  className?: string
  onClick?: () => void
  children?: React.ReactNode
}

export const ContentCard: React.FC<ContentCardProps> = ({
  title,
  description,
  subject,
  className,
  onClick,
  children
}) => {
  const subjectColors = {
    mathematics: 'from-blue-500 to-blue-600',
    science: 'from-green-500 to-green-600',
    economics: 'from-purple-500 to-purple-600',
    general: 'from-gray-500 to-gray-600'
  }

  const subjectBg = {
    mathematics: 'from-blue-50 to-blue-100',
    science: 'from-green-50 to-green-100',
    economics: 'from-purple-50 to-purple-100',
    general: 'from-gray-50 to-gray-100'
  }

  return (
    <div 
      className={cn(
        `bg-gradient-to-br ${subjectBg[subject]} rounded-2xl border border-white/30 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-[1.02] cursor-pointer`,
        className
      )}
      onClick={onClick}
    >
      <div className="p-6">
        <div className={`w-12 h-12 bg-gradient-to-r ${subjectColors[subject]} rounded-xl flex items-center justify-center shadow-lg mb-4`}>
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
        <p className="text-gray-600 text-sm mb-4">{description}</p>
        {children}
      </div>
    </div>
  )
}
