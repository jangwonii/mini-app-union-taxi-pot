import type { SupabaseClient } from '@supabase/supabase-js';

const UNION_NOTIFICATION_ENDPOINT =
  'https://union-api-183092809276.asia-northeast3.run.app/api/v1/publishers/notifications';
const TARGET_APP_ID = 'com.union.taxi-pot';
type UnionNotificationCategory = 'ANNOUNCEMENT' | 'UPDATE' | 'RECOMMENDATION' | 'MINIAPP_GENERIC';

export type TaxiNotificationType =
  | 'join_requested'
  | 'join_accepted'
  | 'join_rejected'
  | 'join_canceled'
  | 'pot_closed';

export interface CreateTaxiNotificationInput {
  userId: string;
  potId?: string | null;
  joinRequestId?: string | null;
  type: TaxiNotificationType;
  title: string;
  message: string;
}

interface UnionNotificationResponse {
  campaignId: number;
  subscriberCount: number;
  sentTokenCount: number;
}

interface SendUnionBroadcastNotificationInput {
  title: string;
  body: string;
  category: UnionNotificationCategory;
  targetPath?: string;
}

export async function createTaxiNotification(
  supabase: SupabaseClient,
  input: CreateTaxiNotificationInput,
): Promise<void> {
  const { error } = await supabase.from('taxi_notifications').insert({
    user_id: input.userId,
    pot_id: input.potId ?? null,
    join_request_id: input.joinRequestId ?? null,
    type: input.type,
    title: input.title,
    message: input.message,
  });

  if (error) {
    console.error('[notification:error]', error.message, input);
  }
}

// This Union publisher API sends to all active subscribers of targetAppId.
// Do not use it for per-user taxi_notifications rows.
export async function sendUnionBroadcastNotification(input: SendUnionBroadcastNotificationInput): Promise<void> {
  const apiKey = process.env.UNION_API_KEY;
  if (!apiKey) return;

  try {
    const response = await fetch(UNION_NOTIFICATION_ENDPOINT, {
      method: 'POST',
      headers: {
        'X-Union-Api-Key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        targetAppId: TARGET_APP_ID,
        title: trimForPush(input.title, 120),
        body: trimForPush(input.body, 500),
        category: input.category,
        deeplinkType: 'MINIAPP',
        targetPath: input.targetPath ?? '/notifications',
      }),
    });

    if (!response.ok) {
      console.error('[union-notification:error]', response.status, await response.text());
      return;
    }

    const result = (await response.json()) as UnionNotificationResponse;
    console.info('[union-notification:sent]', result);
  } catch (error) {
    console.error('[union-notification:error]', error);
  }
}

function trimForPush(value: string, maxLength: number): string {
  return value.length > maxLength ? value.slice(0, maxLength) : value;
}

