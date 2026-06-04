import { FormEvent, useEffect, useMemo, useState } from 'react';
import Union from '@union-miniapp/sdk';
import {
  closePot,
  createPot,
  getMyPots,
  getPot,
  listPots,
  requestToJoinPot,
  updateJoinRequest,
} from './api';
import type { JoinRequest, JoinRequestStatus, TaxiPot, TaxiPotFormValues, TimeFilter, UserProfile } from './types';

type Tab = 'home' | 'create' | 'mine';

const recommendedTags = ['공항', '터미널', '기숙사', '야간', '등교', '하교', '역'];

const statusLabels: Record<JoinRequestStatus, string> = {
  pending: '대기',
  accepted: '승인',
  rejected: '거절',
  canceled: '취소',
};

const timeFilters: { value: TimeFilter; label: string }[] = [
  { value: 'all', label: '전체' },
  { value: 'now', label: '2시간 이내' },
  { value: 'today', label: '오늘' },
  { value: 'tomorrow', label: '내일' },
];

function createDefaultForm(): TaxiPotFormValues {
  const departure = new Date(Date.now() + 60 * 60 * 1000);
  departure.setMinutes(0, 0, 0);

  return {
    startLocation: '',
    destination: '',
    departureTime: toDateTimeInputValue(departure),
    estimatedFare: 18000,
    maxRiders: 4,
    description: '',
    tags: '',
    openChatUrl: '',
  };
}

