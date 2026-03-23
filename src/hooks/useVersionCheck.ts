import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '../queries/queryKeys';

const POLL_INTERVAL = 5 * 60 * 1000; // 5 minutes

const fetchVersion = async (): Promise<string> => {
  const response = await fetch('/version.json', { cache: 'no-store' });
  const data = await response.json();
  return data.buildHash;
};

export const useVersionCheck = () => {
  const { data: remoteHash } = useQuery({
    queryKey: queryKeys.version,
    queryFn: fetchVersion,
    refetchInterval: POLL_INTERVAL,
    refetchIntervalInBackground: true,
  });

  const hasNewVersion =
    !!remoteHash && remoteHash !== __BUILD_HASH__;

  return { hasNewVersion };
};
