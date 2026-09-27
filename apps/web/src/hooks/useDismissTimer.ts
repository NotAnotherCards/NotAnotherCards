import { useCallback, useEffect, useRef } from 'react';

export function useDismissTimer(duration: number) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clear = useCallback(() => {
    if (timer.current === null) return;
    clearTimeout(timer.current);
    timer.current = null;
  }, []);

  const schedule = useCallback(
    (dismiss: () => void) => {
      clear();
      timer.current = setTimeout(() => {
        timer.current = null;
        dismiss();
      }, duration);
    },
    [clear, duration],
  );

  useEffect(() => clear, [clear]);

  return { clear, schedule };
}
