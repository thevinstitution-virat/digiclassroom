export interface UserRow {
    id: string;
    email: string;
    role: 'student' | 'teacher' | 'admin';
    created_at?: Date;
    updated_at?: Date;
}

export interface TeacherVerificationRow {
    id: string;
    user_id: string;
    document_url: string;
    status: 'pending' | 'approved' | 'rejected';
    submitted_at: Date;
}

export interface SubscriptionRow {
    id: string;
    user_id: string;
    plan_id: string;
    status: 'active' | 'canceled' | 'past_due';
    current_period_end: Date;
}

export interface QuestionQuotaRow {
    user_id: string;
    questions_asked: number;
    last_reset_date: Date;
}

export interface NoteRow {
    id: string;
    user_id: string;
    title?: string;
    content?: string;
    has_voice_notes?: boolean;
    created_at?: Date;
    updated_at?: Date;
}

export interface VoiceRecordingRow {
    id: string;
    note_id: string;
    audio_url: string;
    file_name: string;
    duration_seconds: number;
    file_size_bytes: number;
    time_markers: string; // JSON string
    recorded_at: Date;
}

export interface PdfAttachmentRow {
    id: string;
    note_id: string;
    pdf_url: string;
    file_name: string;
    file_size_bytes: number;
    uploaded_at: Date;
}

export interface SmartDetectionRow {
    id: string;
    note_id: string;
    detection_type: string;
    detected_text: string;
    parsed_data: string; // JSON string
    position: number;
    context_text: string;
    suggestions: string; // JSON string
    is_applied: boolean;
}
