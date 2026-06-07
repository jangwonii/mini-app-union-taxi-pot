import type { JoinRequestRow, TaxiNotificationRow, TaxiPotRow } from './supabase.js';

export interface JoinRequestDto {
  id: string;
  potId: string;
  requesterUserId: string;
  requesterNickname: string;
  message: string;
  status: JoinRequestRow['status'];
  createdAt: string;
  updatedAt: string;
}

export interface TaxiPotDto {
  id: string;
  startLocation: string;
  destination: string;
  departureTime: string;
  estimatedFare: number;
  maxRiders: number;
  description: string;
  tags: string[];
  openChatUrl?: string;
  ownerUserId: string;
  ownerNickname: string;
  status: TaxiPotRow['status'];
  acceptedCount: number;
  pendingCount: number;
  currentRiders: number;
  soloFare: number;
  estimatedCurrentShare: number;
  estimatedFullShare: number;
  currentSavings: number;
  fullSavings: number;
  additionalSavingsToFull: number;
  isLeavingSoon: boolean;
  myJoinRequest?: JoinRequestDto | null;
  joinRequests?: JoinRequestDto[];
  createdAt: string;
  updatedAt: string;
}

export interface TaxiNotificationDto {
  id: string;
  userId: string;
  potId: string | null;
  joinRequestId: string | null;
  type: TaxiNotificationRow['type'];
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

export function mapJoinRequest(row: JoinRequestRow): JoinRequestDto {
  return {
    id: row.id,
    potId: row.pot_id,
    requesterUserId: row.requester_user_id,
    requesterNickname: row.requester_nickname,
    message: row.message,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapTaxiPot(
  row: TaxiPotRow,
  options: {
    acceptedCount?: number;
    pendingCount?: number;
    includeOpenChatUrl?: boolean;
    myJoinRequest?: JoinRequestRow | null;
    joinRequests?: JoinRequestRow[];
  } = {},
): TaxiPotDto {
  const acceptedCount = options.acceptedCount ?? 0;
  const pendingCount = options.pendingCount ?? 0;
  const currentRiders = Math.min(row.max_riders, acceptedCount + 1);
  const soloFare = row.estimated_fare;
  const estimatedCurrentShare = share(row.estimated_fare, currentRiders);
  const estimatedFullShare = share(row.estimated_fare, row.max_riders);
  const minutesUntilDeparture = (new Date(row.departure_time).getTime() - Date.now()) / 60000;

  return {
    id: row.id,
    startLocation: row.start_location,
    destination: row.destination,
    departureTime: row.departure_time,
    estimatedFare: row.estimated_fare,
    maxRiders: row.max_riders,
    description: row.description,
    tags: row.tags ?? [],
    openChatUrl: options.includeOpenChatUrl ? row.open_chat_url : undefined,
    ownerUserId: row.owner_user_id,
    ownerNickname: row.owner_nickname,
    status: row.status,
    acceptedCount,
    pendingCount,
    currentRiders,
    soloFare,
    estimatedCurrentShare,
    estimatedFullShare,
    currentSavings: Math.max(0, soloFare - estimatedCurrentShare),
    fullSavings: Math.max(0, soloFare - estimatedFullShare),
    additionalSavingsToFull: Math.max(0, estimatedCurrentShare - estimatedFullShare),
    isLeavingSoon: row.status === 'open' && minutesUntilDeparture >= 0 && minutesUntilDeparture <= 30,
    myJoinRequest: options.myJoinRequest ? mapJoinRequest(options.myJoinRequest) : null,
    joinRequests: options.joinRequests?.map(mapJoinRequest),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapTaxiNotification(row: TaxiNotificationRow): TaxiNotificationDto {
  return {
    id: row.id,
    userId: row.user_id,
    potId: row.pot_id,
    joinRequestId: row.join_request_id,
    type: row.type,
    title: row.title,
    message: row.message,
    isRead: row.is_read,
    createdAt: row.created_at,
  };
}

function share(fare: number, riders: number) {
  return Math.ceil(fare / Math.max(1, riders));
}
