'use client'

import { Button } from '@/components/ui/button'
import { Printer } from 'lucide-react'

// The onClick handler must live in a CLIENT component. This page is an async
// SERVER component (it queries the DB), and passing an onClick function straight
// to the client <Button> throws "Functions cannot be passed directly to Client
// Components", 500ing the certificate view. Isolating the handler here keeps the
// data-fetching page a server component.
export function PrintButton() {
  return (
    <Button onClick={() => window.print()}>
      <Printer className="h-4 w-4 mr-2" />
      Print Certificate
    </Button>
  )
}
