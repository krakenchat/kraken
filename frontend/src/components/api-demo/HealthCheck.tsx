import { useQuery } from '@tanstack/react-query';
import { healthControllerCheckOptions } from '../../api-client/@tanstack/react-query.gen';

export function HealthCheck() {
  const { data, isLoading, error } = useQuery({
    ...healthControllerCheckOptions(),
  });

  if (isLoading) return <span>Checking...</span>;
  if (error) return <span>Error: {error.message}</span>;

  const health = data as { status: string; instanceName: string; version: string; timestamp: string } | undefined;

  return (
    <div>
      Status: {health?.status} | Instance: {health?.instanceName} | Version: {health?.version}
    </div>
  );
}
