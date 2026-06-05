import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getStringParam, requireUser, sendError, sendServerError, setCors } from '../_lib/http.js';
import { mapJoinRequest, mapTaxiPot } from '../_lib/mapper.js';
import { getSupabase, type JoinRequestRow, type TaxiPotRow } from '../_lib/supabase.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (setCors(req, res)) return;

  if (req.method !== 'GET') {
    sendError(res, 405, '지원하지 않는 메서드입니다.');
    return;
  }

  const user = requireUser(req, res);
  if (!user) return;

  const queryUserId = getStringParam(req.query.userId);
  if (queryUserId && queryUserId !== user.userId) {
    sendError(res, 403, '다른 사용자의 택시팟은 조회할 수 없습니다.');
    return;
  }

  try {
    const supabase = getSupabase();
    const { data: ownedPots, error: ownedError } = await supabase
      .from('taxi_pots')
      .select('*')
      .eq('owner_user_id', user.userId)
      .order('departure_time', { ascending: true });
    if (ownedError) throw ownedError;

    const { data: myJoinRequests, error: requestError } = await supabase
      .from('join_requests')
      .select('*')
      .eq('requester_user_id', user.userId)
      .order('created_at', { ascending: false });
    if (requestError) throw requestError;

    const ownedRows = (ownedPots ?? []) as TaxiPotRow[];
    const joinRequestRows = (myJoinRequests ?? []) as JoinRequestRow[];
    const potIds = Array.from(new Set([...ownedRows.map((pot) => pot.id), ...joinRequestRows.map((item) => item.pot_id)]));

    const { data: relatedJoinRequests, error: relatedRequestError } = potIds.length
      ? await supabase.from('join_requests').select('*').in('pot_id', potIds)
      : { data: [], error: null };
    if (relatedRequestError) throw relatedRequestError;

    const { data: joinedPots, error: joinedPotError } = joinRequestRows.length
      ? await supabase.from('taxi_pots').select('*').in('id', joinRequestRows.map((item) => item.pot_id))
      : { data: [], error: null };
    if (joinedPotError) throw joinedPotError;

    const relatedRows = (relatedJoinRequests ?? []) as JoinRequestRow[];
    const joinedRows = (joinedPots ?? []) as TaxiPotRow[];

    const ownedResponse = ownedRows.map((pot) => mapPotWithRequests(pot, relatedRows, user.userId, true));
    const requestResponse = joinRequestRows.map((joinRequest) => {
      const pot = joinedRows.find((item) => item.id === joinRequest.pot_id) ?? null;
      return {
        joinRequest: mapJoinRequest(joinRequest),
        pot: pot
          ? mapPotWithRequests(pot, relatedRows, user.userId, joinRequest.status === 'accepted')
          : null,
      };
    });

    res.status(200).json({ ownedPots: ownedResponse, joinRequests: requestResponse });
  } catch (error) {
    sendServerError(res, error);
  }
}

function mapPotWithRequests(
  pot: TaxiPotRow,
  allJoinRequests: JoinRequestRow[],
  userId: string,
  includeOpenChatUrl: boolean,
) {
  const potJoinRequests = allJoinRequests.filter((joinRequest) => joinRequest.pot_id === pot.id);
  const acceptedCount = potJoinRequests.filter((joinRequest) => joinRequest.status === 'accepted').length;
  const pendingCount = potJoinRequests.filter((joinRequest) => joinRequest.status === 'pending').length;
  const myJoinRequest = potJoinRequests.find((joinRequest) => joinRequest.requester_user_id === userId) ?? null;

  return mapTaxiPot(pot, {
    acceptedCount,
    pendingCount,
    myJoinRequest,
    includeOpenChatUrl,
    joinRequests: pot.owner_user_id === userId ? potJoinRequests : undefined,
  });
}
