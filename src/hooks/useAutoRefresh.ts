import { useEffect, useRef } from 'react';

interface AutoRefreshOptions {
  onRefresh: () => void;
  intervalMs?: number;
  enabled?: boolean;
  pause?: boolean;
  refreshOnVisible?: boolean;
  pauseWhenFocused?: boolean;
}

const isFormFieldFocused = () => {
  if (typeof document === 'undefined') return false;
  const active = document.activeElement as HTMLElement | null;
  if (!active) return false;
  const tag = active.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  return active.isContentEditable;
};

export const useAutoRefresh = ({
  onRefresh,
  intervalMs = 10000,
  enabled = true,
  pause = false,
  refreshOnVisible = true,
  pauseWhenFocused = true,
}: AutoRefreshOptions) => {
  const refreshRef = useRef(onRefresh);
  const pauseRef = useRef(pause);

  useEffect(() => {
    refreshRef.current = onRefresh;
  }, [onRefresh]);

  useEffect(() => {
    pauseRef.current = pause;
  }, [pause]);

  useEffect(() => {
    if (typeof window === 'undefined' || !enabled) return;

    const shouldSkip = () => pauseRef.current || (pauseWhenFocused && isFormFieldFocused());

    const runRefresh = () => {
      if (shouldSkip()) return;
      refreshRef.current();
    };

    const interval = window.setInterval(runRefresh, intervalMs);
    const handleVisibility = () => {
      if (!refreshOnVisible) return;
      if (document.visibilityState !== 'visible') return;
      runRefresh();
    };

    if (refreshOnVisible) {
      document.addEventListener('visibilitychange', handleVisibility);
    }

    return () => {
      window.clearInterval(interval);
      if (refreshOnVisible) {
        document.removeEventListener('visibilitychange', handleVisibility);
      }
    };
  }, [enabled, intervalMs, pauseWhenFocused, refreshOnVisible]);
};
