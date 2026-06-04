export interface TaxiPotInput {
  startLocation: string;
  destination: string;
  departureTime: string;
  estimatedFare: number;
  maxRiders: number;
  description: string;
  tags: string[];
  openChatUrl: string;
}

export function parseTaxiPotInput(body: Record<string, unknown>): { value?: TaxiPotInput; error?: string } {
  const startLocation = asTrimmedString(body.startLocation);
  const destination = asTrimmedString(body.destination);
  const departureTime = asTrimmedString(body.departureTime);
  const description = asTrimmedString(body.description);
  const openChatUrl = asTrimmedString(body.openChatUrl);
  const estimatedFare = Number(body.estimatedFare);
  const maxRiders = Number(body.maxRiders);
  const tags = Array.isArray(body.tags)
    ? body.tags.map((tag) => String(tag).trim()).filter(Boolean).slice(0, 8)
    : [];

  if (!startLocation || startLocation.length < 2 || startLocation.length > 120) {
    return { error: '출발지는 2~120자로 입력해주세요.' };
  }
  if (!destination || destination.length < 2 || destination.length > 120) {
    return { error: '도착지는 2~120자로 입력해주세요.' };
  }
  if (!departureTime || Number.isNaN(Date.parse(departureTime))) {
    return { error: '출발 예정 시각이 올바르지 않습니다.' };
  }
  if (!Number.isInteger(estimatedFare) || estimatedFare < 1000 || estimatedFare > 300000) {
    return { error: '예상 택시비는 1,000~300,000원으로 입력해주세요.' };
  }
  if (!Number.isInteger(maxRiders) || maxRiders < 2 || maxRiders > 6) {
    return { error: '총 탑승 인원은 2~6명으로 입력해주세요.' };
  }
  if (!description || description.length < 10 || description.length > 1200) {
    return { error: '설명은 10~1200자로 입력해주세요.' };
  }
  if (!openChatUrl || !/^https?:\/\//.test(openChatUrl)) {
    return { error: '오픈채팅 링크는 http 또는 https URL이어야 합니다.' };
  }

  return {
    value: {
      startLocation,
      destination,
      departureTime,
      estimatedFare,
      maxRiders,
      description,
      tags,
      openChatUrl,
    },
  };
}

export function parseJoinMessage(body: Record<string, unknown>): { value?: string; error?: string } {
  const message = asTrimmedString(body.message);
  if (!message || message.length < 2 || message.length > 500) {
    return { error: '신청 메시지는 2~500자로 입력해주세요.' };
  }
  return { value: message };
}

function asTrimmedString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}
