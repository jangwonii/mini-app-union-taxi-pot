import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getBody, getStringParam, requireUser, sendError, sendServerError, setCors } from '../_lib/http.js';
import { mapTaxiNotification } from '../_lib/mapper.js';
import { getSupabase, type TaxiNotificationRow } from '../_lib/supabase.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (setCors(req, res)) return;

  if (req.method !== 'PUT') {
    sendError(res, 405, '지원하지 않는 메서드입니다.');
    return;
  }

  const user = await requireUser(req, res);
  if (!user) return;

  try {
    const supabase = getSupabase();
    const id = getStringParam(req.query.id);
    const body = getBody(req);

    if (body.readAll === true) {
      const { error } = await supabase
        .from('taxi_notifications')
        .update({ is_read: true })
        .eq('user_id', user.userId)
        .eq('is_read', false);
      if (error) {
        if (error.code === 'PGRST205' || error.code === '42P01') {
          res.status(200).json({ ok: true });
          return;
        }
        throw error;
      }
      res.status(200).json({ ok: true });
      return;
    }

    if (!id) {
      sendError(res, 400, '알림 ID가 필요합니다.');
      return;
    }

    const { data, error } = await supabase
      .from('taxi_notifications')
      .update({ is_read: true })
      .eq('id', id)
      .eq('user_id', user.userId)
      .select('*')
      .single();
    if (error) {
      if (error.code === 'PGRST205' || error.code === '42P01') {
        sendError(res, 404, '알림을 찾을 수 없습니다.');
        return;
      }
      throw error;
    }

    res.status(200).json({ notification: mapTaxiNotification(data as TaxiNotificationRow) });
  } catch (error) {
    sendServerError(res, error);
  }
}
