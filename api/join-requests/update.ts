import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getBody, getStringParam, requireUser, sendError, sendServerError, setCors } from '../_lib/http.js';
import { mapJoinRequest } from '../_lib/mapper.js';
import { createTaxiNotification } from '../_lib/notifications.js';
import { getSupabase, type JoinRequestRow, type TaxiPotRow } from '../_lib/supabase.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (setCors(req, res)) return;

  if (req.method !== 'PUT') {
    sendError(res, 405, '지원하지 않는 메서드입니다.');
    return;
  }

  const id = getStringParam(req.query.id);
  if (!id) {
    sendError(res, 400, '신청 ID가 필요합니다.');
    return;
  }

  const user = await requireUser(req, res);
  if (!user) return;

  const body = getBody(req);
  const status = typeof body.status === 'string' ? body.status : '';
  if (status !== 'accepted' && status !== 'rejected' && status !== 'canceled') {
    sendError(res, 400, '신청 상태가 올바르지 않습니다.');
    return;
  }

  try {
    const supabase = getSupabase();
    const { data: joinRequest, error: joinRequestError } = await supabase
      .from('join_requests')
      .select('*')
      .eq('id', id)
      .single();
    if (joinRequestError) throw joinRequestError;

    const joinRequestRow = joinRequest as JoinRequestRow;
    const { data: pot, error: potError } = await supabase
      .from('taxi_pots')
      .select('*')
      .eq('id', joinRequestRow.pot_id)
      .single();
    if (potError) throw potError;

    const potRow = pot as TaxiPotRow;
    const isOwner = potRow.owner_user_id === user.userId;
    const isRequester = joinRequestRow.requester_user_id === user.userId;

    if ((status === 'accepted' || status === 'rejected') && !isOwner) {
      sendError(res, 403, '방장만 신청을 승인하거나 거절할 수 있습니다.');
      return;
    }
    if (status === 'canceled' && !isRequester) {
      sendError(res, 403, '신청자만 신청을 취소할 수 있습니다.');
      return;
    }
    if ((status === 'accepted' || status === 'rejected') && potRow.status !== 'open') {
      sendError(res, 400, '마감된 택시팟의 신청은 변경할 수 없습니다.');
      return;
    }

    if (status === 'accepted') {
      const { data: acceptedJoinRequests, error: acceptedError } = await supabase
        .from('join_requests')
        .select('id')
        .eq('pot_id', potRow.id)
        .eq('status', 'accepted');
      if (acceptedError) throw acceptedError;

      const acceptedOtherCount = (acceptedJoinRequests ?? []).filter((item) => item.id !== id).length;
      if (acceptedOtherCount >= potRow.max_riders - 1) {
        sendError(res, 400, '탑승 인원이 모두 찼습니다.');
        return;
      }
    }

    const { data, error } = await supabase
      .from('join_requests')
      .update({ status })
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;

    const updatedJoinRequest = data as JoinRequestRow;
    if (status === 'accepted' || status === 'rejected') {
      await createTaxiNotification(supabase, {
        userId: joinRequestRow.requester_user_id,
        potId: potRow.id,
        joinRequestId: joinRequestRow.id,
        type: status === 'accepted' ? 'join_accepted' : 'join_rejected',
        title: status === 'accepted' ? '참여 신청이 승인됐어요' : '참여 신청이 거절됐어요',
        message: `${potRow.start_location} → ${potRow.destination} 택시팟 신청 결과를 확인하세요.`,
      });
    }

    if (status === 'canceled') {
      await createTaxiNotification(supabase, {
        userId: potRow.owner_user_id,
        potId: potRow.id,
        joinRequestId: joinRequestRow.id,
        type: 'join_canceled',
        title: '참여 신청이 취소됐어요',
        message: `${joinRequestRow.requester_nickname}님이 ${potRow.start_location} → ${potRow.destination} 신청을 취소했습니다.`,
      });
    }

    res.status(200).json({ joinRequest: mapJoinRequest(updatedJoinRequest) });
  } catch (error) {
    sendServerError(res, error);
  }
}
