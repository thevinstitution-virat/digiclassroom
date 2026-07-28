'use client';

import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

export function BatchModeSelector({ mode, setMode }: { mode: 'general' | 'batch', setMode: (m: 'general' | 'batch') => void }) {
  return (
    <div className="flex justify-center mb-8">
      <Tabs value={mode} onValueChange={(val) => setMode(val as 'general' | 'batch')} className="w-full max-w-sm shadow-md rounded-lg">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="general">⚡ General Mode</TabsTrigger>
          <TabsTrigger value="batch">🎓 Batch Mode</TabsTrigger>
        </TabsList>
      </Tabs>
    </div>
  );
}