function App() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [tab, setTab] = useState<Tab>('home');
  const [pots, setPots] = useState<TaxiPot[]>([]);
  const [selectedPot, setSelectedPot] = useState<TaxiPot | null>(null);
  const [ownedPots, setOwnedPots] = useState<TaxiPot[]>([]);
  const [myJoinRequests, setMyJoinRequests] = useState<{ joinRequest: JoinRequest; pot: TaxiPot | null }[]>([]);
  const [query, setQuery] = useState('');
  const [activeTag, setActiveTag] = useState('');
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('all');
  const [joinMessage, setJoinMessage] = useState('');
  const [form, setForm] = useState<TaxiPotFormValues>(() => createDefaultForm());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    Union.ui.setNavigationBar({ title: '택시팟', backgroundColor: '#ffffff', textColor: '#111827' });
    Union.analytics.trackPageView('taxi_pot_home');
    bootstrap();
  }, []);

  useEffect(() => {
    if (!user) return;
    loadPots();
  }, [user, activeTag, timeFilter]);

  const selectedSlots = useMemo(() => {
    if (!selectedPot) return '';
    return `${selectedPot.currentRiders}/${selectedPot.maxRiders}`;
  }, [selectedPot]);

  async function bootstrap() {
    setLoading(true);
    try {
      const profile = (await Union.auth.getUserProfile()) as UserProfile;
      setUser(profile);
      const savedFilter = await Union.storage.get<{ query?: string; tag?: string; time?: TimeFilter }>('taxi_pot_filters');
      if (savedFilter?.query) setQuery(savedFilter.query);
      if (savedFilter?.tag) setActiveTag(savedFilter.tag);
      if (savedFilter?.time) setTimeFilter(savedFilter.time);
    } catch (err) {
      showError(err);
    } finally {
      setLoading(false);
    }
  }

  async function loadPots(nextQuery = query) {
    if (!user) return;
    setError('');
    try {
      const data = await listPots(user, { q: nextQuery, tag: activeTag, time: timeFilter });
      setPots(data);
      await Union.storage.set('taxi_pot_filters', { query: nextQuery, tag: activeTag, time: timeFilter });
    } catch (err) {
      showError(err);
    }
  }

  async function loadMine() {
    if (!user) return;
    setTab('mine');
    Union.analytics.trackPageView('taxi_pot_mine');
    try {
      const data = await getMyPots(user);
      setOwnedPots(data.ownedPots);
      setMyJoinRequests(data.joinRequests);
    } catch (err) {
      showError(err);
    }
  }

  async function openPot(id: string) {
    if (!user) return;
    try {
      const pot = await getPot(user, id);
      setSelectedPot(pot);
      setJoinMessage('');
      Union.analytics.trackEvent('taxi_pot_detail_opened', { potId: id });
    } catch (err) {
      showError(err);
    }
  }

  async function handleSearch(event: FormEvent) {
    event.preventDefault();
    await loadPots(query);
  }

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    if (!user) return;
    try {
      Union.ui.showLoading('택시팟을 만들고 있어요');
      const pot = await createPot(user, form);
      Union.analytics.trackEvent('taxi_pot_created', { potId: pot.id, maxRiders: pot.maxRiders });
      Union.ui.showToast({ message: '택시팟을 만들었습니다.' });
      setForm(createDefaultForm());
      setTab('home');
      await loadPots();
      await openPot(pot.id);
    } catch (err) {
      showError(err);
    } finally {
      Union.ui.hideLoading();
    }
  }

  async function handleJoin() {
    if (!user || !selectedPot) return;
    try {
      Union.ui.showLoading('참여 신청을 보내고 있어요');
      await requestToJoinPot(user, selectedPot.id, joinMessage);
      Union.analytics.trackEvent('taxi_pot_join_requested', { potId: selectedPot.id });
      Union.ui.showToast({ message: '참여 신청을 보냈습니다.' });
      await openPot(selectedPot.id);
      await loadPots();
    } catch (err) {
      showError(err);
    } finally {
      Union.ui.hideLoading();
    }
  }

  async function handleJoinRequest(joinRequestId: string, status: JoinRequestStatus) {
    if (!user || !selectedPot) return;
    const label = status === 'accepted' ? '승인' : status === 'rejected' ? '거절' : '취소';
    const { confirmed } = await Union.ui.showModal({
      title: `신청 ${label}`,
      content: `이 참여 신청을 ${label}할까요?`,
      confirmText: label,
      cancelText: '닫기',
    });
    if (!confirmed) return;

    try {
      await updateJoinRequest(user, joinRequestId, status);
      Union.analytics.trackEvent('taxi_pot_join_status_changed', { status });
      Union.ui.showToast({ message: `신청을 ${label}했습니다.` });
      await openPot(selectedPot.id);
      if (tab === 'mine') await loadMine();
      await loadPots();
    } catch (err) {
      showError(err);
    }
  }

  async function handleClosePot(pot: TaxiPot) {
    if (!user) return;
    const { confirmed } = await Union.ui.showModal({
      title: '택시팟 마감',
      content: '이 택시팟을 마감할까요?',
      confirmText: '마감',
      cancelText: '취소',
    });
    if (!confirmed) return;

    try {
      await closePot(user, pot.id);
      Union.ui.showToast({ message: '택시팟을 마감했습니다.' });
      await loadMine();
      await loadPots();
      if (selectedPot?.id === pot.id) await openPot(pot.id);
    } catch (err) {
      showError(err);
    }
  }

  function showError(err: unknown) {
    const message = formatErrorMessage(err);
    setError(message);
    Union.ui.showToast({ message, duration: 'long' });
  }

  if (loading) {
    return (
      <main className="screen center">
        <div className="taxi-loader" aria-hidden="true">🚕</div>
        <div className="loader" />
        <p>택시팟을 준비하고 있어요</p>
      </main>
    );
  }

  return (
    <main className="screen">
      <header className="hero">
        <div>
          <p className="eyebrow">{user?.university || 'Union Campus'}</p>
          <div className="title-row">
            <h1>택시팟</h1>
            <span className="hero-mark" aria-hidden="true">🚕</span>
          </div>
          <p className="hero-copy">같은 방향으로 가는 사람들과 택시비를 나눠 부담하세요.</p>
        </div>
        <div className="profile-chip">{user?.nickname ?? 'Guest'}</div>
      </header>

      {error && (
        <button className="error-banner" onClick={() => setError('')}>
          {error}
        </button>
      )}

      <nav className="tabs" aria-label="택시팟 메뉴">
        <button className={tab === 'home' ? 'active' : ''} onClick={() => setTab('home')}>탐색</button>
        <button className={tab === 'create' ? 'active' : ''} onClick={() => setTab('create')}>팟 만들기</button>
        <button className={tab === 'mine' ? 'active' : ''} onClick={loadMine}>내 택시팟</button>
      </nav>

      {tab === 'home' && (
        <section className="stack">
          <form className="search-row" onSubmit={handleSearch}>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="출발지, 도착지, 태그 검색"
            />
            <button type="submit"><span aria-hidden="true">🔎</span> 검색</button>
          </form>
          <div className="segmented" aria-label="출발 시간 필터">
            {timeFilters.map((filter) => (
              <button
                key={filter.value}
                className={timeFilter === filter.value ? 'selected' : ''}
                onClick={() => setTimeFilter(filter.value)}
              >
                {filter.label}
              </button>
            ))}
          </div>
          <div className="tag-row">
            <button className={!activeTag ? 'selected' : ''} onClick={() => setActiveTag('')}>전체</button>
            {recommendedTags.map((tag) => (
              <button key={tag} className={activeTag === tag ? 'selected' : ''} onClick={() => setActiveTag(tag)}>
                {tag}
              </button>
            ))}
          </div>
          {pots.length === 0 ? (
            <EmptyState title="열린 택시팟이 없어요" body="조건을 바꾸거나 첫 택시팟을 만들어보세요." />
          ) : (
            <div className="pot-list">
              {pots.map((pot) => (
                <PotCard key={pot.id} pot={pot} onClick={() => openPot(pot.id)} />
              ))}
            </div>
          )}
        </section>
      )}

      {tab === 'create' && (
        <section className="panel">
          <div className="panel-title">
            <span aria-hidden="true">🚕</span>
            <h2>택시팟 만들기</h2>
          </div>
          <form className="form" onSubmit={handleCreate}>
            <div className="form-grid">
              <label>
                출발지
                <input
                  value={form.startLocation}
                  onChange={(event) => setForm({ ...form, startLocation: event.target.value })}
                  placeholder="죽전역 1번 출구"
                  required
                />
              </label>
              <label>
                도착지
                <input
                  value={form.destination}
                  onChange={(event) => setForm({ ...form, destination: event.target.value })}
                  placeholder="단국대 정문"
                  required
                />
              </label>
            </div>
            <div className="form-grid">
              <label>
                출발 시각
                <input
                  type="datetime-local"
                  value={form.departureTime}
                  onChange={(event) => setForm({ ...form, departureTime: event.target.value })}
                  required
                />
              </label>
              <label>
                총 탑승 인원
                <select
                  value={form.maxRiders}
                  onChange={(event) => setForm({ ...form, maxRiders: Number(event.target.value) })}
                >
                  {[2, 3, 4, 5, 6].map((count) => (
                    <option key={count} value={count}>{count}명</option>
                  ))}
                </select>
              </label>
            </div>
            <label>
              예상 택시비
              <input
                type="number"
                min={1000}
                max={300000}
                step={500}
                value={form.estimatedFare}
                onChange={(event) => setForm({ ...form, estimatedFare: Number(event.target.value) })}
                required
              />
            </label>
            <label>
              설명
              <textarea
                value={form.description}
                onChange={(event) => setForm({ ...form, description: event.target.value })}
                placeholder="출발 위치, 기다릴 수 있는 시간, 짐 여부 등을 적어주세요."
                required
              />
            </label>
            <label>
              태그
              <input
                value={form.tags}
                onChange={(event) => setForm({ ...form, tags: event.target.value })}
                placeholder="공항, 야간, 기숙사"
              />
            </label>
            <label>
              오픈채팅 링크
              <input
                value={form.openChatUrl}
                onChange={(event) => setForm({ ...form, openChatUrl: event.target.value })}
                placeholder="https://open.kakao.com/..."
                required
              />
            </label>
            <div className="fare-preview">
              <span><span aria-hidden="true">💸</span> 만석 기준 1인 예상</span>
              <strong>{formatMoney(Math.ceil(form.estimatedFare / form.maxRiders))}</strong>
            </div>
            <button className="primary-button" type="submit"><span aria-hidden="true">🚕</span> 택시팟 등록</button>
          </form>
        </section>
      )}

      {tab === 'mine' && (
        <section className="stack">
          <div className="section-header">
            <h2>내가 만든 택시팟</h2>
            <button className="ghost-button small" onClick={loadMine}>새로고침</button>
          </div>
          {ownedPots.length === 0 ? (
            <EmptyState title="만든 택시팟이 없어요" body="이동 일정이 생기면 새 팟을 열어보세요." />
          ) : (
            <div className="pot-list">
              {ownedPots.map((pot) => (
                <MineCard key={pot.id} pot={pot} onOpen={() => openPot(pot.id)} onClose={() => handleClosePot(pot)} />
              ))}
            </div>
          )}
          <div className="section-header with-space">
            <h2>내 참여 신청</h2>
          </div>
          {myJoinRequests.length === 0 ? (
            <EmptyState title="보낸 신청이 없어요" body="탐색에서 같이 탈 택시팟을 찾아보세요." />
          ) : (
            <div className="pot-list">
              {myJoinRequests.map(({ joinRequest, pot }) => (
                <RequestSummary key={joinRequest.id} joinRequest={joinRequest} pot={pot} onOpen={() => pot && openPot(pot.id)} />
              ))}
            </div>
          )}
        </section>
      )}

      {selectedPot && (
        <PotDetail
          pot={selectedPot}
          userId={user?.userId ?? ''}
          selectedSlots={selectedSlots}
          joinMessage={joinMessage}
          setJoinMessage={setJoinMessage}
          onJoin={handleJoin}
          onJoinRequest={handleJoinRequest}
          onClose={() => setSelectedPot(null)}
        />
      )}
    </main>
  );
}

