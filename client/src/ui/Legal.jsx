import { useEffect } from 'react';
import { L, pick } from '../i18n.js';
import { DOCS, OPERATOR, docByPath } from '../legal/docs.js';
import { LangToggle } from './LangToggle.jsx';
import { Logo } from './Logo.jsx';

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-');

function Body({ item }) {
  if (item.list) return <ul>{item.list.map((li, i) => <li key={i}>{pick(li)}</li>)}</ul>;
  return <p>{pick(item)}</p>;
}

export default function Legal() {
  const doc = docByPath[location.pathname] || DOCS.terms;
  useEffect(() => {
    document.title = `${pick(doc.title)} · ${OPERATOR.brand}`;
    window.scrollTo(0, 0);
  }, [doc]);
  return (
    <div className="legal-page">
      <header className="legal-head">
        <a href="/" className="legal-logo"><Logo size={18} /></a>
        <LangToggle />
      </header>
      <nav className="legal-tabs">
        {Object.values(DOCS).map((d) => (
          <a key={d.path} href={d.path} className={d === doc ? 'on' : ''}>{pick(d.title)}</a>
        ))}
      </nav>
      <article className="legal">
        <h1>{pick(doc.title)}</h1>
        <div className="legal-meta">{L('Imesasishwa', 'Last updated')}: {pick(OPERATOR.updated)} · {OPERATOR.entity}</div>
        <p className="legal-intro">{pick(doc.intro)}</p>
        <div className="legal-toc">
          <b>{L('Yaliyomo', 'Contents')}</b>
          <ol>
            {doc.sections.map((s) => <li key={s.h[1]}><a href={`#${slug(s.h[1])}`}>{pick(s.h).replace(/^\d+\.\s*/, '')}</a></li>)}
          </ol>
        </div>
        {doc.sections.map((s) => (
          <section key={s.h[1]} id={slug(s.h[1])}>
            <h2>{pick(s.h)}</h2>
            {s.body.map((item, i) => <Body key={i} item={item} />)}
          </section>
        ))}
        <footer className="legal-foot">
          {L('Maswali?', 'Questions?')} <a href={`mailto:${OPERATOR.email}`}>{OPERATOR.email}</a>
          <div style={{ marginTop: 10 }}><a href="/">← {L('Rudi Bongo Life', 'Back to Bongo Life')}</a></div>
        </footer>
      </article>
    </div>
  );
}
