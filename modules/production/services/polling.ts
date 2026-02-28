export type Unsubscribe = () => void;

export const startPolling = <T>(
  fetcher: () => Promise<T>,
  onData: (data: T) => void,
  intervalMs = 5000,
): Unsubscribe => {
  let active = true;

  const tick = async () => {
    if (!active) return;
    try {
      const data = await fetcher();
      if (active) onData(data);
    } catch (error) {
      console.error('Polling error:', error);
    }
  };

  tick();
  const timer = window.setInterval(tick, intervalMs);

  return () => {
    active = false;
    window.clearInterval(timer);
  };
};
