"use client"

import React, { forwardRef } from 'react'

// A minimal print-friendly wrapper to isolate printable content
const LessonPrintView = forwardRef<HTMLDivElement, { children: React.ReactNode }>(function LessonPrintView({ children }, ref) {
  return (
    <div ref={ref as any} className="print:bg-white print:text-black print:p-6">
      {children}
    </div>
  )
})

export default LessonPrintView

