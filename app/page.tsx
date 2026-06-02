'use client';

import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { useState, useEffect } from 'react';

const CLIENTS = ['Gojek', 'Gree', 'BMW', 'Pocari Sweat', 'Nestle', 'BCA', 'Jasa Marga', 'Japfa', 'Flip', 'ACE', 'Astro', 'BSD', 'Tebs', 'Fruit Tea', 'Lucxrime', "Wall's"];

const STATS = [
  { num: '270+', label: 'Brand Projects' },
  { num: '127+', label: 'Leading Brands' },
  { num: '77+',  label: 'Ads Directors'  },
  { num: '18%',  label: 'Market Share Record' },
];

const SERVICES = [
  {
    n: '01',
    t: '270+ Projects',
    d: 'Commercial ATL BTL 360 Marketing Activation semuanya sudah pernah kami tangani. Life becomes much easier, kamu tidak perlu khawatir sama hal teknis. Dari 0 sampai ROI.',
  },
  {
    n: '02',
    t: 'Unlimited Storyboard',
    d: 'Opsi cerita dari berbagai sutradara iklan dengan storyboard unlimited. Cukup ceritain objektif dan goals brandmu, maka kita buatkan storyboardnya. Tanpa kontrak, tanpa bayar.',
  },
  {
    n: '03',
    t: 'Data Driven Marketing',
    d: 'Bukan asal kreatif. Kita provide market hingga competitor research. Memastikan setiap kreatif yang keluar adalah ide iklan yang stick di kepala audience dan pastinya convert to sales.',
  },
  {
    n: '04',
    t: '77+ Ads Director',
    d: 'Hanya agency di Indonesia yang memiliki 77+ creative ads directors. Pilihan opsi kreatif brand lebih luas, budget lebih variatif, dan tentunya brand message yang tetap on point.',
  },
];

