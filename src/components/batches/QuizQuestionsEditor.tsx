'use client';

import { useState } from 'react';
import { api } from '@/lib/trpc/client';
import { toast } from 'sonner';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Loader2, Plus, Trash2, CheckCircle2, X } from 'lucide-react';

interface OptionInput {
  id?: string;
  optionText: string;
  isCorrect: boolean;
  sortOrder: number;
}

interface QuestionInput {
  id?: string;
  questionText: string;
  explanation: string;
  sortOrder: number;
  options: OptionInput[];
}

function emptyQuestion(): QuestionInput {
  return {
    questionText: '',
    explanation: '',
    sortOrder: 0,
    options: [
      { optionText: '', isCorrect: true, sortOrder: 0 },
      { optionText: '', isCorrect: false, sortOrder: 1 },
      { optionText: '', isCorrect: false, sortOrder: 2 },
      { optionText: '', isCorrect: false, sortOrder: 3 },
    ],
  };
}

export function QuizQuestionsEditor({
  quizId,
  open,
  onOpenChange,
}: {
  quizId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const utils = api.useUtils();

  const questionsQuery = api.institutionAdmin.getQuizQuestions.useQuery({ quizId }, { enabled: open });
  
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<QuestionInput | null>(null);

  const addMut = api.institutionAdmin.addQuestion.useMutation({
    onSuccess: () => {
      utils.institutionAdmin.getQuizQuestions.invalidate({ quizId });
      utils.institutionAdmin.listBatchQuizzes.invalidate(); // to update counts
      setEditingId(null);
      setDraft(null);
      toast.success('Question added');
    },
    onError: (e) => toast.error(e.message),
  });

  const updateMut = api.institutionAdmin.updateQuestion.useMutation({
    onSuccess: () => {
      utils.institutionAdmin.getQuizQuestions.invalidate({ quizId });
      setEditingId(null);
      setDraft(null);
      toast.success('Question updated');
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMut = api.institutionAdmin.deleteQuestion.useMutation({
    onSuccess: () => {
      utils.institutionAdmin.getQuizQuestions.invalidate({ quizId });
      utils.institutionAdmin.listBatchQuizzes.invalidate(); // to update counts
      toast.success('Question deleted');
    },
    onError: (e) => toast.error(e.message),
  });

  function startEdit(q: any) {
    setEditingId(q.id);
    setDraft({
      id: q.id,
      questionText: q.questionText,
      explanation: q.explanation || '',
      sortOrder: q.sortOrder,
      options: q.options.map((o: any) => ({
        id: o.id,
        optionText: o.optionText,
        isCorrect: o.isCorrect,
        sortOrder: o.sortOrder,
      })),
    });
  }

  function startNew() {
    setEditingId('new');
    setDraft(emptyQuestion());
  }

  function handleSave() {
    if (!draft) return;
    if (!draft.questionText.trim()) return toast.error('Question text is required');
    if (draft.options.some(o => !o.optionText.trim())) return toast.error('All options must have text');
    if (draft.options.filter(o => o.isCorrect).length !== 1) return toast.error('Exactly one option must be marked correct');

    if (editingId === 'new') {
      addMut.mutate({
        quizId,
        questionText: draft.questionText,
        explanation: draft.explanation || null,
        sortOrder: draft.sortOrder,
        options: draft.options.map(o => ({
          optionText: o.optionText,
          isCorrect: o.isCorrect,
          sortOrder: o.sortOrder,
        })),
      });
    } else {
      updateMut.mutate({
        questionId: editingId!,
        questionText: draft.questionText,
        explanation: draft.explanation || null,
        sortOrder: draft.sortOrder,
        options: draft.options.map(o => ({
          optionText: o.optionText,
          isCorrect: o.isCorrect,
          sortOrder: o.sortOrder,
        })),
      });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[95vh] flex flex-col p-0 gap-0 overflow-hidden">
        <DialogHeader className="p-6 pb-4 border-b">
          <div className="flex items-center justify-between">
            <DialogTitle>Edit Quiz Questions</DialogTitle>
            {!editingId && (
              <Button onClick={startNew} size="sm">
                <Plus className="h-4 w-4 mr-2" /> Add Question
              </Button>
            )}
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6 bg-muted/20">
          {questionsQuery.isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-4 max-w-3xl mx-auto">
              {questionsQuery.data?.map((q, i) => {
                if (editingId === q.id && draft) {
                  return <EditorCard key={q.id} draft={draft} setDraft={setDraft} onSave={handleSave} onCancel={() => setEditingId(null)} isPending={updateMut.isPending} />;
                }
                return (
                  <Card key={q.id} className="overflow-hidden">
                    <CardContent className="p-5">
                      <div className="flex justify-between items-start gap-4">
                        <div className="space-y-3 flex-1">
                          <div className="flex gap-3">
                            <span className="font-semibold text-muted-foreground">Q{i + 1}.</span>
                            <p className="font-medium text-foreground">{q.questionText}</p>
                          </div>
                          <div className="pl-8 space-y-1">
                            {q.options.map((opt: any, oi: number) => (
                              <div key={opt.id} className="flex items-center gap-2 text-sm">
                                <span className="text-muted-foreground w-4">{String.fromCharCode(65 + oi)}.</span>
                                <span className={opt.isCorrect ? 'text-emerald-600 font-medium' : 'text-muted-foreground'}>
                                  {opt.optionText}
                                </span>
                                {opt.isCorrect && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />}
                              </div>
                            ))}
                          </div>
                          {q.explanation && (
                            <div className="pl-8 mt-2">
                              <div className="bg-muted/50 rounded-md p-3 text-sm text-muted-foreground">
                                <span className="font-medium text-foreground mr-1">Explanation:</span>
                                {q.explanation}
                              </div>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Button variant="outline" size="sm" onClick={() => startEdit(q)}>
                            Edit
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => {
                              if (confirm('Delete this question?')) deleteMut.mutate({ questionId: q.id });
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}

              {editingId === 'new' && draft && (
                <EditorCard draft={draft} setDraft={setDraft} onSave={handleSave} onCancel={() => setEditingId(null)} isPending={addMut.isPending} />
              )}

              {!editingId && questionsQuery.data?.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  No questions yet. Click "Add Question" to begin.
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function EditorCard({ draft, setDraft, onSave, onCancel, isPending }: { draft: QuestionInput, setDraft: any, onSave: () => void, onCancel: () => void, isPending: boolean }) {
  return (
    <Card className="border-primary/50 shadow-sm ring-1 ring-primary/20">
      <CardContent className="p-5 space-y-4">
        <div className="space-y-2">
          <Label>Question Text</Label>
          <Textarea
            value={draft.questionText}
            onChange={e => setDraft({ ...draft, questionText: e.target.value })}
            placeholder="Type your question here..."
            className="min-h-[80px]"
          />
        </div>
        
        <div className="space-y-3">
          <Label>Options</Label>
          <RadioGroup
            value={draft.options.findIndex(o => o.isCorrect).toString()}
            onValueChange={val => {
              const idx = parseInt(val);
              const newOpts = draft.options.map((o, i) => ({ ...o, isCorrect: i === idx }));
              setDraft({ ...draft, options: newOpts });
            }}
            className="space-y-2"
          >
            {draft.options.map((opt, i) => (
              <div key={i} className={`flex items-center gap-3 p-2 rounded-lg border ${opt.isCorrect ? 'bg-primary/5 border-primary/30' : 'bg-background'}`}>
                <RadioGroupItem value={i.toString()} id={`opt-${i}`} />
                <Label htmlFor={`opt-${i}`} className="w-6 text-center text-muted-foreground">{String.fromCharCode(65 + i)}.</Label>
                <Input
                  value={opt.optionText}
                  onChange={e => {
                    const newOpts = [...draft.options];
                    newOpts[i].optionText = e.target.value;
                    setDraft({ ...draft, options: newOpts });
                  }}
                  placeholder={`Option ${i + 1}`}
                  className="flex-1"
                />
              </div>
            ))}
          </RadioGroup>
        </div>

        <div className="space-y-2">
          <Label>Explanation (Optional)</Label>
          <Textarea
            value={draft.explanation}
            onChange={e => setDraft({ ...draft, explanation: e.target.value })}
            placeholder="Explain why the correct answer is right..."
            className="min-h-[60px]"
          />
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t">
          <Button variant="ghost" onClick={onCancel} disabled={isPending}>Cancel</Button>
          <Button onClick={onSave} disabled={isPending}>
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save Question
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
