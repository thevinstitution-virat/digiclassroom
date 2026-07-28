'use client';

import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { api as trpc } from '@/lib/trpc/client';
import { UploadCloud, Link as LinkIcon, FileText, Loader2, X } from 'lucide-react';

interface DocumentUploaderProps {
    spaceId: string;
    onUploadStarted?: () => void;
}

export function DocumentUploader({ spaceId, onUploadStarted }: DocumentUploaderProps) {
    const [url, setUrl] = useState('');
    const [isUploading, setIsUploading] = useState(false);

    const uploadMutation = trpc.sarvagya.uploadDocument.useMutation({
        onSuccess: () => {
            setIsUploading(false);
            if (onUploadStarted) onUploadStarted();
        },
        onError: (err) => {
            setIsUploading(false);
            alert(`Upload failed: ${err.message}`);
        }
    });

    const getUploadUrlMutation = trpc.sarvagya.getUploadUrl.useMutation({
        onError: (err) => {
            setIsUploading(false);
            alert(`Failed to request secure upload stream: ${err.message}`);
        }
    });

    const onDrop = useCallback(async (acceptedFiles: File[]) => {
        for (const file of acceptedFiles) {
            if (file.size > 10 * 1024 * 1024) {
                alert(`File ${file.name} is too large (max 10MB).`);
                continue;
            }
            try {
                setIsUploading(true);

                // 1. Request a secure Presigned URL from the backend
                const { uploadUrl, objectKey } = await getUploadUrlMutation.mutateAsync({
                    filename: file.name,
                    contentType: file.type || 'application/octet-stream'
                });

                // 2. Stream the raw file bytes directly to Cloudflare R2
                const uploadResponse = await fetch(uploadUrl, {
                    method: 'PUT',
                    body: file,
                    headers: {
                        'Content-Type': file.type || 'application/octet-stream'
                    }
                });

                if (!uploadResponse.ok) {
                    throw new Error('Storage transmission failed');
                }

                // 3. Register the successfully stored object in our Database
                uploadMutation.mutate({
                    spaceId,
                    name: file.name,
                    url: `r2://${objectKey}`,
                    fileType: file.type || 'application/octet-stream',
                    size: file.size
                });
            } catch (error: any) {
                setIsUploading(false);
                alert(error.message || 'Upload failed');
            }
        }
    }, [spaceId, uploadMutation, getUploadUrlMutation, onUploadStarted]);

    const handleUrlSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!url) return;
        setIsUploading(true);
        uploadMutation.mutate({
            spaceId,
            name: url.substring(0, 50) + '...',
            url: url,
            fileType: 'text/html',
            size: 0
        });
        setUrl('');
    };

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: {
            'application/pdf': ['.pdf'],
            'text/plain': ['.txt'],
            'image/jpeg': ['.jpg', '.jpeg'],
            'image/png': ['.png']
        },
        maxSize: 10 * 1024 * 1024 // 10MB
    });

    return (
        <div className="space-y-4">
            {/* Dropzone */}
            <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors cursor-pointer ${isDragActive ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                    } ${isUploading ? 'opacity-50 pointer-events-none' : ''}`}
            >
                <input {...getInputProps()} />
                <div className="flex flex-col items-center gap-2">
                    <div className="w-10 h-10 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center">
                        <UploadCloud className="w-5 h-5 text-slate-500" />
                    </div>
                    <div>
                        <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                            Drop PDF, TXT, or Image here
                        </p>
                        <p className="text-xs text-slate-500 mt-1">
                            Up to 10MB per file. OCR supported.
                        </p>
                    </div>
                </div>
            </div>

            <div className="relative">
                <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-slate-200 dark:border-slate-700" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-white dark:bg-slate-900 px-2 text-slate-500">Or add web link</span>
                </div>
            </div>

            {/* URL Input */}
            <form onSubmit={handleUrlSubmit} className="flex gap-2">
                <div className="relative flex-1">
                    <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                        type="url"
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        placeholder="https://example.com/article"
                        className="w-full bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-lg pl-9 pr-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                        disabled={isUploading}
                    />
                </div>
                <button
                    type="submit"
                    disabled={!url.trim() || isUploading}
                    className="px-4 py-2 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-lg text-sm font-medium hover:bg-slate-800 dark:hover:bg-slate-200 disabled:opacity-50 transition-colors flex items-center justify-center min-w-[80px]"
                >
                    {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Add'}
                </button>
            </form>
        </div>
    );
}
