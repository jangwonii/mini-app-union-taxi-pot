import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getBody, getStringParam, requireUser, sendError, sendServerError, setCors } from '../_lib/http.js';
import { mapTaxiPot } from '../_lib/mapper.js';
import { createTaxiNotification } from '../_lib/notifications.js';
import { getSupabase, type JoinRequestRow, type TaxiPotRow } from '../_lib/supabase.js';
import { parseTaxiPotInput } from '../_lib/validation.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (setCors(req, res)) return;

  const id = getStringParam(req.query.id);
  if (!id) {
    sendError(res, 400, '택시팟 ID가 필요합니다.');
    return;
  }

  try {
    const supabase = getSupabase();

    if (req.method === 'GET') {
      const user = await requireUser(req, res);
      if (!user) return;
      const { data: pot, error } = await supabase.from('taxi_pots').select('*').eq('id', id).single();
      if (error) throw error;

      const { data: joinRequests, error: joinRequestError } = await supabase
        .from('join_requests')
        .select('*')
        .eq('pot_id', id)
        .order('created_at', { ascending: true });
      if (joinRequestError) throw joinRequestError;

      const potRow = pot as TaxiPotRow;
      const joinRequestRows = (joinRequests ?? []) as JoinRequestRow[];
      const acceptedCount = joinRequestRows.filter((joinRequest) => joinRequest.status === 'accepted').length;
      const pendingCount = joinRequestRows.filter((joinRequest) => joinRequest.status === 'pending').length;
      const myJoinRequest = joinRequestRows.find((joinRequest) => joinRequest.requester_user_id === user.userId) ?? null;
      const isOwner = potRow.owner_user_id === user.userId;
      const canSeeOpenChat = isOwner || myJoinRequest?.status === 'accepted';

      res.status(200).json({
        pot: mapTaxiPot(potRow, {
          acceptedCount,
          pendingCount,
          includeOpenChatUrl: canSeeOpenChat,
          myJoinRequest,
          joinRequests: isOwner ? joinRequestRows : undefined,
        }),
      });
      return;
    }

    if (req.method === 'PUT') {
      const user = await requireUser(req, res);
      if (!user) return;

      const { data: existingPot, error: existingError } = await supabase
        .from('taxi_pots')
        .select('*')
        .eq('id', id)
        .single();
      if (existingError) throw existingError;

      const potRow = existingPot as TaxiPotRow;
      if (potRow.owner_user_id !== user.userId) {
        sendError(res, 403, '방장만 택시팟을 수정할 수 있습니다.');
        return;
      }

      const body = getBody(req);
      const nextStatus = typeof body.status === 'string' ? body.status : potRow.status;
      if (nextStatus !== 'open' && nextStatus !== 'closed') {
        sendError(res, 400, '택시팟 상태가 올바르지 않습니다.');
        return;
      }

      const updatePayload: Record<string, unknown> = { status: nextStatus };
      if (body.startLocation !== undefined) {
        const parsed = parseTaxiPotInput({ ...potRowToInput(potRow), ...body });
        if (!parsed.value) {
          sendError(res, 400, parsed.error ?? '입력값이 올바르지 않습니다.');
          return;
        }
        updatePayload.start_location = parsed.value.startLocation;
        updatePayload.destination = parsed.value.destination;
        updatePayload.departure_time = parsed.value.departureTime;
        updatePayload.estimated_fare = parsed.value.estimatedFare;
        updatePayload.max_riders = parsed.value.maxRiders;
        updatePayload.description = parsed.value.description;
        updatePayload.tags = parsed.value.tags;
        updatePayload.open_chat_url = parsed.value.openChatUrl;
      }

      const { data, error } = await supabase
        .from('taxi_pots')
        .update(updatePayload)
        .eq('id', id)
        .select('*')
        .single();
      if (error) throw error;

      if (potRow.status !== 'closed' && nextStatus === 'closed') {
        const { data: relatedRequests, error: relatedError } = await supabase
          .from('join_requests')
          .select('*')
          .eq('pot_id', id)
          .in('status', ['pending', 'accepted']);
        if (relatedError) throw relatedError;

        await Promise.all(
          ((relatedRequests ?? []) as JoinRequestRow[]).map((joinRequest) =>
            createTaxiNotification(supabase, {
              userId: joinRequest.requester_user_id,
              potId: id,
              joinRequestId: joinRequest.id,
              type: 'pot_closed',
              title: '택시팟이 마감됐어요',
              message: `${potRow.start_location} → ${potRow.destination} 택시팟이 마감됐습니다.`,
            }),
          ),
        );
      }

      res.status(200).json({ pot: mapTaxiPot(data as TaxiPotRow, { includeOpenChatUrl: true }) });
      return;
    }

    sendError(res, 405, '지원하지 않는 메서드입니다.');
  } catch (error) {
    sendServerError(res, error);
  }
}

function potRowToInput(row: TaxiPotRow) {
  return {
    startLocation: row.start_location,
    destination: row.destination,
    departureTime: row.departure_time,
    estimatedFare: row.estimated_fare,
    maxRiders: row.max_riders,
    description: row.description,
    tags: row.tags,
    openChatUrl: row.open_chat_url,
  };
}
