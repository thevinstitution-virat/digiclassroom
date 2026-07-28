'use client'

import React from 'react'
import { Navbar } from '@/components/navigation/navbar'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Sun, Moon, Palette, Check, Monitor } from 'lucide-react'
import { ThemeToggle, SimpleThemeToggle, CompactThemeToggle } from '@/components/ui/theme-toggle'

export default function ThemeTestPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 transition-colors duration-300">
      <Navbar />
      
      <div className="pt-24 pb-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
              Theme Toggle Test Page
            </h1>
            <p className="text-lg text-gray-600 dark:text-gray-300">
              Test the day/night mode toggle functionality across different UI components
            </p>
          </div>

          {/* Theme Status */}
          <Card className="mb-8 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-white">
                <Palette className="h-5 w-5" />
                Current Theme Status
              </CardTitle>
              <CardDescription className="text-gray-600 dark:text-gray-300">
                The theme toggle should work seamlessly across all components
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center gap-3 p-4 rounded-lg bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800">
                  <Sun className="h-6 w-6 text-orange-500" />
                  <div>
                    <h3 className="font-semibold text-orange-900 dark:text-orange-100">Light Mode</h3>
                    <p className="text-sm text-orange-700 dark:text-orange-300">Clean, bright interface</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                  <Moon className="h-6 w-6 text-blue-500" />
                  <div>
                    <h3 className="font-semibold text-blue-900 dark:text-blue-100">Dark Mode</h3>
                    <p className="text-sm text-blue-700 dark:text-blue-300">Easy on the eyes</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Theme Toggle Variants */}
          <Card className="mb-8 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-white">
                <Monitor className="h-5 w-5" />
                Theme Toggle Variants
              </CardTitle>
              <CardDescription className="text-gray-600 dark:text-gray-300">
                Different sizes and styles of the new segmented theme toggle
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-gray-900 dark:text-white">Full Theme Toggle (Large)</h4>
                <div className="flex justify-center">
                  <ThemeToggle size="lg" />
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-gray-900 dark:text-white">Standard Theme Toggle (Medium)</h4>
                <div className="flex justify-center">
                  <ThemeToggle size="md" />
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-gray-900 dark:text-white">Compact Theme Toggle (Small)</h4>
                <div className="flex justify-center">
                  <CompactThemeToggle />
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-gray-900 dark:text-white">Simple Toggle (Light/Dark Only)</h4>
                <div className="flex justify-center">
                  <SimpleThemeToggle />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Component Tests */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            {/* Buttons Test */}
            <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
              <CardHeader>
                <CardTitle className="text-gray-900 dark:text-white">Button Variants</CardTitle>
                <CardDescription className="text-gray-600 dark:text-gray-300">
                  Testing different button styles in both themes
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button className="w-full bg-gradient-to-r from-orange-500 to-blue-500 hover:from-orange-600 hover:to-blue-600">
                  Primary Button
                </Button>
                <Button variant="outline" className="w-full border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white">
                  Outline Button
                </Button>
                <Button variant="ghost" className="w-full text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">
                  Ghost Button
                </Button>
              </CardContent>
            </Card>

            {/* Badges Test */}
            <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
              <CardHeader>
                <CardTitle className="text-gray-900 dark:text-white">Badge Variants</CardTitle>
                <CardDescription className="text-gray-600 dark:text-gray-300">
                  Testing badge components in both themes
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                    Success
                  </Badge>
                  <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                    Info
                  </Badge>
                  <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                    Warning
                  </Badge>
                  <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
                    Error
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Feature Checklist */}
          <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
            <CardHeader>
              <CardTitle className="text-gray-900 dark:text-white">Theme Toggle Features</CardTitle>
              <CardDescription className="text-gray-600 dark:text-gray-300">
                Comprehensive feature checklist for the theme toggle implementation
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  'Segmented toggle design',
                  'Rectangular button shape',
                  'Visual coherence with page',
                  'System preference detection',
                  'Persistent theme storage',
                  'Smooth transitions',
                  'Accessible controls',
                  'Keyboard navigation',
                  'Mobile responsive',
                  'Orange-to-blue gradient',
                  'Component consistency',
                  'Performance optimized'
                ].map((feature, index) => (
                  <div key={index} className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                    <Check className="h-5 w-5 text-green-500 flex-shrink-0" />
                    <span className="text-gray-900 dark:text-white font-medium">{feature}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Instructions */}
          <div className="mt-8 p-6 rounded-lg bg-gradient-to-r from-orange-50 to-blue-50 dark:from-orange-900/20 dark:to-blue-900/20 border border-orange-200 dark:border-orange-800">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              How to Test
            </h3>
            <ul className="space-y-2 text-gray-700 dark:text-gray-300">
              <li>• Click any segment in the theme toggle (Light, System, Dark)</li>
              <li>• Notice the active segment highlighted with orange-to-blue gradient</li>
              <li>• Observe smooth transitions between theme changes</li>
              <li>• Test the different toggle variants above</li>
              <li>• Refresh the page to verify theme persistence</li>
              <li>• Test on different screen sizes for responsiveness</li>
              <li>• Use keyboard navigation (Tab + Enter) to access segments</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
