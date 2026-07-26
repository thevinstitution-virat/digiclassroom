'use client';

/**
 * Sanchika Knowledge Graph (Phase 2).
 * Renders the user's notes + [[wiki link]] connections as a force-directed graph.
 * Click a node to open that note.
 */

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { ArrowLeft, Network } from 'lucide-react';

// react-force-graph-2d uses canvas/window — load client-only. Cast to any: its
// prop types are loose and we only use a documented subset.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), { ssr: false }) as any;

interface GNode { id: string; title?: string; subject?: string; color?: string; x?: number; y?: number; }

export default function SanchikaGraphPage() {
  const router = useRouter();
  const [data, setData] = useState<{ nodes: GNode[]; links: Array<{ source: string; target: string }> }>({ nodes: [], links: [] });
  const [loading, setLoading] = useState(true);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 800, h: 600 });

  useEffect(() => {
    fetch('/api/notes/graph')
      .then((r) => (r.ok ? r.json() : { nodes: [], links: [] }))
      .then((d) => setData({ nodes: d.nodes || [], links: d.links || [] }))
      .catch(() => setData({ nodes: [], links: [] }))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const update = () => {
      if (wrapRef.current) setSize({ w: wrapRef.current.clientWidth, h: wrapRef.current.clientHeight });
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [loading]);

  return (
    <div className="flex flex-col h-screen">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
        <button
          onClick={() => router.push('/dashboard/user/sanchika')}
          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
          aria-label="Back to notes"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <Network className="h-5 w-5 text-purple-600" />
        <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">Knowledge Graph</h1>
        <span className="text-sm text-gray-500">{data.nodes.length} notes · {data.links.length} links</span>
      </div>

      <div ref={wrapRef} className="flex-1 relative bg-gray-50 dark:bg-gray-950 overflow-hidden">
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center text-gray-500">Loading graph…</div>
        ) : data.nodes.length === 0 ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-500 gap-2">
            <Network className="h-10 w-10 text-gray-300" />
            <p>No notes yet — create some and connect them with [[wiki links]].</p>
          </div>
        ) : (
          <ForceGraph2D
            width={size.w}
            height={size.h}
            graphData={data}
            nodeId="id"
            nodeLabel="title"
            nodeAutoColorBy="subject"
            cooldownTicks={120}
            linkColor={() => 'rgba(124,58,237,0.35)'}
            linkDirectionalArrowLength={4}
            linkDirectionalArrowRelPos={1}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            nodeCanvasObject={(node: any, ctx: any, scale: number) => {
              const r = 5;
              ctx.beginPath();
              ctx.arc(node.x, node.y, r, 0, 2 * Math.PI);
              ctx.fillStyle = node.color || '#7c3aed';
              ctx.fill();
              if (scale > 1.2) {
                const label = node.title || 'Untitled';
                ctx.font = `${12 / scale}px sans-serif`;
                ctx.fillStyle = '#6b7280';
                ctx.fillText(label, node.x + r + 2, node.y + 3);
              }
            }}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            onNodeClick={(node: any) => router.push(`/dashboard/user/sanchika/${node.id}`)}
          />
        )}
      </div>
    </div>
  );
}
