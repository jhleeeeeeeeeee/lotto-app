const fs = require('fs');
const path = require('path');

async function fetchRound(round) {
  const url = `https://www.dhlottery.co.kr/common.do?method=getLottoNumber&drwNo=${round}`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Referer': 'https://www.dhlottery.co.kr/',
    }
  });
  return res.json();
}

async function findLatest() {
  const start = new Date('2002-12-07');
  const now = new Date();
  const estimated = Math.floor((now - start) / (7 * 24 * 60 * 60 * 1000));
  let lo = estimated - 3, hi = estimated + 2;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    try {
      const d = await fetchRound(mid);
      if (d.returnValue === 'success') lo = mid; else hi = mid - 1;
    } catch { hi = mid - 1; }
  }
  return lo;
}

async function main() {
  console.log('로또 데이터 수집 시작...');

  // 기존 데이터 불러오기
  const dataPath = path.join(__dirname, '../data/lotto.json');
  let existing = { latest: 0, rounds: {} };
  if (fs.existsSync(dataPath)) {
    existing = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
  }

  // 최신 회차 탐색
  const latest = await findLatest();
  console.log(`최신 회차: ${latest}`);

  // 없는 회차만 수집 (최근 200회)
  const startRound = Math.max(1, latest - 199);
  const toFetch = [];
  for (let i = startRound; i <= latest; i++) {
    if (!existing.rounds[i]) toFetch.push(i);
  }
  console.log(`수집할 회차: ${toFetch.length}개`);

  // 5개씩 병렬 수집
  for (let i = 0; i < toFetch.length; i += 5) {
    const batch = toFetch.slice(i, i + 5);
    const results = await Promise.all(batch.map(r => fetchRound(r).catch(() => null)));
    results.forEach((d, idx) => {
      if (d && d.returnValue === 'success') {
        existing.rounds[batch[idx]] = {
          drwNo: d.drwNo,
          drwNoDate: d.drwNoDate,
          nums: [d.drwtNo1, d.drwtNo2, d.drwtNo3, d.drwtNo4, d.drwtNo5, d.drwtNo6],
          bonus: d.bnusNo
        };
        console.log(`  ✓ ${batch[idx]}회차`);
      }
    });
    // 요청 간격 조절
    if (i + 5 < toFetch.length) await new Promise(r => setTimeout(r, 500));
  }

  existing.latest = latest;
  existing.updatedAt = new Date().toISOString();

  // 오래된 데이터 정리 (200회차 이전 삭제)
  Object.keys(existing.rounds).forEach(k => {
    if (+k < startRound) delete existing.rounds[+k];
  });

  fs.writeFileSync(dataPath, JSON.stringify(existing, null, 2));
  console.log(`완료! 총 ${Object.keys(existing.rounds).length}회차 저장됨`);
}

main().catch(e => { console.error(e); process.exit(1); });
