'use client'

import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import FormattedContent from '@/components/ai/FormattedContent'
import { ChemistryFormatter } from '@/lib/ai/formatting/chemistry-formatter'
import { Beaker, Atom, FlaskConical } from 'lucide-react'

export default function ChemistryTestPage() {
  const [selectedTest, setSelectedTest] = useState<string>('')
  const [showMetadata, setShowMetadata] = useState(true)

  // Test cases for structural formulas
  const testCases = [
    {
      id: 'alcohols',
      title: 'Alcohols',
      icon: FlaskConical,
      content: 'Show me the structural formula of ethanol and methanol. Draw the structure of propanol.',
      description: 'Testing alcohol structural representations'
    },
    {
      id: 'aromatic',
      title: 'Aromatic Compounds',
      icon: Atom,
      content: 'Draw the benzene ring structure. Show me the structural formula of toluene and phenol.',
      description: 'Testing aromatic compound structures'
    },
    {
      id: 'alkanes',
      title: 'Alkanes',
      icon: Atom,
      content: 'What does the structure of methane look like? Show me ethane and propane structures.',
      description: 'Testing alkane structural formulas'
    },
    {
      id: 'functional-groups',
      title: 'Functional Groups',
      icon: Beaker,
      content: 'Draw the structure of acetone and acetic acid. Show me formaldehyde structure.',
      description: 'Testing functional group representations'
    },
    {
      id: 'carbohydrates',
      title: 'Carbohydrates',
      icon: FlaskConical,
      content: 'What does the structure of glucose look like? Show me the molecular structure.',
      description: 'Testing carbohydrate structural formulas'
    },
    {
      id: 'amino-acids',
      title: 'Amino Acids',
      icon: Atom,
      content: 'Draw the structure of glycine and alanine. Show me amino acid structures.',
      description: 'Testing amino acid structural representations'
    }
  ]

  // Direct structural formula tests
  const directTests = [
    { compound: 'ethanol', name: 'Ethanol' },
    { compound: 'benzene', name: 'Benzene' },
    { compound: 'glucose', name: 'Glucose' },
    { compound: 'acetone', name: 'Acetone' },
    { compound: 'methane', name: 'Methane (3D)' }
  ]

  const handleTestCase = (testCase: any) => {
    setSelectedTest(testCase.content)
  }

  const generateDirectStructure = (compound: string) => {
    if (compound === 'methane') {
      return ChemistryFormatter.generate3DStructure(compound)
    }
    return ChemistryFormatter.generateStructuralFormula(compound, 'Class XII')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-blue-50 to-purple-50 dark:from-gray-900 dark:via-green-900 dark:to-blue-900">
      <div className="container mx-auto px-4 py-6">
        {/* Header */}
        <Card className="mb-6 bg-white/80 backdrop-blur-sm border-0 shadow-xl">
          <CardHeader>
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-r from-green-500 to-blue-600 flex items-center justify-center">
                <Beaker className="h-6 w-6 text-white" />
              </div>
              <div>
                <CardTitle className="text-2xl font-bold bg-gradient-to-r from-green-600 to-blue-600 bg-clip-text text-transparent">
                  Chemical Structural Formula Test
                </CardTitle>
                <p className="text-gray-600 dark:text-gray-400">
                  Testing the intelligent chemical structure generation system
                </p>
              </div>
            </div>
          </CardHeader>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Test Cases */}
          <div className="space-y-4">
            <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="text-lg font-semibold">Structural Formula Test Cases</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 gap-3">
                  {testCases.map((testCase) => {
                    const Icon = testCase.icon
                    return (
                      <Button
                        key={testCase.id}
                        variant="outline"
                        className="h-auto p-4 justify-start text-left hover:bg-blue-50"
                        onClick={() => handleTestCase(testCase)}
                      >
                        <div className="flex items-start space-x-3 w-full">
                          <Icon className="h-5 w-5 text-blue-600 mt-1 flex-shrink-0" />
                          <div className="flex-1">
                            <div className="font-medium">{testCase.title}</div>
                            <div className="text-sm text-gray-600 mt-1">{testCase.description}</div>
                          </div>
                        </div>
                      </Button>
                    )
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Direct Structure Generation */}
            <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="text-lg font-semibold">Direct Structure Generation</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {directTests.map((test) => (
                    <div key={test.compound} className="border rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium">{test.name}</h4>
                        <Badge variant="secondary">{test.compound}</Badge>
                      </div>
                      <div className="bg-gray-50 rounded p-2 text-sm font-mono">
                        <div dangerouslySetInnerHTML={{ 
                          __html: generateDirectStructure(test.compound).replace(/\n/g, '<br>') 
                        }} />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Bond Guide */}
            <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="text-lg font-semibold">Bond Representation Guide</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="bg-gray-50 rounded p-3 text-sm font-mono">
                  <div dangerouslySetInnerHTML={{ 
                    __html: ChemistryFormatter.generateBondGuide().replace(/\n/g, '<br>') 
                  }} />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Results Display */}
          <div className="space-y-4">
            <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg font-semibold">Formatted Output</CardTitle>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowMetadata(!showMetadata)}
                  >
                    {showMetadata ? 'Hide' : 'Show'} Metadata
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {selectedTest ? (
                  <FormattedContent 
                    content={selectedTest}
                    options={{
                      classLevel: 'Class XII',
                      subject: 'chemistry',
                      userRole: 'student',
                      enableAdvancedFormatting: true,
                      enableAccessibilityFeatures: true,
                      enableDiagramGeneration: true
                    }}
                    showMetadata={showMetadata}
                    enableInteractiveFeatures={true}
                    className="min-h-[300px]"
                  />
                ) : (
                  <div className="text-center text-gray-500 py-12">
                    <Beaker className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                    <p>Select a test case above to see the structural formula generation in action</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Feature Status */}
            <Card className="bg-gradient-to-r from-green-500 to-blue-600 text-white border-0 shadow-xl">
              <CardContent className="p-6">
                <h3 className="text-xl font-bold mb-4">Structural Formula Features</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="text-2xl font-bold mb-1">✅</div>
                    <div>ASCII Structures</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold mb-1">✅</div>
                    <div>Bond Representations</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold mb-1">✅</div>
                    <div>Functional Groups</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold mb-1">✅</div>
                    <div>3D Geometry</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold mb-1">✅</div>
                    <div>Class Level Adaptation</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold mb-1">✅</div>
                    <div>Auto-Detection</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Instructions */}
            <Card className="bg-blue-50 border-blue-200">
              <CardContent className="p-4">
                <h4 className="font-medium mb-2 text-blue-800">How to Test in AI Tutor:</h4>
                <div className="text-sm text-blue-700 space-y-1">
                  <p>• Ask: "Show me the structural formula of ethanol"</p>
                  <p>• Ask: "Draw the benzene ring structure"</p>
                  <p>• Ask: "What does the structure of glucose look like?"</p>
                  <p>• Ask: "Explain the structure of acetone"</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
