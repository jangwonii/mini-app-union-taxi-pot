export type PotStatus = 'open' | 'closed';
export type JoinRequestStatus = 'pending' | 'accepted' | 'rejected' | 'canceled';
export type TimeFilter = 'all' | 'now' | 'today' | 'tomorrow';

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
  estimatedCurrentShare: number;
  estimatedFullShare: number;
  myJoinRequest?: JoinRequest | null;
  joinRequests?: JoinRequest[];
  createdAt: string;
  updatedAt: string;
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
