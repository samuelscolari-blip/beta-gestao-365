export type WorkProductivityEntry = {
  date: string;
  productivityStatus?: string;
  lostHours?: number | string | null;
  cause?: string;
};

export type WorkProductivityCause = {
  cause: string;
  hours: number;
  share: number;
};

export type WorkProductivityMetrics = {
  dailyWorkHours: number;
  recordedDays: number;
  recordedHours: number;
  productiveHours: number;
  lostHours: number;
  productiveDays: number;
  unproductiveDays: number;
  utilizationPercent: number;
  causes: WorkProductivityCause[];
};

const DEFAULT_DAILY_WORK_HOURS = 8;

export function normalizeDailyWorkHours(value: unknown) {
  const hours = Number(value);
  if (!Number.isFinite(hours) || hours <= 0) return DEFAULT_DAILY_WORK_HOURS;
  return Math.min(24, hours);
}

function normalizedLostHours(
  entry: WorkProductivityEntry,
  dailyWorkHours: number,
) {
  const informedHours = Math.max(0, Number(entry.lostHours || 0));
  if (informedHours > 0) return informedHours;
  if (entry.productivityStatus === "Improdutivo") return dailyWorkHours;
  if (entry.productivityStatus === "Parcialmente improdutivo") {
    return dailyWorkHours / 2;
  }
  return 0;
}

export function calculateWorkProductivity(
  entries: WorkProductivityEntry[],
  configuredDailyWorkHours?: unknown,
): WorkProductivityMetrics {
  const dailyWorkHours = normalizeDailyWorkHours(configuredDailyWorkHours);
  const hoursByDateAndCause = new Map<string, Map<string, number>>();

  for (const entry of entries) {
    const date = String(entry.date || "").slice(0, 10);
    if (!date) continue;
    const causesForDate =
      hoursByDateAndCause.get(date) || new Map<string, number>();
    const lostHours = normalizedLostHours(entry, dailyWorkHours);
    if (lostHours > 0) {
      const informedCause = String(entry.cause || "").trim();
      const cause =
        informedCause && informedCause !== "Não se aplica"
          ? informedCause
          : "Outro";
      causesForDate.set(cause, (causesForDate.get(cause) || 0) + lostHours);
    }
    hoursByDateAndCause.set(date, causesForDate);
  }

  const lostHoursByCause = new Map<string, number>();
  let lostHours = 0;

  for (const causesForDate of hoursByDateAndCause.values()) {
    const informedForDate = Array.from(causesForDate.values()).reduce(
      (sum, value) => sum + value,
      0,
    );
    const cappedForDate = Math.min(dailyWorkHours, informedForDate);
    const scale = informedForDate > 0 ? cappedForDate / informedForDate : 0;
    lostHours += cappedForDate;
    for (const [cause, hours] of causesForDate.entries()) {
      lostHoursByCause.set(
        cause,
        (lostHoursByCause.get(cause) || 0) + hours * scale,
      );
    }
  }

  const recordedDays = hoursByDateAndCause.size;
  const recordedHours = recordedDays * dailyWorkHours;
  const productiveHours = Math.max(0, recordedHours - lostHours);
  const causes = Array.from(lostHoursByCause.entries())
    .map(([cause, hours]) => ({
      cause,
      hours,
      share: lostHours > 0 ? (hours / lostHours) * 100 : 0,
    }))
    .sort((a, b) => b.hours - a.hours);

  return {
    dailyWorkHours,
    recordedDays,
    recordedHours,
    productiveHours,
    lostHours,
    productiveDays: productiveHours / dailyWorkHours,
    unproductiveDays: lostHours / dailyWorkHours,
    utilizationPercent:
      recordedHours > 0 ? (productiveHours / recordedHours) * 100 : 0,
    causes,
  };
}
