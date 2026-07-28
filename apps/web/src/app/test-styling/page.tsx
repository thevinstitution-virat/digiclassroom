'use client'

import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Brain, BookOpen, MessageSquare } from 'lucide-react'

export default function TestStylingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-900 dark:via-blue-900 dark:to-indigo-900 p-8">
      <div className="container mx-auto">
        {/* Test Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent mb-4">
            CSS Styling Test
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Testing Tailwind CSS, glassmorphism, and component styling
          </p>
        </div>

        {/* Test Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {/* Card 1 - Basic Glassmorphism */}
          <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-1">
            <CardHeader>
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-600 flex items-center justify-center">
                  <Brain className="h-6 w-6 text-white" />
                </div>
                <CardTitle className="text-xl font-bold">AI Tutor</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 mb-4">
                Intelligent conversational learning assistant with CBSE curriculum alignment.
              </p>
              <Button className="w-full bg-gradient-to-r from-purple-500 to-indigo-600 hover:opacity-90">
                Start Learning
                <MessageSquare className="h-4 w-4 ml-2" />
              </Button>
            </CardContent>
          </Card>

          {/* Card 2 - Different Gradient */}
          <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-1">
            <CardHeader>
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-r from-green-500 to-emerald-500 flex items-center justify-center">
                  <BookOpen className="h-6 w-6 text-white" />
                </div>
                <CardTitle className="text-xl font-bold">Study Materials</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 mb-4">
                Comprehensive learning resources and educational content.
              </p>
              <Button className="w-full bg-gradient-to-r from-green-500 to-emerald-500 hover:opacity-90">
                Access Materials
                <BookOpen className="h-4 w-4 ml-2" />
              </Button>
            </CardContent>
          </Card>

          {/* Card 3 - Orange to Blue Gradient */}
          <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-1">
            <CardHeader>
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-r from-orange-500 to-blue-600 flex items-center justify-center">
                  <Brain className="h-6 w-6 text-white" />
                </div>
                <CardTitle className="text-xl font-bold">Featured Tool</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 mb-4">
                Premium educational features with advanced AI capabilities.
              </p>
              <Badge className="mb-4 bg-gradient-to-r from-orange-500 to-red-500 text-white">
                Featured
              </Badge>
              <Button className="w-full bg-gradient-to-r from-orange-500 to-blue-600 hover:opacity-90">
                Try Now
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Test Chat Interface */}
        <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-xl mb-8">
          <CardHeader>
            <CardTitle className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              Chat Interface Test
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Assistant Message */}
              <div className="flex justify-start">
                <div className="max-w-[80%]">
                  <div className="bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-2xl px-4 py-3 mr-4">
                    <p className="text-sm">Hello! I'm your AI tutor. How can I help you today?</p>
                  </div>
                  <p className="text-xs text-gray-500 mt-1 ml-4">Just now</p>
                </div>
              </div>

              {/* User Message */}
              <div className="flex justify-end">
                <div className="max-w-[80%]">
                  <div className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-2xl px-4 py-3 ml-4">
                    <p className="text-sm">Can you help me with mathematics?</p>
                  </div>
                  <p className="text-xs text-gray-500 mt-1 mr-4 text-right">Just now</p>
                </div>
              </div>

              {/* Quick Reply Buttons */}
              <div className="flex flex-wrap gap-2 mt-4">
                <Button variant="outline" size="sm" className="bg-white/90 hover:bg-white border-gray-300 text-gray-700">
                  Student
                </Button>
                <Button variant="outline" size="sm" className="bg-white/90 hover:bg-white border-gray-300 text-gray-700">
                  Teacher
                </Button>
                <Button variant="outline" size="sm" className="bg-white/90 hover:bg-white border-gray-300 text-gray-700">
                  Parent
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Test Status */}
        <Card className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white border-0 shadow-xl">
          <CardContent className="p-8 text-center">
            <h3 className="text-2xl font-bold mb-4">Styling Test Results</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <div className="text-3xl font-bold mb-2">✅</div>
                <div className="text-blue-100">Tailwind CSS</div>
              </div>
              <div>
                <div className="text-3xl font-bold mb-2">✅</div>
                <div className="text-blue-100">Glassmorphism</div>
              </div>
              <div>
                <div className="text-3xl font-bold mb-2">✅</div>
                <div className="text-blue-100">Gradients</div>
              </div>
              <div>
                <div className="text-3xl font-bold mb-2">✅</div>
                <div className="text-blue-100">Components</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Navigation Test */}
        <div className="mt-8 text-center">
          <Button 
            onClick={() => window.location.href = '/dashboard/user/ai-tutor'}
            className="bg-gradient-to-r from-purple-500 to-indigo-600 hover:opacity-90 text-white font-medium py-3 px-6 rounded-xl"
          >
            Go to AI Tutor Page
            <Brain className="h-5 w-5 ml-2" />
          </Button>
        </div>
      </div>
    </div>
  )
}
