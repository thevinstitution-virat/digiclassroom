'use client';

import { useState } from 'react';
import { TaxonomyCascade, type TaxonomySelection } from '@/components/upload/TaxonomyCascade';
import { BunnyVideoUploader } from '@/components/upload/BunnyVideoUploader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';

export default function InstitutionVideosPage() {

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

  return (
    <div className="space-y-6 p-6 max-w-3xl">

      <div>
        <h1 className="text-2xl font-bold tracking-tight">Upload Video</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Add a video to your institution's content library.
        </p>
      </div>

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

      {/* NO targetTenantId prop → IA mode → server uses ctx.tenantId, never client input */}
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
            onSuccess={resetForm}
          />
        </CardContent>
      </Card>

    </div>
  );
}
