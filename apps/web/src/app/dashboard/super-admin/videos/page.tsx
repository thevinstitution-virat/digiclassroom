'use client';

import { useState } from 'react';
import { useSuperAdminContext } from '../_context/SuperAdminContext';
import { TaxonomyCascade, type TaxonomySelection } from '@/components/upload/TaxonomyCascade';
import { BunnyVideoUploader } from '@/components/upload/BunnyVideoUploader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Building2, Globe } from 'lucide-react';

export default function SuperAdminVideosPage() {
  const { context: workingContext } = useSuperAdminContext(); // The original context has .context according to earlier reads, but the prompt says workingContext. Let me use the context object properly. Wait, the hook returns { context: SuperAdminWorkingContext }. The prompt says const { workingContext } = useSuperAdminContext(); Let me rename it in destructuring const { context: workingContext } = useSuperAdminContext();

  // 'system' tenantId → global content (NULL in DB); anything else → institution-scoped
  const targetTenantId: string | null =
    workingContext.type === 'global' ? null : workingContext.tenantId;

  // ── Form state ─────────────────────────────────────────────────────────
  const [title,         setTitle]         = useState('');
  const [description,   setDescription]   = useState('');
  const [taxonomy,      setTaxonomy]      = useState<Partial<TaxonomySelection>>({});
  const [bookTag,       setBookTag]       = useState('');
  const [isFreePreview, setIsFreePreview] = useState(false);

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setTaxonomy({});
    setBookTag('');
    setIsFreePreview(false);
  };

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 p-6 max-w-3xl">

      <div>
        <h1 className="text-2xl font-bold tracking-tight">Upload Video</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Add content to the platform.</p>
      </div>

      {/* Context banner */}
      {workingContext.type === 'global' ? (
        <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-4 py-3 text-sm text-primary">
          <Globe className="h-4 w-4 shrink-0" />
          <span><strong>Global content</strong> — this video will be visible to all institutions.</span>
        </div>
      ) : (
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300">
          <Building2 className="h-4 w-4 shrink-0" />
          {/* workingContext may expose orgName — fall back to tenantId */}
          <span>Uploading for institution: <strong>{(workingContext as any).label ?? workingContext.tenantId}</strong></span>
        </div>
      )}

      {/* Metadata form */}
      <Card>
        <CardHeader className="pb-3 pt-4 px-4">
          <CardTitle className="text-sm font-semibold">Video Details</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-5">

          <div className="space-y-1.5">
            <Label htmlFor="title">Title <span className="text-destructive">*</span></Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Video title…"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description…"
              rows={3}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Taxonomy <span className="text-destructive">*</span></Label>
            <TaxonomyCascade value={taxonomy} onChange={setTaxonomy} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="bookTag">Book Tag</Label>
            <Input
              id="bookTag"
              value={bookTag}
              onChange={(e) => setBookTag(e.target.value)}
              placeholder="e.g. Charaka Samhita Vol. 2 (optional)"
            />
          </div>

          <div className="flex items-center gap-3">
            <Switch
              id="isFreePreview"
              checked={isFreePreview}
              onCheckedChange={setIsFreePreview}
            />
            <Label htmlFor="isFreePreview" className="cursor-pointer font-normal">
              Free preview — accessible without enrollment
            </Label>
          </div>

        </CardContent>
      </Card>

      {/* Uploader — targetTenantId always passed (SA mode) */}
      <Card>
        <CardHeader className="pb-3 pt-4 px-4">
          <CardTitle className="text-sm font-semibold">Upload</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <BunnyVideoUploader
            title={title}
            description={description}
            domainId={taxonomy.domainId ?? ''}
            courseId={taxonomy.courseId ?? ''}
            levelId={taxonomy.levelId ?? ''}
            subjectId={taxonomy.subjectId ?? ''}
            bookTag={bookTag || null}
            isFreePreview={isFreePreview}
            targetTenantId={targetTenantId}
            onSuccess={resetForm}
          />
        </CardContent>
      </Card>

    </div>
  );
}
