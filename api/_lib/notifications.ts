import type { SupabaseClient } from '@supabase/supabase-js';

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