function PotCard({ pot, onClick }: { pot: TaxiPot; onClick: () => void }) {
  return (
    <button className="pot-card" onClick={onClick}>
      <div className="card-top">
        <span><span aria-hidden="true">🚕</span> {formatDateTime(pot.departureTime)}</span>
        <StatusPill status={pot.status} />
      </div>
      <RouteTitle start={pot.startLocation} destination={pot.destination} />
      <p>{pot.description}</p>
      <div className="meta-row">
        <span>{pot.currentRiders}/{pot.maxRiders}명</span>
        <span>현재 {formatMoney(pot.estimatedCurrentShare)}</span>
        <span>만석 {formatMoney(pot.estimatedFullShare)}</span>
      </div>
      <Tags tags={pot.tags} />
    </button>
  );
}

function PotDetail({
  pot,
  userId,
  selectedSlots,
  joinMessage,
  setJoinMessage,
  onJoin,
  onJoinRequest,
  onClose,
}: {
  pot: TaxiPot;
  userId: string;
  selectedSlots: string;
  joinMessage: string;
  setJoinMessage: (message: string) => void;
  onJoin: () => void;
  onJoinRequest: (joinRequestId: string, status: JoinRequestStatus) => void;
  onClose: () => void;
}) {
  const isOwner = pot.ownerUserId === userId;
  const isFull = pot.currentRiders >= pot.maxRiders;
  const canRequest = !isOwner && pot.status === 'open' && !pot.myJoinRequest && !isFull;
  const canCancel = pot.myJoinRequest?.status === 'pending';

  return (
    <section className="detail-panel" aria-label="택시팟 상세">
      <div className="detail-header">
        <div>
          <p className="eyebrow">{formatDateTime(pot.departureTime)}</p>
          <RouteTitle start={pot.startLocation} destination={pot.destination} />
        </div>
        <button className="icon-button" onClick={onClose} aria-label="닫기">×</button>
      </div>

      <div className="summary-grid">
        <Metric label="탑승" value={selectedSlots} icon="👥" />
        <Metric label="현재 1인" value={formatMoney(pot.estimatedCurrentShare)} icon="💸" />
        <Metric label="만석 1인" value={formatMoney(pot.estimatedFullShare)} icon="🚕" />
      </div>

      <p className="detail-copy">{pot.description}</p>
      <Tags tags={pot.tags} />

      {pot.openChatUrl && (
        <a className="open-chat" href={pot.openChatUrl} target="_blank" rel="noreferrer">
          <span aria-hidden="true">💬</span> 오픈채팅 열기
        </a>
      )}

      {!pot.openChatUrl && !isOwner && pot.myJoinRequest?.status !== 'accepted' && (
        <p className="notice">오픈채팅 링크는 방장이 신청을 승인하면 공개됩니다.</p>
      )}

      {pot.myJoinRequest && !isOwner && (
        <div className="request-state">
          <span>내 신청 상태</span>
          <strong>{statusLabels[pot.myJoinRequest.status]}</strong>
        </div>
      )}

      {canRequest && (
        <div className="form compact-form">
          <label>
            신청 메시지
            <textarea
              value={joinMessage}
              onChange={(event) => setJoinMessage(event.target.value)}
              placeholder="예: 10분 전 도착 가능해요."
            />
          </label>
          <button className="primary-button sticky-action" onClick={onJoin} disabled={joinMessage.trim().length < 2}>
            <span aria-hidden="true">🚕</span> 참여 신청
          </button>
        </div>
      )}

      {canCancel && pot.myJoinRequest && (
        <button className="ghost-button full-width" onClick={() => onJoinRequest(pot.myJoinRequest!.id, 'canceled')}>
          신청 취소
        </button>
      )}

      {isOwner && (
        <div className="owner-panel">
          <div className="section-header">
            <h3>참여 신청</h3>
            <span>{pot.pendingCount}건 대기</span>
          </div>
          {pot.joinRequests?.length ? (
            pot.joinRequests.map((joinRequest) => (
              <div className="request-card" key={joinRequest.id}>
                <div>
                  <strong>{joinRequest.requesterNickname}</strong>
                  <p>{joinRequest.message}</p>
                  <span>{statusLabels[joinRequest.status]}</span>
                </div>
                {joinRequest.status === 'pending' && (
                  <div className="action-row">
                    <button className="ghost-button small" onClick={() => onJoinRequest(joinRequest.id, 'rejected')}>거절</button>
                    <button className="primary-button small" onClick={() => onJoinRequest(joinRequest.id, 'accepted')}>승인</button>
                  </div>
                )}
              </div>
            ))
          ) : (
            <EmptyState title="아직 신청이 없어요" body="신청이 오면 여기에서 승인할 수 있습니다." />
          )}
        </div>
      )}
    </section>
  );
}

