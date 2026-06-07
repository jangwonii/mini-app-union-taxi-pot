import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getBody, getStringParam, requireUser, sendError, sendServerError, setCors } from '../_lib/http.js';
import { mapTaxiPot } from '../_lib/mapper.js';
import { getSupabase, type JoinRequestRow, type TaxiPotRow } from '../_lib/supabase.js';
import { parseTaxiPotInput } from '../_lib/validation.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (setCors(req, res)) return;

  try {
    if (req.method === 'GET') {
      const user = requireUser(req, res);
      if (!user) return;
      const search = getStringParam(req.query.q)?.toLowerCase() ?? '';
      const tag = getStringParam(req.query.tag);
      const time = getStringParam(req.query.time);
      const sort = getStringParam(req.query.sort);
      const supabase = getSupabase();

      let query = supabase
        .from('taxi_pots')
        .select('*')
        .eq('status', 'open')
        .gte('departure_time', new Date().toISOString())
        .order('departure_time', { ascending: true })
        .limit(80);

      if (tag) query = query.contains('tags', [tag]);
      if (time === 'today' || time === 'tomorrow') {
        const { start, end } = dayRange(time);
        query = query.gte('departure_time', start.toISOString()).lt('departure_time', end.toISOString());
      }
      if (time === 'now') {
        const soon = new Date(Date.now() + 2 * 60 * 60 * 1000);
        query = query.lt('departure_time', soon.toISOString());
      }

      const { data: pots, error } = await query;
      if (error) throw error;

      const filteredPots = ((pots ?? []) as TaxiPotRow[]).filter((pot) => {
        if (!search) return true;
        const haystack = [pot.start_location, pot.destination, pot.description, ...pot.tags].join(' ').toLowerCase();
        return haystack.includes(search);
      });

      const potIds = filteredPots.map((pot) => pot.id);
      const { data: joinRequests, error: joinRequestError } = potIds.length
        ? await supabase.from('join_requests').select('*').in('pot_id', potIds)
        : { data: [], error: null };
      if (joinRequestError) throw joinRequestError;

      const joinRequestRows = (joinRequests ?? []) as JoinRequestRow[];
      const response = filteredPots.map((pot) => {
        const potJoinRequests = joinRequestRows.filter((joinRequest) => joinRequest.pot_id === pot.id);
        const acceptedCount = potJoinRequests.filter((joinRequest) => joinRequest.status === 'accepted').length;
        const pendingCount = potJoinRequests.filter((joinRequest) => joinRequest.status === 'pending').length;
        const myJoinRequest = potJoinRequests.find((joinRequest) => joinRequest.requester_user_id === user.userId) ?? null;
        const canSeeOpenChat = pot.owner_user_id === user.userId || myJoinRequest?.status === 'accepted';

        return mapTaxiPot(pot, {
          acceptedCount,
          pendingCount,
          myJoinRequest,
          includeOpenChatUrl: canSeeOpenChat,
        });
      });

      response.sort((a, b) => {
        if (sort === 'savings') return b.fullSavings - a.fullSavings;
        if (sort === 'seats') return (b.maxRiders - b.currentRiders) - (a.maxRiders - a.currentRiders);
        return new Date(a.departureTime).getTime() - new Date(b.departureTime).getTime();
      });

      res.status(200).json({ pots: response });
      return;
    }

    if (req.method === 'POST') {
      const user = requireUser(req, res);
      if (!user) return;

      const parsed = parseTaxiPotInput(getBody(req));
      if (!parsed.value) {
        sendError(res, 400, parsed.error ?? '입력값이 올바르지 않습니다.');
        return;
      }

      const supabase = getSupabase();
      const { data, error } = await supabase
        .from('taxi_pots')
        .insert({
          start_location: parsed.value.startLocation,
          destination: parsed.value.destination,
          departure_time: parsed.value.departureTime,
          estimated_fare: parsed.value.estimatedFare,
          max_riders: parsed.value.maxRiders,
          description: parsed.value.description,
          tags: parsed.value.tags,
          open_chat_url: parsed.value.openChatUrl,
          owner_user_id: user.userId,
          owner_nickname: user.nickname,
        })
        .select('*')
        .single();

      if (error) throw error;

      res.status(201).json({ pot: mapTaxiPot(data as TaxiPotRow, { includeOpenChatUrl: true }) });
      return;
    }

    sendError(res, 405, '지원하지 않는 메서드입니다.');
  } catch (error) {
    sendServerError(res, error);
  }
}

function dayRange(filter: 'today' | 'tomorrow') {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  if (filter === 'tomorrow') start.setDate(start.getDate() + 1);

  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}
