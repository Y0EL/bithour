import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'Bithour Production — Internal Portal';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function Image() {
    return new ImageResponse(
        (
            <div
                style={{
                    width: '100%',
                    height: '100%',
                    background: '#0B0B0B',
                    display: 'flex',
                    flexDirection: 'column',
                    padding: '72px 80px',
                    position: 'relative',
                    overflow: 'hidden',
                    fontFamily: 'Georgia, serif',
                }}
            >
                {/* Grid texture */}
                <div style={{
                    position: 'absolute', inset: 0,
                    backgroundImage: 'linear-gradient(rgba(201,168,76,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(201,168,76,0.04) 1px, transparent 1px)',
                    backgroundSize: '80px 80px',
                    display: 'flex',
                }} />

                {/* Top gold bar */}
                <div style={{
                    position: 'absolute', top: 0, left: 0, right: 0, height: '3px',
                    background: 'linear-gradient(90deg, transparent, #C9A84C 20%, #E8C97A 50%, #C9A84C 80%, transparent)',
                    display: 'flex',
                }} />

                {/* Glow top-left */}
                <div style={{
                    position: 'absolute', top: '-120px', left: '-80px',
                    width: '500px', height: '500px',
                    background: 'radial-gradient(circle, rgba(201,168,76,0.08) 0%, transparent 70%)',
                    display: 'flex',
                }} />

                {/* Glow bottom-right */}
                <div style={{
                    position: 'absolute', bottom: '-150px', right: '-100px',
                    width: '600px', height: '600px',
                    background: 'radial-gradient(circle, rgba(201,168,76,0.06) 0%, transparent 70%)',
                    display: 'flex',
                }} />

                {/* Content */}
                <div style={{ display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'space-between', position: 'relative' }}>

                    {/* Header: logo + wordmark */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>
                        <div style={{
                            width: '52px', height: '52px',
                            background: '#fff',
                            borderRadius: '12px',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '30px', fontWeight: 900,
                            color: '#0B0B0B',
                            boxShadow: '0 0 0 1px rgba(201,168,76,0.3)',
                        }}>B</div>
                        <div style={{
                            display: 'flex', flexDirection: 'column',
                        }}>
                            <div style={{ fontSize: '13px', fontWeight: 700, color: '#C9A84C', letterSpacing: '0.25em' }}>BITHOUR PRODUCTION</div>
                            <div style={{ fontSize: '11px', color: 'rgba(242,239,232,0.35)', letterSpacing: '0.15em', marginTop: '2px' }}>INTERNAL PORTAL SYSTEM</div>
                        </div>
                    </div>

                    {/* Main headline */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{
                            fontSize: '96px',
                            fontWeight: 900,
                            color: '#F2EFE8',
                            lineHeight: 0.88,
                            letterSpacing: '-0.03em',
                        }}>CREATOR</div>
                        <div style={{
                            fontSize: '96px',
                            fontWeight: 900,
                            color: 'transparent',
                            lineHeight: 0.88,
                            letterSpacing: '-0.03em',
                            WebkitTextStroke: '2px #C9A84C',
                        }}>PIPELINE</div>
                        <div style={{ marginTop: '24px', display: 'flex', gap: '12px' }}>
                            {['Document Management', 'Invoice & MoU', 'Video Review', 'Analytics'].map(tag => (
                                <div key={tag} style={{
                                    fontSize: '13px',
                                    color: 'rgba(242,239,232,0.5)',
                                    background: 'rgba(201,168,76,0.08)',
                                    border: '1px solid rgba(201,168,76,0.2)',
                                    borderRadius: '100px',
                                    padding: '6px 16px',
                                    letterSpacing: '0.05em',
                                    fontWeight: 600,
                                    display: 'flex',
                                }}>
                                    {tag}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Footer */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
                            {['Next.js 16', 'PostgreSQL', 'Redis', 'Tigris S3'].map((tech, i) => (
                                <div key={tech} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    {i > 0 && <div style={{ width: '3px', height: '3px', background: 'rgba(201,168,76,0.4)', borderRadius: '50%', display: 'flex' }} />}
                                    <div style={{ fontSize: '12px', color: 'rgba(242,239,232,0.3)', letterSpacing: '0.08em', fontWeight: 600 }}>{tech}</div>
                                </div>
                            ))}
                        </div>
                        <div style={{
                            fontSize: '12px',
                            color: 'rgba(201,168,76,0.5)',
                            letterSpacing: '0.12em',
                            fontWeight: 600,
                        }}>bithour-production.fly.dev</div>
                    </div>
                </div>

                {/* Bottom gold line */}
                <div style={{
                    position: 'absolute', bottom: 0, left: 0, right: 0, height: '1px',
                    background: 'linear-gradient(90deg, transparent, rgba(201,168,76,0.3) 30%, rgba(201,168,76,0.3) 70%, transparent)',
                    display: 'flex',
                }} />

                {/* Vertical accent line right */}
                <div style={{
                    position: 'absolute', top: 0, right: '120px', bottom: 0, width: '1px',
                    background: 'linear-gradient(to bottom, transparent, rgba(201,168,76,0.12) 30%, rgba(201,168,76,0.12) 70%, transparent)',
                    display: 'flex',
                }} />
            </div>
        ),
        { width: 1200, height: 630 }
    );
}
