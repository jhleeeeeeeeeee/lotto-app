export const config = { runtime: 'edge', regions: ['icn1'] };

export default async function handler(req) {
  const { searchParams } = new URL(req.url);
  const drwNo = searchParams.get('drwNo');

  if (!drwNo) {
    return new Response(JSON.stringify({ error: 'drwNo is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }

  try {
    const response = await fetch(
      `https://www.dhlottery.co.kr/common.do?method=getLottoNumber&drwNo=${drwNo}`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Referer': 'https://www.dhlottery.co.kr/',
          'Accept': 'application/json, text/plain, */*',
        }
      }
    );
    const data = await response.json();
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 's-maxage=3600' }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Failed to fetch', message: e.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }
}
