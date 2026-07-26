'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { api } from '@/lib/trpc/client';
import { toast } from 'sonner';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Loader2 } from 'lucide-react';

const formSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  timeLimitMinutes: z.number().min(1).nullable().optional(),
  passingScore: z.number().min(0).max(100).nullable().optional(),
  shuffleQuestions: z.boolean().default(false),
  allowMultipleAttempts: z.boolean().default(true),
});

type FormValues = z.infer<typeof formSchema>;

export function QuizCreateDialog({
  batchId,
  quizId,
  open,
  onOpenChange,
}: {
  batchId: string;
  quizId?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const utils = api.useUtils();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: '',
      timeLimitMinutes: null,
      passingScore: null,
      shuffleQuestions: false,
      allowMultipleAttempts: true,
    },
  });

  const { data: quizzes } = api.institutionAdmin.listBatchQuizzes.useQuery(
    { batchId },
    { enabled: !!quizId }
  );

  const existingQuiz = quizzes?.find(q => q.id === quizId);

  useEffect(() => {
    if (existingQuiz) {
      form.reset({
        title: existingQuiz.title,
        timeLimitMinutes: existingQuiz.timeLimitMinutes,
        passingScore: existingQuiz.passingScore ? Number(existingQuiz.passingScore) : null,
        shuffleQuestions: existingQuiz.shuffleQuestions,
        allowMultipleAttempts: existingQuiz.allowMultipleAttempts,
      });
    } else {
      form.reset({
        title: '',
        timeLimitMinutes: null,
        passingScore: null,
        shuffleQuestions: false,
        allowMultipleAttempts: true,
      });
    }
  }, [existingQuiz, form, open]);

  const createMut = api.institutionAdmin.createQuiz.useMutation({
    onSuccess: () => {
      utils.institutionAdmin.listBatchQuizzes.invalidate({ batchId });
      toast.success('Quiz created');
      onOpenChange(false);
    },
    onError: (e) => toast.error(e.message),
  });

  const updateMut = api.institutionAdmin.updateQuiz.useMutation({
    onSuccess: () => {
      utils.institutionAdmin.listBatchQuizzes.invalidate({ batchId });
      toast.success('Quiz updated');
      onOpenChange(false);
    },
    onError: (e) => toast.error(e.message),
  });

  const isPending = createMut.isPending || updateMut.isPending;

  function onSubmit(values: FormValues) {
    if (quizId) {
      updateMut.mutate({ quizId, ...values });
    } else {
      createMut.mutate({ batchId, ...values });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{quizId ? 'Edit Quiz' : 'New Quiz'}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }: { field: any }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Midterm Assessment" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="timeLimitMinutes"
                render={({ field }: { field: any }) => (
                  <FormItem>
                    <FormLabel>Time Limit (minutes)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="Optional"
                        value={field.value ?? ''}
                        onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : null)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="passingScore"
                render={({ field }: { field: any }) => (
                  <FormItem>
                    <FormLabel>Passing Score (%)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="Optional"
                        value={field.value ?? ''}
                        onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : null)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="shuffleQuestions"
              render={({ field }: { field: any }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                  <div className="space-y-0.5">
                    <FormLabel>Shuffle Questions</FormLabel>
                    <FormDescription>
                      Randomize question order for each student.
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="allowMultipleAttempts"
              render={({ field }: { field: any }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                  <div className="space-y-0.5">
                    <FormLabel>Allow Multiple Attempts</FormLabel>
                    <FormDescription>
                      Students can retake the quiz multiple times.
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