export default function BithourLanding() {
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    const onScroll = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const scrollTo = (id: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Cormorant+Garamond:ital,wght@0,300;1,300;1,400;1,600&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600;9..40,700&display=swap');

        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        html{scroll-behavior:smooth}
        body{background:#0B0B0B;color:#F2EFE8;font-family:'DM Sans',sans-serif;overflow-x:hidden}

        :root{
          --black:#0B0B0B;
          --off-white:#F2EFE8;
          --warm-white:#F7F5F0;
          --gold:#C9A84C;
          --gold-bright:#E0BC68;
          --border:rgba(242,239,232,0.08);
          --muted:rgba(242,239,232,0.4);
        }

        .bh-nav{
          position:fixed;top:0;left:0;right:0;z-index:100;
          display:flex;align-items:center;justify-content:space-between;
          padding:28px 48px;transition:all .35s ease;
          background:linear-gradient(to bottom,rgba(11,11,11,.7) 0%,transparent 100%);
        }
        .bh-nav.scrolled{
          padding:16px 48px;
          background:rgba(11,11,11,.95);backdrop-filter:blur(16px);
          border-bottom:1px solid var(--border);
        }
        .bh-wordmark{
          font-family:'Bebas Neue',sans-serif;font-size:20px;letter-spacing:.14em;
          color:var(--off-white);display:flex;align-items:center;gap:10px;
          text-decoration:none;background:none;border:none;padding:0;cursor:pointer;
          text-shadow:0 1px 8px rgba(0,0,0,.8),0 0 24px rgba(0,0,0,.5);
        }
        .bh-nav-links{display:flex;align-items:center;gap:36px}
        .bh-nav-a{
          font-size:13px;font-weight:500;color:var(--muted);
          text-decoration:none;letter-spacing:.04em;transition:color .2s;cursor:pointer;
          background:none;border:none;
        }
        .bh-nav-a:hover{color:var(--off-white)}
        .bh-pill{
          display:inline-flex;align-items:center;gap:7px;
          background:var(--gold);color:#000;
          padding:11px 22px;border-radius:3px;
          font-size:12px;font-weight:800;text-decoration:none;
          letter-spacing:.06em;text-transform:uppercase;transition:all .2s;
        }
        .bh-pill:hover{background:var(--gold-bright);transform:translateY(-1px)}
        .bh-ghost{
          display:inline-flex;align-items:center;gap:7px;
          border:1px solid rgba(242,239,232,.18);color:var(--off-white);
          padding:11px 22px;border-radius:3px;
          font-size:12px;font-weight:600;text-decoration:none;
          letter-spacing:.04em;transition:all .2s;cursor:pointer;
          background:none;
        }
        .bh-ghost:hover{border-color:rgba(242,239,232,.4);background:rgba(242,239,232,.04)}

        .bh-hero{
          min-height:100vh;display:flex;flex-direction:column;
          justify-content:flex-end;padding:0 48px 88px;
          position:relative;overflow:hidden;background:var(--black);
        }
        .bh-hero-glow{
          position:absolute;inset:0;pointer-events:none;
          background:
            radial-gradient(ellipse 60% 50% at 75% 30%, rgba(201,168,76,.09) 0%, transparent 70%),
            radial-gradient(ellipse 40% 40% at 20% 70%, rgba(201,168,76,.05) 0%, transparent 60%);
        }
        .bh-grain{
          position:absolute;inset:-50%;width:200%;height:200%;
          opacity:.032;pointer-events:none;z-index:1;
          background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23n)'/%3E%3C/svg%3E");
        }
        .bh-tag{
          position:relative;z-index:2;
          font-size:11px;font-weight:700;letter-spacing:.2em;
          color:var(--gold);text-transform:uppercase;margin-bottom:20px;
          display:flex;align-items:center;gap:14px;
          animation:bh-up .6s .15s both;
        }
        .bh-tag::before{content:'';width:28px;height:1px;background:var(--gold)}
        .bh-h1{
          position:relative;z-index:2;
          font-family:'Bebas Neue',sans-serif;
          font-size:clamp(80px,13vw,200px);
          line-height:.88;letter-spacing:-.01em;color:var(--off-white);
          animation:bh-up .7s .28s both;
        }
        .bh-h1 .gold{color:var(--gold)}
        .bh-sub{
          position:relative;z-index:2;
          font-family:'Cormorant Garamond',serif;font-style:italic;
          font-size:clamp(17px,2.2vw,24px);font-weight:300;
          color:rgba(242,239,232,.5);line-height:1.65;
          max-width:520px;margin-top:26px;
          animation:bh-up .7s .42s both;
        }
        .bh-actions{
          position:relative;z-index:2;
          display:flex;gap:14px;margin-top:40px;flex-wrap:wrap;
          animation:bh-up .7s .56s both;
        }
        .bh-scroll-hint{
          position:absolute;right:48px;bottom:88px;z-index:2;
          display:flex;flex-direction:column;align-items:center;gap:10px;
          color:rgba(242,239,232,.25);font-size:10px;font-weight:600;
          letter-spacing:.18em;text-transform:uppercase;
          animation:bh-fade 1s .9s both;
        }
        .bh-scroll-hint::after{
          content:'';width:1px;height:56px;
          background:linear-gradient(to bottom,rgba(242,239,232,.25),transparent);
        }

        .bh-ticker{overflow:hidden;background:var(--gold);padding:13px 0}
        .bh-ticker-track{
          display:flex;white-space:nowrap;
          animation:bh-ticker 28s linear infinite;
        }
        .bh-ticker-item{
          font-family:'Bebas Neue',sans-serif;font-size:15px;
          letter-spacing:.1em;color:#000;padding:0 28px;flex-shrink:0;
        }

        .bh-stats{background:var(--warm-white);padding:72px 48px 0}
        .bh-stats-grid{
          max-width:1200px;margin:0 auto;
          display:grid;grid-template-columns:repeat(4,1fr);
          border:1px solid rgba(0,0,0,.07);border-radius:2px;overflow:hidden;
        }
        .bh-stat{
          padding:44px 28px;text-align:center;
          border-right:1px solid rgba(0,0,0,.07);
          transition:background .2s;cursor:default;
        }
        .bh-stat:last-child{border-right:none}
        .bh-stat:hover{background:rgba(201,168,76,.06)}
        .bh-stat-n{
          font-family:'Bebas Neue',sans-serif;font-size:58px;
          color:#0B0B0B;line-height:1;letter-spacing:-.02em;
        }
        .bh-stat-l{
          font-size:11px;color:#999;font-weight:700;
          letter-spacing:.1em;text-transform:uppercase;margin-top:6px;
        }

        .bh-clients{background:var(--warm-white);padding:56px 48px 80px}
        .bh-clients-wrap{max-width:1200px;margin:0 auto}
        .bh-clients-label{
          font-size:11px;font-weight:700;letter-spacing:.15em;
          color:#aaa;text-transform:uppercase;
          display:flex;align-items:center;gap:16px;margin-bottom:28px;
        }
        .bh-clients-label::after{content:'';flex:1;height:1px;background:rgba(0,0,0,.07)}
        .bh-names{display:flex;flex-wrap:wrap}
        .bh-name{
          font-family:'Cormorant Garamond',serif;font-size:21px;font-weight:400;
          color:#0B0B0B;padding:4px 18px;
          border-right:1px solid rgba(0,0,0,.08);
          transition:color .2s;cursor:default;
        }
        .bh-name:last-child{border-right:none}
        .bh-name:hover{color:var(--gold)}

        .bh-svc{background:var(--black);padding:96px 48px}
        .bh-svc-inner{max-width:1200px;margin:0 auto}
        .bh-svc-top{
          display:flex;align-items:flex-start;justify-content:space-between;
          gap:40px;margin-bottom:60px;
        }
        .bh-svc-title{
          font-family:'Bebas Neue',sans-serif;
          font-size:clamp(52px,7.5vw,96px);
          color:var(--off-white);line-height:.9;letter-spacing:-.01em;
        }
        .bh-svc-title span{color:var(--gold)}
        .bh-svc-desc{
          font-family:'Cormorant Garamond',serif;font-style:italic;
          font-size:18px;color:var(--muted);line-height:1.7;
          max-width:360px;padding-top:10px;
        }
        .bh-svc-row{
          display:grid;grid-template-columns:64px 1fr 1.1fr;
          gap:0 40px;padding:28px 0;
          border-top:1px solid var(--border);
          transition:border-color .25s;
        }
        .bh-svc-row:hover{border-color:rgba(201,168,76,.25)}
        .bh-svc-n{
          font-family:'Bebas Neue',sans-serif;font-size:13px;
          color:var(--gold);letter-spacing:.1em;padding-top:2px;
        }
        .bh-svc-name{
          font-family:'DM Sans',sans-serif;font-size:17px;font-weight:700;
          color:var(--off-white);letter-spacing:-.01em;
        }
        .bh-svc-d{
          font-size:14px;font-weight:400;
          color:var(--muted);line-height:1.7;
        }

        .bh-cta{
          background:var(--gold);padding:96px 48px;
          position:relative;overflow:hidden;
        }
        .bh-cta::before{
          content:'BITHOUR';
          position:absolute;right:-24px;top:50%;transform:translateY(-50%);
          font-family:'Bebas Neue',sans-serif;font-size:clamp(120px,18vw,240px);
          color:rgba(0,0,0,.07);letter-spacing:-.02em;line-height:1;
          pointer-events:none;white-space:nowrap;
        }
        .bh-cta-in{max-width:1200px;margin:0 auto;position:relative;z-index:1}
        .bh-cta-h{
          font-family:'Bebas Neue',sans-serif;
          font-size:clamp(52px,9vw,112px);
          color:#000;line-height:.9;letter-spacing:-.01em;margin-bottom:28px;
        }
        .bh-cta-sub{
          font-family:'Cormorant Garamond',serif;font-style:italic;
          font-size:19px;color:rgba(0,0,0,.55);line-height:1.65;
          max-width:480px;margin-bottom:36px;
        }
        .bh-cta-btn{
          display:inline-flex;align-items:center;gap:10px;
          background:#000;color:var(--gold);
          padding:17px 36px;border-radius:3px;
          font-family:'DM Sans',sans-serif;font-size:13px;font-weight:800;
          text-decoration:none;letter-spacing:.07em;text-transform:uppercase;
          transition:all .2s;
        }
        .bh-cta-btn:hover{background:#1a1a1a;transform:translateY(-2px);box-shadow:0 10px 28px rgba(0,0,0,.2)}

        .bh-foot{
          background:var(--black);padding:36px 48px;
          border-top:1px solid var(--border);
          display:flex;align-items:center;justify-content:space-between;
          flex-wrap:wrap;gap:20px;
        }
        .bh-foot-brand{
          font-family:'Bebas Neue',sans-serif;font-size:15px;
          letter-spacing:.14em;color:var(--off-white);
          display:flex;align-items:center;gap:9px;
        }
        .bh-foot-addr{font-size:12px;color:rgba(242,239,232,.28);max-width:300px;line-height:1.6}
        .bh-foot-links{display:flex;gap:24px;align-items:center}
        .bh-foot-portal{
          font-size:12px;text-decoration:none;font-weight:700;
          letter-spacing:.03em;transition:color .2s;
          color:var(--gold);display:flex;align-items:center;gap:5px;
        }
        .bh-foot-portal:hover{color:var(--gold-bright)}
        .bh-copy{
          width:100%;font-size:11px;color:rgba(242,239,232,.18);
          padding-top:12px;border-top:1px solid var(--border);margin-top:4px;
        }

        @keyframes bh-up{from{opacity:0;transform:translateY(22px)}to{opacity:1;transform:translateY(0)}}
        @keyframes bh-fade{from{opacity:0}to{opacity:1}}
        @keyframes bh-ticker{from{transform:translateX(0)}to{transform:translateX(-50%)}}

        @media(max-width:900px){
          .bh-nav,.bh-nav.scrolled{padding:18px 24px}
          .bh-nav-links{display:none}
          .bh-hero{padding:0 24px 72px}
          .bh-scroll-hint{display:none}
          .bh-stats{padding:60px 24px 0}
          .bh-stats-grid{grid-template-columns:repeat(2,1fr)}
          .bh-stat:nth-child(2){border-right:none}
          .bh-stat:nth-child(3),.bh-stat:nth-child(4){border-top:1px solid rgba(0,0,0,.07)}
          .bh-clients{padding:48px 24px 64px}
          .bh-name{font-size:17px;padding:4px 12px}
          .bh-svc{padding:72px 24px}
          .bh-svc-top{flex-direction:column}
          .bh-svc-row{grid-template-columns:48px 1fr;gap:0 12px}
          .bh-svc-d{grid-column:2;margin-top:6px}
          .bh-cta{padding:72px 24px}
          .bh-cta::before{font-size:100px;right:-10px}
          .bh-foot{padding:28px 24px}
          .bh-foot-addr{display:none}
        }
      `}</style>

      {/* NAV */}
      <nav className={`bh-nav${scrollY > 50 ? ' scrolled' : ''}`}>
        <button onClick={scrollTo('hero')} className="bh-wordmark">
          <span style={{ width: 32, height: 32, background: '#fff', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <img src="/bithour-logo.webp" alt="Bithour" style={{ width: 22, height: 22, objectFit: 'contain' }} />
          </span>
          BITHOUR PRODUCTION
        </button>
        <div className="bh-nav-links">
          <button onClick={scrollTo('services')} className="bh-nav-a">Services</button>
          <button onClick={scrollTo('clients')} className="bh-nav-a">Portfolio</button>
          <button onClick={scrollTo('stats')} className="bh-nav-a">About</button>
          <Link href="/login" className="bh-pill">
            Masuk ke Portal <ArrowUpRight size={13} />
          </Link>
        </div>
      </nav>

      {/* HERO */}
      <section id="hero" className="bh-hero">
        <div className="bh-hero-glow" />
        <div className="bh-grain" />

        <div className="bh-tag">Brand Centric Marketing &amp; Creative Agency</div>

        <h1 className="bh-h1">
          EMPOWER<br />YOUR{' '}
          <span className="gold">BRAND.</span>
        </h1>

        <p className="bh-sub">
          We turn brands into top leading market players through
          data driven creative campaign that converts billions of sales.
        </p>

        <div className="bh-actions">
          <Link href="/login" className="bh-pill">
            Masuk ke Portal <ArrowUpRight size={13} />
          </Link>
          <button onClick={scrollTo('services')} className="bh-ghost">
            Pelajari Lebih
          </button>
        </div>

        <div className="bh-scroll-hint"><span>Scroll</span></div>
      </section>

      {/* TICKER */}
      <div className="bh-ticker">
        <div className="bh-ticker-track">
          {[...CLIENTS, ...CLIENTS].map((c, i) => (
            <span key={i} className="bh-ticker-item">{c}&nbsp;&nbsp;&#10022;&nbsp;&nbsp;</span>
          ))}
        </div>
      </div>

      {/* STATS */}
      <section id="stats" className="bh-stats">
        <div className="bh-stats-grid">
          {STATS.map((s, i) => (
            <div key={i} className="bh-stat">
              <div className="bh-stat-n">{s.num}</div>
              <div className="bh-stat-l">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* CLIENTS */}
      <div id="clients" className="bh-clients">
        <div className="bh-clients-wrap">
          <div className="bh-clients-label">Trusted by 127+ Leading Brands</div>
          <div className="bh-names">
            {CLIENTS.map((c, i) => (
              <span key={i} className="bh-name">{c}</span>
            ))}
          </div>
        </div>
      </div>

      {/* SERVICES */}
      <section id="services" className="bh-svc">
        <div className="bh-svc-inner">
          <div className="bh-svc-top">
            <h2 className="bh-svc-title">
              WINNING<br />FORMULA<br /><span>TIAP BRAND.</span>
            </h2>
            <p className="bh-svc-desc">
              Kami personalisasi strategi untuk setiap brand.
              Ideation data execution semua dalam satu atap.
            </p>
          </div>
          {SERVICES.map((s, i) => (
            <div key={i} className="bh-svc-row">
              <span className="bh-svc-n">{s.n}</span>
              <span className="bh-svc-name">{s.t}</span>
              <span className="bh-svc-d">{s.d}</span>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="bh-cta">
        <div className="bh-cta-in">
          <h2 className="bh-cta-h">SIAP SCALE<br />UP BRAND<br />SALES?</h2>
          <p className="bh-cta-sub">
            Production house dan 360 marketing agency dengan 77+ sutradara iklan.
            Dari nol sampai ROI.
          </p>
          <Link href="/login" className="bh-cta-btn">
            Masuk ke Portal <ArrowUpRight size={15} />
          </Link>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bh-foot">
        <div>
          <div className="bh-foot-brand">
            <img src="/bithour-logo.webp" alt="" style={{ width: 20, height: 20, objectFit: 'contain' }} />
            BITHOUR PRODUCTION
          </div>
        </div>
        <div className="bh-foot-addr">
          Jl. Raya Cisauk Lapan Blok D8 D9, Sampora,<br />Kec. Cisauk, Kabupaten Tangerang
        </div>
        <div className="bh-foot-links">
          <Link href="/login" className="bh-foot-portal">
            Portal Internal <ArrowUpRight size={11} />
          </Link>
        </div>
        <div className="bh-copy">2025 Bithour Production. All rights reserved.</div>
      </footer>
    </>
  );
}
