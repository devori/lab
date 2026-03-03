const nowBuilding = [
  'Monorepo product units for faster experimentation',
  'Deployable web surfaces with consistent quality gates',
  'Small, production-ready workflows on Vercel'
];

const principles = [
  '실험은 작게, 배포는 빠르게: Learn fast, ship safely.',
  '불필요한 복잡성 제거: Keep dependencies and process minimal.',
  '제품 단위 소유: Clear boundaries per deployable app.'
];

const repositoryStructure = [
  '`apps/` - deployable products (each app is an independent shipping unit)',
  '`packages/` - shared libraries and tooling when reuse becomes real'
];

export default function HomePage() {
  return (
    <main className="page">
      <section className="hero">
        <p className="eyebrow">LAB MONOREPO BASELINE</p>
        <h1>Devori Lab</h1>
        <p className="subtitle">실험하고 만들고 배포하는 제품 연구소</p>
        <p className="subtitle-en">Experiment. Build. Deploy.</p>
      </section>

      <section className="card">
        <h2>Mission</h2>
        <p>
          Devori Lab은 작고 검증 가능한 단위로 아이디어를 실험하고, 실제 사용 가능한 제품으로
          구현한 뒤, 빠르게 배포해 학습을 축적합니다.
        </p>
      </section>

      <section className="grid">
        <article className="card">
          <h2>Now Building</h2>
          <ul>
            {nowBuilding.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>

        <article className="card">
          <h2>Principles</h2>
          <ul>
            {principles.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>

        <article className="card">
          <h2>Repository Structure</h2>
          <ul>
            {repositoryStructure.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <pre>
{`lab/
├─ apps/
│  └─ lab-web/
└─ packages/`}
          </pre>
        </article>
      </section>
    </main>
  );
}
