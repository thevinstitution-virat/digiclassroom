'use client';

import { useRef, useState } from 'react';
import * as tus from 'tus-js-client';
import { api } from '@/lib/trpc/client';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Upload, Youtube } from 'lucide-react';

// ── Props ──────────────────────────────────────────────────────────────────
// targetTenantId:
//   undefined  → IA mode  (calls api.videoAssets.*)         → server uses ctx.tenantId
//   null       → SA global (calls api.videoAssets.sa.*)     → server sets tenantId = NULL
//   string     → SA institution (calls api.videoAssets.sa.*) → server sets tenantId = that string

interface BunnyVideoUploaderProps {
  title:           string;
  description?:    string;
  domainId:        string;
  courseId:        string;
  levelId:         string;
  subjectId:       string;
  bookTag?:        string | null;
  isFreePreview?:  boolean;
  targetTenantId?: string | null;
  onSuccess?:      () => void;
}

export function BunnyVideoUploader({
  title,
  description,
  domainId,
  courseId,
  levelId,
  subjectId,
  bookTag,
  isFreePreview = false,
  targetTenantId,
  onSuccess,
}: BunnyVideoUploaderProps) {

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file,          setFile]          = useState<File | null>(null);
  const [uploading,     setUploading]     = useState(false);
  const [progress,      setProgress]      = useState(0);
  const [youtubeUrl,    setYoutubeUrl]    = useState('');

  // Always call all hooks — branch at call time (React rules of hooks)
  const iaInitiate     = api.videoAssets.initiateUpload.useMutation();
  const saInitiate     = api.videoAssets.sa.initiateUpload.useMutation();
  const iaMarkUploaded = api.videoAssets.markUploaded.useMutation();
  const saMarkUploaded = api.videoAssets.sa.markUploaded.useMutation();
  const iaYoutube      = api.videoAssets.addYouTubeVideo.useMutation();
  const saYoutube      = api.videoAssets.sa.addYouTubeVideo.useMutation();

  const isFormReady      = !!title.trim() && !!domainId && !!courseId && !!subjectId && !!levelId;
  const isYoutubeLoading = iaYoutube.isPending || saYoutube.isPending;

  const sharedInput = { title, description, domainId, courseId, levelId, subjectId, bookTag, isFreePreview };

  // ── Bunny TUS upload ─────────────────────────────────────────────────────

  const handleBunnyUpload = async () => {
    if (!file || !isFormReady) return;
    setUploading(true);
    setProgress(0);

    try {
      let uploadData: {
        providerVideoId: string;
        libraryId: string;
        signature: string;
        expirationTime: number;
      };

      // TypeScript narrows targetTenantId to string | null inside this branch
      if (targetTenantId !== undefined) {
        uploadData = await saInitiate.mutateAsync({ title: sharedInput.title, targetTenantId });
      } else {
        uploadData = await iaInitiate.mutateAsync({ title: sharedInput.title });
      }

      await new Promise<void>((resolve, reject) => {
        const upload = new tus.Upload(file, {
          endpoint:    'https://video.bunnycdn.com/tusupload',
          retryDelays: [0, 3000, 5000, 10000, 20000],
          headers: {
            AuthorizationSignature: uploadData.signature,
            AuthorizationExpire:    String(uploadData.expirationTime),
            VideoId:                uploadData.providerVideoId,
            LibraryId:              String(uploadData.libraryId),
          },
          metadata: { filetype: file.type, title },
          onError:    reject,
          onProgress: (bytesUploaded, bytesTotal) =>
            setProgress(Math.round((bytesUploaded / bytesTotal) * 100)),
          onSuccess:  () => resolve(),
        });
        upload.start();
      });

      // Two-phase commit: Save the DB record only after Bunny upload succeeds
      if (targetTenantId !== undefined) {
        await saMarkUploaded.mutateAsync({ ...sharedInput, providerVideoId: uploadData.providerVideoId, targetTenantId });
      } else {
        await iaMarkUploaded.mutateAsync({ ...sharedInput, providerVideoId: uploadData.providerVideoId });
      }

      toast.success('Video uploaded successfully');
      setFile(null);
      setProgress(0);
      if (fileInputRef.current) fileInputRef.current.value = '';
      onSuccess?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  // ── YouTube submit ───────────────────────────────────────────────────────

  const handleYouTubeSubmit = async () => {
    if (!youtubeUrl.trim() || !isFormReady) return;

    try {
      if (targetTenantId !== undefined) {
        await saYoutube.mutateAsync({ ...sharedInput, youtubeUrl, targetTenantId });
      } else {
        await iaYoutube.mutateAsync({ ...sharedInput, youtubeUrl });
      }
      toast.success('YouTube video added');
      setYoutubeUrl('');
      onSuccess?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add YouTube video');
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <Tabs defaultValue="bunny" className="w-full">

      <TabsList>
        <TabsTrigger value="bunny">
          <Upload className="mr-2 h-4 w-4" />File Upload
        </TabsTrigger>
        <TabsTrigger value="youtube">
          <Youtube className="mr-2 h-4 w-4" />YouTube Link
        </TabsTrigger>
      </TabsList>

      {/* ── File upload tab ──────────────────────────────────────────────── */}
      <TabsContent value="bunny" className="space-y-4 pt-4">

        {!isFormReady && (
          <p className="text-sm text-muted-foreground">
            Complete the title and taxonomy above before uploading.
          </p>
        )}

        <div className="space-y-2">
          <Label>Video File</Label>
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*"
            className="hidden"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          <div className="flex items-center gap-3 flex-wrap">
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading || !isFormReady}
            >
              {file ? (
                <span className="max-w-[200px] truncate">{file.name}</span>
              ) : (
                'Choose file…'
              )}
            </Button>

            {file && !uploading && (
              <Button onClick={handleBunnyUpload} disabled={!isFormReady}>
                <Upload className="mr-2 h-4 w-4" />Start Upload
              </Button>
            )}

            {uploading && (
              <Badge variant="secondary" className="gap-1.5">
                <Loader2 className="h-3 w-3 animate-spin" />
                Uploading…
              </Badge>
            )}
          </div>
        </div>

        {uploading && (
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Upload progress</span>
              <span>{progress}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        )}

      </TabsContent>

      {/* ── YouTube tab ──────────────────────────────────────────────────── */}
      <TabsContent value="youtube" className="space-y-4 pt-4">

        {!isFormReady && (
          <p className="text-sm text-muted-foreground">
            Complete the title and taxonomy above before adding a YouTube video.
          </p>
        )}

        <div className="space-y-2">
          <Label>YouTube URL</Label>
          <div className="flex gap-2">
            <Input
              value={youtubeUrl}
              onChange={(e) => setYoutubeUrl(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=…"
              disabled={isYoutubeLoading || !isFormReady}
              className="flex-1"
            />
            <Button
              onClick={handleYouTubeSubmit}
              disabled={isYoutubeLoading || !youtubeUrl.trim() || !isFormReady}
            >
              {isYoutubeLoading
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : 'Add'}
            </Button>
          </div>
        </div>

      </TabsContent>
    </Tabs>
  );
}
