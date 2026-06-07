export type PotStatus = 'open' | 'closed';
export type JoinRequestStatus = 'pending' | 'accepted' | 'rejected' | 'canceled';
export type TimeFilter = 'all' | 'now' | 'today' | 'tomorrow';
export type SortMode = 'departure' | 'savings' | 'seats';
export type NotificationType = 'join_requested' | 'join_accepted' | 'join_rejected' | 'join_canceled' | 'pot_closed';

export interface UserProfile {
  userId: string;
  nickname: string;
  profileImage?: string;
  university?: string;
  email?: string;
}

export interface JoinRequest {
  id: string;
  potId: string;
  requesterUserId: string;
  requesterNickname: string;
  message: string;
  status: JoinRequestStatus;
  createdAt: string;
  updatedAt: string;
}

export interface TaxiPot {
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
  status: PotStatus;
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
  myJoinRequest?: JoinRequest | null;
  joinRequests?: JoinRequest[];
  createdAt: string;
  updatedAt: string;
}

export interface TaxiNotification {
  id: string;
  userId: string;
  potId: string | null;
  joinRequestId: string | null;
  type: NotificationType;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

export interface TaxiPotFormValues {
  startLocation: string;
  destination: string;
  departureTime: string;
  estimatedFare: number;
  maxRiders: number;
  description: string;
  tags: string;
  openChatUrl: string;
}
