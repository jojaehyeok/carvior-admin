// 차량 옵션 목록.
//
// ⚠ 이 파일은 웹(cavior)의 lib/carOptions.ts와 내용이 같아야 한다.
// 저장이 이름 문자열 배열(store_items.options)이라, 한쪽에서 "열선시트"로 저장했는데
// 다른 쪽이 "열선 시트"로 찾으면 영영 안 맞는다. 저장소가 달라서 공유를 못 하니
// 한쪽을 고치면 반드시 다른 쪽도 같이 고칠 것.
//
// 분류와 표기는 엔카 기준이다.

export interface OptionGroup {
  key: string;
  label: string;
  options: string[];
}

export const CAR_OPTION_GROUPS: OptionGroup[] = [
  {
    key: 'exterior',
    label: '외관/내장',
    options: [
      '선루프', '헤드램프', '파워 전동 트렁크', '고스트 도어 클로징',
      '전동접이 사이드 미러', '알루미늄 휠', '루프랙', '열선 스티어링 휠',
      '전동 조절 스티어링 휠', '패들 시프트', '스티어링 휠 리모컨', 'ECM 룸미러',
      '하이패스', '파워 도어록', '파워 스티어링 휠', '파워 윈도우',
    ],
  },
  {
    key: 'safety',
    label: '안전',
    options: [
      '에어백', '에어백(사이드)', '에어백(커튼)', '브레이크 잠김 방지(ABS)',
      '미끄럼 방지(TCS)', '차체자세 제어장치(ESC)', '타이어 공기압센서(TPMS)',
      '차선이탈 경보 시스템(LDWS)', '전자제어 서스펜션(ECS)', '주차감지센서',
      '후측방 경보 시스템', '후방 카메라', '360도 어라운드 뷰',
    ],
  },
  {
    key: 'convenience',
    label: '편의/멀티미디어',
    options: [
      '크루즈 컨트롤', '헤드업 디스플레이(HUD)', '전자식 주차브레이크(EPB)', '자동 에어컨',
      '스마트키', '무선도어 잠금장치', '레인센서', '오토 라이트',
      '커튼/블라인드', '내비게이션', '앞좌석 AV 모니터', '뒷좌석 AV 모니터',
      '블루투스', 'CD 플레이어', 'USB 단자', 'AUX 단자',
    ],
  },
  {
    key: 'seat',
    label: '시트',
    options: [
      '가죽시트', '전동시트', '전동시트(뒷좌석)', '열선시트',
      '메모리 시트', '통풍시트', '통풍시트(뒷좌석)', '마사지 시트',
    ],
  },
];

export const ALL_CAR_OPTIONS = CAR_OPTION_GROUPS.flatMap(g => g.options);