function MineCard({ pot, onOpen, onClose }: { pot: TaxiPot; onOpen: () => void; onClose: () => void }) {
  return (
    <article className="mine-card">
      <div>
        <div className="card-top">
          <span>{formatDateTime(pot.departureTime)}</span>
          <StatusPill status={pot.status} />
        </div>
        <h3>{pot.startLocation} → {pot.destination}</h3>
        <div className="meta-row">
          <span>{pot.currentRiders}/{pot.maxRiders}명</span>
          <span>{pot.pendingCount}건 대기</span>
        </div>
      </div>
      <div className="action-row">
        <button className="ghost-button small" onClick={onOpen}>상세</button>
        {pot.status === 'open' && <button className="primary-button small" onClick={onClose}>마감</button>}
      </div>
    </article>
  );
}

function RequestSummary({
  joinRequest,
  pot,
  onOpen,
}: {
  joinRequest: JoinRequest;
  pot: TaxiPot | null;
  onOpen: () => void;
}) {
  return (
    <button className="pot-card compact-card" onClick={onOpen} disabled={!pot}>
      <div className="card-top">
        <span>{pot ? formatDateTime(pot.departureTime) : '삭제된 택시팟'}</span>
        <span className="request-badge">{statusLabels[joinRequest.status]}</span>
      </div>
      <h3>{pot ? `${pot.startLocation} → ${pot.destination}` : '택시팟을 찾을 수 없어요'}</h3>
      {pot?.openChatUrl && <span className="link-hint">오픈채팅 공개됨</span>}
    </button>
  );
}

