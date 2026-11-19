import Redis from 'ioredis';
import { FossaPayWebhookEvent } from '@fossapay/client';

export interface RecordedWebhookEvent {
  id: string;
  receivedAt: string;
  signature: string | null;
  isValidSignature: boolean;
  event: FossaPayWebhookEvent;
  routedTo: string[];
}

const MAX_HISTORY = 100;
const REDIS_EVENTS_KEY = 'fossapay:events';
const REDIS_DEDUP_PREFIX = 'fossapay:dedup:';

let redis: Redis | null = null;
const memoryHistory: RecordedWebhookEvent[] = [];
const memoryDedup = new Set<string>();

export function getRedisClient(): Redis | null {
  const redisUrl = process.env.REDIS_URL || process.env.REDIS_PRIVATE_URL;
  if (!redisUrl) {
    if (redis) {
      try {
        redis.disconnect();
      } catch {}
      redis = null;
    }
    return null;
  }
  if (!redis) {
    try {
      redis = new Redis(redisUrl, {
        maxRetriesPerRequest: 2,
        enableReadyCheck: true,
        lazyConnect: false,
        retryStrategy(times) {
          if (times > 5) return null;
          return Math.min(times * 500, 3000);
        },
      });
      redis.on('error', (err) => {
        console.error('[Gateway Store] Redis error:', err.message);
      });
      redis.on('connect', () => {
        console.log('[Gateway Store] Connected to Redis persistence');
      });
    } catch (err) {
      console.error('[Gateway Store] Failed to initialize Redis:', err);
      redis = null;
    }
  }
  return redis;
}

export async function recordEvent(event: RecordedWebhookEvent): Promise<void> {
  memoryHistory.unshift(event);
  if (memoryHistory.length > MAX_HISTORY) memoryHistory.pop();

  const client = getRedisClient();
  if (client) {
    try {
      await client.lpush(REDIS_EVENTS_KEY, JSON.stringify(event));
      await client.ltrim(REDIS_EVENTS_KEY, 0, MAX_HISTORY - 1);
    } catch (err) {
      console.error('[Gateway Store] Redis recordEvent error:', err);
    }
  }
}

export async function updateEvent(event: RecordedWebhookEvent): Promise<void> {
  const idx = memoryHistory.findIndex((e) => e.id === event.id);
  if (idx !== -1) {
    memoryHistory[idx] = event;
  }

  const client = getRedisClient();
  if (client) {
    try {
      const items = await client.lrange(REDIS_EVENTS_KEY, 0, MAX_HISTORY - 1);
      for (let i = 0; i < items.length; i++) {
        try {
          const parsed = JSON.parse(items[i]);
          if (parsed.id === event.id) {
            await client.lset(REDIS_EVENTS_KEY, i, JSON.stringify(event));
            break;
          }
        } catch {}
      }
    } catch (err) {
      console.error('[Gateway Store] Redis updateEvent error:', err);
    }
  }
}

export async function getEvents(): Promise<RecordedWebhookEvent[]> {
  const client = getRedisClient();
  if (client) {
    try {
      const items = await client.lrange(REDIS_EVENTS_KEY, 0, MAX_HISTORY - 1);
      if (items.length > 0) {
        return items.map((raw) => JSON.parse(raw));
      }
    } catch (err) {
      console.error('[Gateway Store] Redis getEvents error:', err);
    }
  }
  return memoryHistory;
}

export async function checkAndMarkDuplicate(eventId?: string): Promise<boolean> {
  if (!eventId) return false;

  const client = getRedisClient();
  if (client) {
    try {
      // SET key value EX 86400 NX returns "OK" if key was set, null if key already existed
      const res = await client.set(`${REDIS_DEDUP_PREFIX}${eventId}`, '1', 'EX', 86400, 'NX');
      return res === null;
    } catch (err) {
      console.error('[Gateway Store] Redis dedup check error:', err);
    }
  }

  if (memoryDedup.has(eventId)) {
    return true;
  }
  memoryDedup.add(eventId);
  return false;
}

export function getPersistenceStatus(): 'redis' | 'in-memory' {
  return getRedisClient() ? 'redis' : 'in-memory';
}

export async function closeStore(): Promise<void> {
  if (redis) {
    try {
      await redis.quit();
    } catch {
      redis.disconnect();
    }
    redis = null;
  }
}

export async function resetStore(): Promise<void> {
  memoryHistory.length = 0;
  memoryDedup.clear();
  const client = getRedisClient();
  if (client) {
    try {
      await client.del(REDIS_EVENTS_KEY);
      const keys = await client.keys(`${REDIS_DEDUP_PREFIX}*`);
      if (keys.length > 0) {
        await client.del(...keys);
      }
    } catch (err) {
      console.error('[Gateway Store] Redis resetStore error:', err);
    }
  }
}
