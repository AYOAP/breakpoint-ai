type DailyQuotaState = {
  count: number;
  dateKey: string;
};

declare global {
  // eslint-disable-next-line no-var
  var __breakpointDailyQuota__: DailyQuotaState | undefined;
}

function getTodayKey() {
  return new Date().toISOString().slice(0, 10);
}

function getDailyLimit() {
  const raw = process.env.BREAKPOINT_DAILY_API_LIMIT?.trim();
  const parsed = raw ? Number(raw) : Number.NaN;

  if (Number.isFinite(parsed) && parsed > 0) {
    return Math.floor(parsed);
  }

  return 100;
}

function getState() {
  const today = getTodayKey();

  if (!globalThis.__breakpointDailyQuota__ || globalThis.__breakpointDailyQuota__.dateKey !== today) {
    globalThis.__breakpointDailyQuota__ = {
      count: 0,
      dateKey: today,
    };
  }

  return globalThis.__breakpointDailyQuota__;
}

export function consumeDailyQuota() {
  const limit = getDailyLimit();
  const state = getState();

  if (state.count >= limit) {
    return {
      allowed: false as const,
      limit,
      remaining: 0,
      used: state.count,
      dateKey: state.dateKey,
    };
  }

  state.count += 1;

  return {
    allowed: true as const,
    limit,
    remaining: Math.max(0, limit - state.count),
    used: state.count,
    dateKey: state.dateKey,
  };
}
