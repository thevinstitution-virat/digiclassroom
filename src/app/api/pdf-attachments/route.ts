import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { headers } from 'next/headers';
import { executeQuery } from '@/lib/db/connection';
import { v4 as uuidv4 } from 'uuid';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

/**
 * POST /api/pdf-attachments
 * Upload PDF file
 */
export async function POST(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    const userId = session?.user?.id;

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await req.formData();
    const pdfFile = formData.get('pdf') as File;
    const noteId = formData.get('noteId') as string;

    if (!pdfFile || !noteId) {
      return NextResponse.json(
        { error: 'PDF file and noteId are required' },
        { status: 400 }
      );
    }

    console.log(`📄 Uploading PDF for note: ${noteId}`);

    // Verify note belongs to user
    const noteCheck = await executeQuery<any>(
      'SELECT id, user_id FROM user_notes WHERE id = ?',
      [noteId]
    );

    if (noteCheck.length === 0) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 });
    }

    if (noteCheck[0].user_id !== userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Create uploads directory
    const uploadsDir = join(process.cwd(), 'public', 'uploads', 'pdfs');
    if (!existsSync(uploadsDir)) {
      await mkdir(uploadsDir, { recursive: true });
    }

    // Save file
    const bytes = await pdfFile.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const fileId = uuidv4();
    const fileName = `${fileId}.pdf`;
    const filePath = join(uploadsDir, fileName);

    await writeFile(filePath, buffer);
    console.log(`✅ PDF saved: ${fileName}`);

    // Save to database
    const attachmentId = uuidv4();
    const pdfUrl = `/uploads/pdfs/${fileName}`;

    await executeQuery(
      `INSERT INTO note_pdf_attachments 
       (id, note_id, pdf_url, file_name, file_size_bytes, uploaded_at)
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [attachmentId, noteId, pdfUrl, pdfFile.name, pdfFile.size]
    );

    // Update note
    await executeQuery(
      'UPDATE user_notes SET has_pdf_attachments = TRUE WHERE id = ?',
      [noteId]
    );

    console.log(`✅ PDF attachment saved: ${attachmentId}`);

    return NextResponse.json({
      success: true,
      id: attachmentId,
      pdf_url: pdfUrl,
      file_name: pdfFile.name,
    });
  } catch (error) {
    console.error('❌ Error uploading PDF:', error);
    return NextResponse.json(
      {
        error: 'Failed to upload PDF',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/pdf-attachments?noteId=xxx
 * Fetch PDF attachments for a note
 */
export async function GET(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    const userId = session?.user?.id;

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const noteId = searchParams.get('noteId');

    if (!noteId) {
      return NextResponse.json({ error: 'noteId is required' }, { status: 400 });
    }

    // Verify note belongs to user
    const noteCheck = await executeQuery<NoteRow>(
      'SELECT id, user_id FROM user_notes WHERE id = ?',
      [noteId]
    );

    if (noteCheck.length === 0) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 });
    }

    if (noteCheck[0].user_id !== userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Fetch attachments
    const attachments = await executeQuery<PdfAttachmentRow>(
      `SELECT * FROM note_pdf_attachments 
       WHERE note_id = ? 
       ORDER BY uploaded_at DESC`,
      [noteId]
    );

    return NextResponse.json({
      success: true,
      attachments,
      count: attachments.length,
    });
  } catch (error) {
    console.error('❌ Error fetching PDFs:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch PDFs',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

