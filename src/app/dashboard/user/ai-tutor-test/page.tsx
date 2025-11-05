'use client'

import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Brain } from 'lucide-react'

export default function AITutorTestPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-900 dark:via-blue-900 dark:to-indigo-900">
      <div className="container mx-auto px-4 py-6">
        <Card className="mb-6 bg-white/80 backdrop-blur-sm border-0 shadow-xl">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 rounded-full bg-gradient-to-r from-blue-500 to-indigo-600 flex items-center justify-center">
                  <Brain className="h-6 w-6 text-white" />
                </div>
                <div>
                  <CardTitle className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                    AI Tutor Test Page
                  </CardTitle>
                  <p className="text-gray-600 dark:text-gray-400">
                    Testing the intelligent formatting system
                  </p>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Intelligent Content Formatting System</h3>
              <p>This is a test page to verify that the formatting system works correctly.</p>
              
              <div className="bg-blue-50 p-4 rounded-lg">
                <h4 className="font-medium mb-2">Mathematical Content Example:</h4>
                <p>The quadratic formula is: x = (-b ± √(b²-4ac))/2a</p>
              </div>
              
              <div className="bg-green-50 p-4 rounded-lg">
                <h4 className="font-medium mb-2">Chemical Content Example:</h4>
                <p>Water molecule: H₂O</p>
                <p>Photosynthesis: 6CO₂ + 6H₂O → C₆H₁₂O₆ + 6O₂</p>
              </div>
              
              <div className="bg-purple-50 p-4 rounded-lg">
                <h4 className="font-medium mb-2">Historical Content Example:</h4>
                <p><em>Mahatma Gandhi</em> led the <em>Salt March</em> in <u>1930</u>.</p>
                <p><strong>Important:</strong> <u>This was a pivotal moment in India's independence movement.</u></p>
              </div>
              
              <Button className="w-full bg-gradient-to-r from-purple-500 to-indigo-600 hover:opacity-90">
                Test Formatting System
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
