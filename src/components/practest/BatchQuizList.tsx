'use client';

import { useState } from 'react';
import { api } from '@/lib/trpc/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Play, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import ActiveTestInterface from './ActiveTestInterface';
import TestResultsView from './TestResultsView';
import { type NormalizedResult } from '@/types/quiz';

export function BatchQuizList() {
  const batchesQuery = api.student.getEnrolledBatches.useQuery();
  const activeBatches = batchesQuery.data?.filter(b => b.enrollmentStatus === 'active') || [];

  const [activeQuizId, setActiveQuizId] = useState<string | null>(null);
  const [activeSession, setActiveSession] = useState<any | null>(null);
  const [resultAttemptId, setResultAttemptId] = useState<string | null>(null);

  if (batchesQuery.isLoading) {
    return <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  if (activeBatches.length === 0) {
    return (
      <Card className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl border-white/20">
        <CardContent className="p-12 text-center text-muted-foreground">
          You are not actively enrolled in any batches.
        </CardContent>
      </Card>
    );
  }

  if (activeSession) {
    return (
      <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl rounded-2xl shadow-xl border border-white/20 dark:border-gray-700/20 overflow-hidden">
        <BatchQuizActive
          quizId={activeQuizId!}
          session={activeSession}
          onComplete={(attemptId) => {
            setActiveSession(null);
            setResultAttemptId(attemptId);
          }}
          onCancel={() => {
            setActiveSession(null);
            setActiveQuizId(null);
          }}
        />
      </div>
    );
  }

  if (resultAttemptId) {
    return (
      <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl rounded-2xl shadow-xl border border-white/20 dark:border-gray-700/20 overflow-hidden">
        <BatchQuizResult
          attemptId={resultAttemptId}
          onBack={() => {
            setResultAttemptId(null);
            setActiveQuizId(null);
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {activeBatches.map(b => (
        <BatchQuizzes key={b.batchId} batch={b} onStart={(quizId, session) => {
          setActiveQuizId(quizId);
          setActiveSession({ ...session, _batchId: b.batchId });
        }} />
      ))}
    </div>
  );
}

function BatchQuizzes({ batch, onStart }: { batch: any, onStart: (id: string, s: any) => void }) {
  const utils = api.useUtils();
  const logEvent = api.student.logLearningEvent.useMutation();
  const quizzesQuery = api.student.getBatchQuizzes.useQuery({ batchId: batch.batchId });
  const startMut = api.student.startQuizAttempt.useMutation({
    onSuccess: (data, variables) => {
      onStart(variables.quizId, data);
      logEvent.mutate({ batchId: batch.batchId, eventType: 'quiz_start', metadata: { quizId: variables.quizId } });
      utils.student.getBatchQuizzes.invalidate({ batchId: batch.batchId });
    },
    onError: (e) => toast.error(e.message)
  });

  if (quizzesQuery.isLoading) return <div className="flex justify-center py-4"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>;
  if (!quizzesQuery.data || quizzesQuery.data.length === 0) return null;

  return (
    <Card className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl border-white/20">
      <CardHeader>
        <CardTitle>{batch.batchName} Quizzes</CardTitle>
        <CardDescription>Assessments assigned for this batch</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {quizzesQuery.data.map((q: any) => (
          <div key={q.id} className="flex items-center justify-between p-4 rounded-xl border bg-background/50">
            <div>
              <h4 className="font-semibold">{q.title}</h4>
              <div className="text-sm text-muted-foreground flex gap-3 mt-1">
                <span>{q.questionCount} questions</span>
                {q.timeLimitMinutes && <span>{q.timeLimitMinutes} min</span>}
                {q.passingScore && <span>Pass: {q.passingScore}%</span>}
                {q.bestScore !== null && <span>Best: {q.bestScore.toFixed(1)}%</span>}
              </div>
            </div>
            <div className="flex items-center gap-3">
              {q.bestScore !== null && q.passingScore !== null && q.bestScore >= Number(q.passingScore) && (
                <Badge variant="success"><CheckCircle className="h-3 w-3 mr-1" /> Passed</Badge>
              )}
              <Button
                size="sm"
                onClick={() => startMut.mutate({ quizId: q.id })}
                disabled={startMut.isPending || (!q.allowMultipleAttempts && q.attemptCount > 0)}
              >
                {startMut.isPending && startMut.variables?.quizId === q.id ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : <Play className="h-4 w-4 mr-2" />}
                {q.attemptCount > 0 ? 'Retake' : 'Start'}
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function BatchQuizActive({ quizId, session, onComplete, onCancel }: { quizId: string, session: any, onComplete: (a: string) => void, onCancel: () => void }) {
  const logEvent = api.student.logLearningEvent.useMutation();
  const submitMut = api.student.submitQuizAttempt.useMutation({
    onSuccess: () => {
      if (session._batchId) {
        logEvent.mutate({ batchId: session._batchId, eventType: 'quiz_submit', metadata: { quizId } });
      }
      onComplete(session.attemptId);
    },
    onError: (e) => toast.error(e.message)
  });

  const mappedSession = {
    sessionId: session.attemptId,
    questions: session.questions.map((q: any) => ({
      id: q.id,
      questionText: q.text,
      options: q.options,
      difficulty: null,
      topic: null,
      maxMarks: 1,
    })),
    totalQuestions: session.questions.length,
    durationSeconds: session.timeLimitMinutes ? session.timeLimitMinutes * 60 : session.questions.length * 60,
    status: 'active'
  };

  return (
    <ActiveTestInterface
      session={mappedSession}
      onBatchSubmit={async (answers) => {
        const arr = Object.entries(answers).map(([qid, sel]) => ({ questionId: qid, selectedOptionId: sel }));
        await submitMut.mutateAsync({ attemptId: session.attemptId, answers: arr });
      }}
      onError={(err) => toast.error(err)}
    />
  );
}

function BatchQuizResult({ attemptId, onBack }: { attemptId: string, onBack: () => void }) {
  const resultQuery = api.student.getAttemptResult.useQuery({ attemptId });

  if (resultQuery.isLoading) return <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  if (!resultQuery.data) return null;

  return (
    <TestResultsView
      batchResult={resultQuery.data as NormalizedResult}
      onBackToGenerator={onBack}
      onViewHistory={() => {}}
    />
  );
}
