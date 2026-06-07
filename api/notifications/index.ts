import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireUser, sendError, sendServerError, setCors } from '../_lib/http.js';
import { mapTaxiNotification } from '../_lib/mapper.js';
import { getSupabase, type TaxiNotificationRow } from '../_lib/supabase.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (setCors(req, res)) return;

  if (req.method !== 'GET') {
    sendError(res, 405, '지원하지 않는 메서드입니다.');
    return;
  }

  const user = await requireUser(req, res);
  if (!user) return;

  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('taxi_notifications')
      .select('*')
      .eq('user_id', user.userId)
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) {
      if (error.code === 'PGRST205' || error.code === '42P01') {
        res.status(200).json({ notifications: [], unreadCount: 0 });
        return;
      }
      throw error;
    }

    const notifications = ((data ?? []) as TaxiNotificationRow[]).map(mapTaxiNotification);
    res.status(200).json({
      notifications,
      unreadCount: notifications.filter((notification) => !notification.isRead).length,
    });
  } catch (error) {
    sendServerError(res, error);
  }
}
