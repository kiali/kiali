import { test } from '@playwright/test';
import fs from 'fs';
import os from 'os';
import path from 'path';

const LOCK_FILE = path.join(os.tmpdir(), 'kiali-playwright-bookinfo-routing.lock');
const LOCK_STALE_MS = 5 * 60 * 1000;

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function isStaleLock(): boolean {
  try {
    const stat = fs.statSync(LOCK_FILE);
    if (Date.now() - stat.mtimeMs > LOCK_STALE_MS) {
      return true;
    }

    const content = fs.readFileSync(LOCK_FILE, 'utf8');
    const pid = Number.parseInt(content.split(':')[0] ?? '', 10);
    return !Number.isFinite(pid) || !isProcessAlive(pid);
  } catch {
    return false;
  }
}

function tryAcquireLock(): (() => void) | undefined {
  if (isStaleLock()) {
    try {
      fs.unlinkSync(LOCK_FILE);
    } catch {
      // ignore
    }
  }

  try {
    fs.writeFileSync(LOCK_FILE, `${process.pid}:${Date.now()}`, { flag: 'wx' });
    return () => {
      try {
        fs.unlinkSync(LOCK_FILE);
      } catch {
        // ignore
      }
    };
  } catch {
    return undefined;
  }
}

/** Acquire a cross-process lock for bookinfo Gateway API wizard tests (routing + istio config). */
export async function acquireBookinfoRoutingLock(): Promise<() => void> {
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    const release = tryAcquireLock();
    if (release) {
      return release;
    }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  throw new Error('Timed out acquiring bookinfo routing lock');
}

/** Run a bookinfo/reviews routing wizard test under the shared lock. */
export async function withBookinfoRoutingLock<T>(fn: () => Promise<T>): Promise<T> {
  const release = await acquireBookinfoRoutingLock();
  try {
    return await fn();
  } finally {
    release();
  }
}

let activeBookinfoRoutingLockRelease: (() => void) | undefined;

/**
 * Hold the bookinfo routing lock per test (not for the whole describe).
 * Lets gateway and routing spec files interleave across Playwright workers without
 * one file blocking the other for minutes via beforeAll.
 */
export function useBookinfoRoutingLockPerTest(): void {
  test.beforeEach(async () => {
    activeBookinfoRoutingLockRelease = await acquireBookinfoRoutingLock();
  });

  test.afterEach(() => {
    activeBookinfoRoutingLockRelease?.();
    activeBookinfoRoutingLockRelease = undefined;
  });
}
