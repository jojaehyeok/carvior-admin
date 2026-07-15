import { useEffect, useRef } from "react";

const API = process.env.NEXT_PUBLIC_API_ENDPOINT;
const POLL_MS = 20_000;
// 여기에 mp3를 넣으면(예: public/sounds/new-booking.mp3) TTS 대신 이 파일이 재생됩니다.
const CUSTOM_SOUND_URL = "/admin/sounds/new-booking.mp3";

function speakFallback(text: string) {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  window.speechSynthesis.cancel(); // 기존에 대기 중인 발화 제거 (반복 방지)
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "ko-KR";
  utterance.rate = 1;
  window.speechSynthesis.speak(utterance);
}

function announceOnce(text: string) {
  const audio = new Audio(CUSTOM_SOUND_URL);
  audio.addEventListener("error", () => speakFallback(text), { once: true });
  audio.play().catch(() => speakFallback(text));
}

// 신규 검차신청(PENDING) 발생 시 "카비어 신규 접수 되었습니다"를 1회 음성 안내
const NewBookingAnnouncer = () => {
  const knownIds = useRef<Set<number> | null>(null);
  const unlocked = useRef(false);

  // 브라우저는 사용자 상호작용 없이 발생한 speechSynthesis 호출을 막는 경우가 많음.
  // 페이지에서 첫 클릭/키입력이 들어오면 무음 발화로 엔진을 미리 "깨워둠".
  useEffect(() => {
    const unlock = () => {
      if (unlocked.current || typeof window === "undefined" || !window.speechSynthesis) return;
      unlocked.current = true;
      const warm = new SpeechSynthesisUtterance(" ");
      warm.volume = 0;
      window.speechSynthesis.speak(warm);
      document.removeEventListener("click", unlock);
      document.removeEventListener("keydown", unlock);
    };
    document.addEventListener("click", unlock);
    document.addEventListener("keydown", unlock);
    return () => {
      document.removeEventListener("click", unlock);
      document.removeEventListener("keydown", unlock);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const poll = async () => {
      try {
        const res = await fetch(`${API}/external/request/list`);
        const data = await res.json();
        const all: { id: number; status: string }[] = Array.isArray(data)
          ? data
          : Array.isArray(data?.data)
            ? data.data
            : [];
        const pendingIds = new Set(all.filter((b) => b.status === "PENDING").map((b) => b.id));

        if (cancelled) return;

        if (knownIds.current === null) {
          // 최초 로드: 기존 대기 건은 알리지 않고 기준선만 설정
          knownIds.current = pendingIds;
          return;
        }

        const newOnes = Array.from(pendingIds).filter((id) => !knownIds.current!.has(id));
        knownIds.current = pendingIds;

        if (newOnes.length > 0) {
          announceOnce("카비어 신규 접수 되었습니다");
        }
      } catch {
        // 폴링 실패 시 조용히 무시 (다음 주기에 재시도)
      }
    };

    poll();
    const timer = setInterval(poll, POLL_MS);
    return () => { cancelled = true; clearInterval(timer); };
  }, []);

  return null;
};

export default NewBookingAnnouncer;
