import type { ScheduleInstance } from "../models/schedule";

import Logger from "./logger";

const STORAGE_KEY = "scheduleData";

const canUseStorage = (): boolean =>
  typeof window !== "undefined" && typeof window.localStorage !== "undefined";

export const loadScheduleFromStorage = (): ScheduleInstance | null => {
  if (!canUseStorage()) return null;

  try {
    const rawValue = window.localStorage.getItem(STORAGE_KEY);
    if (!rawValue) return null;

    return JSON.parse(rawValue) as ScheduleInstance;
  } catch (error) {
    Logger.warn("Stored schedule parse failed", error);
    window.localStorage.removeItem(STORAGE_KEY);
    return null;
  }
};

export const saveScheduleToStorage = (
  schedule: ScheduleInstance | null | undefined
): void => {
  if (!canUseStorage() || !schedule) return;

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(schedule));
  } catch (error) {
    Logger.warn("Schedule persist failed", error);
  }
};

export const clearScheduleFromStorage = (): void => {
  if (!canUseStorage()) return;

  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    Logger.warn("Schedule clear failed", error);
  }
};

