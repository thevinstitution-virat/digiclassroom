'use client';

import { useState } from 'react';
import { api } from '@/lib/trpc/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, Plus, Pencil, Trash2, Settings } from 'lucide-react';
import { QuizCreateDialog } from './QuizCreateDialog';
import { QuizQuestionsEditor } from './QuizQuestionsEditor';

export function BatchQuizzesTab({ batchId }: { batchId: string }) {
  const utils = api.useUtils();
  
  const [createOpen, setCreateOpen] = useState(false);
  const [editingQuizId, setEditingQuizId] = useState<string | null>(null);
  const [questionsQuizId, setQuestionsQuizId] = useState<string | null>(null);

  const quizzesQuery = api.institutionAdmin.listBatchQuizzes.useQuery({ batchId });
  const deleteQuiz = api.institutionAdmin.deleteQuiz.useMutation({
    onSuccess: () => {
      utils.institutionAdmin.listBatchQuizzes.invalidate({ batchId });
      toast.success('Quiz deleted');
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-medium">Quizzes</h3>
          <p className="text-sm text-muted-foreground">Manage assessments for this batch.</p>
        </div>
        <Button onClick={() => setCreateOpen(true)} size="sm">
          <Plus className="mr-2 h-4 w-4" /> New Quiz
        </Button>
      </div>

      {quizzesQuery.isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : quizzesQuery.data?.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-sm text-muted-foreground mb-4">No quizzes created yet.</p>
            <Button variant="outline" onClick={() => setCreateOpen(true)}>
              <Plus className="mr-2 h-4 w-4" /> Create first quiz
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {quizzesQuery.data?.map(quiz => (
            <Card key={quiz.id} className="overflow-hidden">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <h4 className="font-semibold text-foreground">{quiz.title}</h4>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                    <span>{quiz.questionCount} questions</span>
                    <span>{quiz.attemptCount} attempts</span>
                    {quiz.timeLimitMinutes && <span>{quiz.timeLimitMinutes} min</span>}
                    {quiz.passingScore && <span>Pass: {quiz.passingScore}%</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setQuestionsQuizId(quiz.id)}
                  >
                    Edit Questions
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setEditingQuizId(quiz.id)}
                  >
                    <Settings className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => {
                      if (confirm('Are you sure you want to delete this quiz?')) {
                        deleteQuiz.mutate({ quizId: quiz.id });
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {createOpen && (
        <QuizCreateDialog
          batchId={batchId}
          open={createOpen}
          onOpenChange={setCreateOpen}
        />
      )}

      {editingQuizId && (
        <QuizCreateDialog
          batchId={batchId}
          quizId={editingQuizId}
          open={!!editingQuizId}
          onOpenChange={(open) => !open && setEditingQuizId(null)}
        />
      )}

      {questionsQuizId && (
        <QuizQuestionsEditor
          quizId={questionsQuizId}
          open={!!questionsQuizId}
          onOpenChange={(open) => !open && setQuestionsQuizId(null)}
        />
      )}
    </div>
  );
}
