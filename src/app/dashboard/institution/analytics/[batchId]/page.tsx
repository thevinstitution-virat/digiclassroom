import BatchAnalyticsClient from '@/components/institution/BatchAnalyticsClient';

export default function BatchAnalyticsPage({ params }: { params: { batchId: string } }) {
  return <BatchAnalyticsClient batchId={params.batchId} />;
}
