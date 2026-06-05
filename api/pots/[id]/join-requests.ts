import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getBody, getStringParam, requireUser, sendError, sendServerError, setCors } from '../../_lib/http.js';
import { mapJoinRequest } from '../../_lib/mapper.js';
import { getSupabase, type JoinRequestRow, type TaxiPotRow } from '../../_lib/supabase.js';
import { parseJoinMessage } from '../../_lib/validation.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (setCors(req, res)) return;

  if (req.method !== 'POST') {
    sendError(res, 405, '지원하지 않는 메서드입니다.');
    return;
  }

  const id = getStringParam(req.query.id);
  if (!id) {
    sendError(res, 400, '택시팟 ID가 필요합니다.');
    return;
  }

  const user = requireUser(req, res);
  if (!user) return;

  const parsed = parseJoinMessage(getBody(req));
  if (!parsed.value) {
    sendError(res, 400, parsed.error ?? '입력값이 올바르지 않습니다.');
    return;
  }

  try {
    const supabase = getSupabase();
    const { data: pot, error: potError } = await supabase.from('taxi_pots').select('*').eq('id', id).single();
    if (potError) throw potError;

    const potRow = pot as TaxiPotRow;
    if (potRow.status !== 'open') {
      sendError(res, 400, '마감된 택시팟에는 신청할 수 없습니다.');
      return;
    }
    if (new Date(potRow.departure_time).getTime() <= Date.now()) {
      sendError(res, 400, '이미 출발 시간이 지난 택시팟입니다.');
      return;
    }
    if (potRow.owner_user_id === user.userId) {
      sendError(res, 400, '내가 만든 택시팟에는 신청할 수 없습니다.');
      return;
    }

    const { data: acceptedJoinRequests, error: acceptedError } = await supabase
      .from('join_requests')
      .select('id')
      .eq('pot_id', id)
      .eq('status', 'accepted');
    if (acceptedError) throw acceptedError;

    if ((acceptedJoinRequests?.length ?? 0) >= potRow.max_riders - 1) {
      sendError(res, 400, '탑승 인원이 모두 찼습니다.');
      return;
    }

    const { data, error } = await supabase
      .from('join_requests')
      .insert({
        pot_id: id,
        requester_user_id: user.userId,
        requester_nickname: user.nickname,
        message: parsed.value,
      })
      .select('*')
      .single();

    if (error) {
      if (error.code === '23505') {
        sendError(res, 409, '이미 신청한 택시팟입니다.');
        return;
      }
      throw error;
    }

    res.status(201).json({ joinRequest: mapJoinRequest(data as JoinRequestRow) });
  } catch (error) {
    sendServerError(res, error);
  }
}