function RouteTitle({ start, destination }: { start: string; destination: string }) {
  return (
    <div className="route-title">
      <div className="route-line">
        <span className="route-dot start" aria-hidden="true">출</span>
        <h3>{start}</h3>
      </div>
      <span className="route-arrow" aria-hidden="true">↓</span>
      <div className="route-line">
        <span className="route-dot end" aria-hidden="true">도</span>
        <h3>{destination}</h3>
      </div>
    </div>
  );
}

function Metric({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <div className="metric">
      <span><span aria-hidden="true">{icon}</span> {label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function StatusPill({ status }: { status: TaxiPot['status'] }) {
  return <span className={`status ${status}`}>{status === 'open' ? '모집중' : '마감'}</span>;
}

function Tags({ tags }: { tags: string[] }) {
  if (!tags.length) return null;
  return (
    <div className="tag-row compact">
      {tags.map((tag) => (
        <span key={tag}>{tag}</span>
      ))}
    </div>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="empty-state">
      <span className="empty-icon" aria-hidden="true">🚕</span>
      <strong>{title}</strong>
      <p>{body}</p>
    </div>
  );
}

function formatMoney(value: number) {
  return `${Math.max(0, value).toLocaleString('ko-KR')}원`;
}

function formatErrorMessage(err: unknown) {
  const message = err instanceof Error ? err.message : '문제가 발생했습니다.';
  if (message.includes("body stream already read") || message.includes("Failed to execute 'text' on 'Response'")) {
    return 'API 서버 연결이 필요합니다. Vercel dev 또는 배포 API 주소를 확인해주세요.';
  }
  return message;
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('ko-KR', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function toDateTimeInputValue(value: Date) {
  const offset = value.getTimezoneOffset();
  const local = new Date(value.getTime() - offset * 60 * 1000);
  return local.toISOString().slice(0, 16);
}

export default App;
