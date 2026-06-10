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
  const text = await res.text();
  return JSON.parse(text);
}

async function findLatest() {
  const start = new Date('2002-12-07');
  const now = new Date();
  const estimated = Math.floor((now - start) / (7 * 24 * 60 * 60 * 1000));
  let lo = estimated - 5, hi = estimated + 2;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    try {
      const d = await fetchRound(mid);
      if (d && d.returnValue === 'success') lo = mid; else hi = mid - 1;
    } catch { hi = mid - 1; }
  }
  return lo;
}

async function main() {
  console.log('로또 데이터 수집 시작...');

  const dataPath = path.join(__dirname, '../data/lotto.json');
  let existing = { latest: 0, rounds: {} };
  if (fs.existsSync(dataPath)) {
    try {
      existing = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
      if (!existing.rounds) existing.rounds = {};
    } catch(e) {
      existing = { latest: 0, rounds: {} };
    }
  }

  const latest = await findLatest();
  console.log(`최신 회차: ${latest}`);

  const startRound = Math.max(1, latest - 199);
  const toFetch = [];
  for (let i = startRound; i <= latest; i++) {
    if (!existing.rounds[String(i)]) toFetch.push(i);
  }
  console.log(`수집할 회차: ${toFetch.length}개`);

  for (let i = 0; i < toFetch.length; i += 3) {
    const batch = toFetch.slice(i, i + 3);
    await Promise.all(batch.map(async r => {
      try {
        const d = await fetchRound(r);
        if (d && d.returnValue === 'success') {
          existing.rounds[String(r)] = {
            drwNo: d.drwNo,
            drwNoDate: d.drwNoDate,
            nums: [d.drwtNo1, d.drwtNo2, d.drwtNo3, d.drwtNo4, d.drwtNo5, d.drwtNo6],
            bonus: d.bnusNo
          };
          console.log(`  ✓ ${r}회차 (${d.drwNoDate})`);
        }
      } catch(e) {
        console.log(`  ✗ ${r}회차 실패: ${e.message}`);
      }
    }));
    await new Promise(r => setTimeout(r, 300));
  }

  existing.latest = latest;
  existing.updatedAt = new Date().toISOString();

  // 200회차 이전 삭제
  Object.keys(existing.rounds).forEach(k => {
    if (+k < startRound) delete existing.rounds[k];
  });

  fs.writeFileSync(dataPath, JSON.stringify(existing, null, 2));
  const count = Object.keys(existing.rounds).length;
  console.log(`완료! 총 ${count}회차 저장됨`);
  
  if (count === 0) {
    console.error('데이터가 하나도 수집되지 않았습니다!');
    process.exit(1);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
