"use client"

import { useCallback, useRef } from 'react'

// Dynamically import heavy libs only when needed
export function useLessonExports() {
  const printRef = useRef<HTMLDivElement | null>(null)

  const setPrintRef = useCallback((el: HTMLDivElement | null) => {
    printRef.current = el
  }, [])

  const copyToClipboard = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch (e) {
      console.warn('Clipboard copy failed', e)
      return false
    }
  }, [])

  const printLesson = useCallback(() => {
    if (!printRef.current) {
      window.print()
      return
    }
    // Open a print window with the lesson HTML
    const html = printRef.current.innerHTML
    const printWindow = window.open('', '_blank', 'width=900,height=1200')
    if (printWindow) {
      printWindow.document.open()
      printWindow.document.write(`<!doctype html><html><head><title>Lesson Plan</title>
        <link rel="stylesheet" href="/styles.css" />
        <style>@media print { body { padding: 16px; } }</style>
      </head><body>${html}</body></html>`)
      printWindow.document.close()
      // Give the browser a tick to render before printing
      setTimeout(() => {
        printWindow.focus()
        printWindow.print()
      }, 400)
    }
  }, [])

  const exportPdf = useCallback(async () => {
    if (!printRef.current) return false
    const el = printRef.current
    // Lazy import to keep initial bundle small
    const html2canvas = (await import('html2canvas')).default
    const jsPDF = (await import('jspdf')).default

    const canvas = await html2canvas(el, { scale: 2, useCORS: true, backgroundColor: '#ffffff' })
    const imgData = canvas.toDataURL('image/png')

    const pdf = new jsPDF('p', 'pt', 'a4')
    const pageWidth = pdf.internal.pageSize.getWidth()
    const pageHeight = pdf.internal.pageSize.getHeight()

    const imgWidth = pageWidth
    const imgHeight = (canvas.height * imgWidth) / canvas.width

    let heightLeft = imgHeight
    let position = 0

    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
    heightLeft -= pageHeight

    while (heightLeft > 0) {
      position = heightLeft - imgHeight
      pdf.addPage()
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
      heightLeft -= pageHeight
    }

    pdf.save('lesson-plan.pdf')
    return true
  }, [])

  return { setPrintRef, copyToClipboard, printLesson, exportPdf }
}

