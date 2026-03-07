import Link from 'next/link';

export default function LabHomePage() {
  return (
    <main className="lab-home-page">
      <section className="lab-home-hero">
        <p className="eyebrow">DEVORI LAB</p>
        <h1>데보리 랩 메인</h1>
        <p className="subcopy">
          한국어 우선으로 빠르게 만들고 배포하는 제품 실험실입니다. 아래에서 현재 공개된 제품을 확인하세요.
        </p>
        <p className="live-status">현재 상태: 라이브 운영 중</p>
      </section>

      <section className="product-grid" aria-label="제품 목록">
        <article className="product-card">
          <h2>가계부</h2>
          <p>수입/지출 기록, 월별 예산, 카테고리 요약을 제공하는 household ledger 제품입니다.</p>
          <Link href="/household-ledger" className="product-link">
            가계부 열기
          </Link>
        </article>

        <article className="product-card">
          <h2>WMS</h2>
          <p>SKU/로케이션/재고이동(IN·OUT·ADJUST)/현재고/이동로그를 제공하는 WMS P0 프로토타입입니다.</p>
          <Link href="/wms" className="product-link">
            WMS 열기
          </Link>
        </article>
      </section>
    </main>
  );
}
