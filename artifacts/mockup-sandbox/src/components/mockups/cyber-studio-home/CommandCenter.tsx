import { Settings, MoreVertical } from 'lucide-react';

export function CommandCenter() {
  return (
    <div style={{
      width: 390,
      height: 820,
      overflow: 'hidden',
      background: '#0A0B0D',
      fontFamily: 'ui-monospace, monospace',
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* Header Strip */}
      <div style={{
        height: 38,
        paddingLeft: 16,
        paddingRight: 16,
        background: '#111316',
        borderBottom: '1px solid #1E2126',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        {/* Logo */}
        <div style={{
          fontFamily: 'ui-monospace, monospace',
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.18em',
          color: '#D1D5DB'
        }}>
          <span style={{ textDecoration: 'underline', textDecorationColor: '#22C55E' }}>CYBER</span> STUDIO
        </div>

        {/* Status Pills */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{
            fontSize: 9,
            fontFamily: 'ui-monospace, monospace',
            color: '#4B5563',
            display: 'flex',
            alignItems: 'center',
            gap: 4
          }}>
            <span style={{ color: '#22C55E', fontSize: 12 }}>●</span>
            OFFLINE
          </div>
          <div style={{
            fontSize: 9,
            fontFamily: 'ui-monospace, monospace',
            color: '#4B5563'
          }}>
            v1.0
          </div>
        </div>

        {/* Settings with Badge */}
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <Settings size={14} color="#4B5563" />
          <div style={{
            position: 'absolute',
            top: -4,
            right: -6,
            width: 12,
            height: 12,
            borderRadius: '50%',
            background: '#F59E0B',
            fontSize: 8,
            fontWeight: 700,
            color: '#0A0B0D',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>3</div>
        </div>
      </div>

      {/* Preset Strip */}
      <div style={{ paddingLeft: 16, paddingRight: 16, paddingTop: 12, paddingBottom: 8 }}>
        <div style={{
          fontSize: 9,
          fontFamily: 'ui-monospace, monospace',
          letterSpacing: '0.05em',
          color: '#4B5563',
          marginBottom: 8
        }}>
          NEW CANVAS —
        </div>
        <div style={{
          display: 'flex',
          gap: 6,
          overflowX: 'auto',
          scrollbarWidth: 'none'
        }}>
          {[
            { label: 'SQ', ratio: '1:1' },
            { label: 'VT', ratio: '9:16' },
            { label: 'WS', ratio: '16:9' },
            { label: 'CSTM', ratio: '—' }
          ].map((preset, i) => (
            <div key={i} style={{
              minWidth: 80,
              background: '#111316',
              border: '1px solid #1E2126',
              borderRadius: 6,
              padding: 8,
              display: 'flex',
              flexDirection: 'column'
            }}>
              {/* Thumbnail - corner tick marks */}
              <svg width="64" height="48" viewBox="0 0 64 48">
                {/* Top-left corner */}
                <path d="M 4 0 L 4 4 M 0 4 L 4 4" stroke="#2D3340" strokeWidth="1" fill="none" />
                {/* Top-right corner */}
                <path d="M 60 0 L 60 4 M 64 4 L 60 4" stroke="#2D3340" strokeWidth="1" fill="none" />
                {/* Bottom-left corner */}
                <path d="M 4 48 L 4 44 M 0 44 L 4 44" stroke="#2D3340" strokeWidth="1" fill="none" />
                {/* Bottom-right corner */}
                <path d="M 60 48 L 60 44 M 64 44 L 60 44" stroke="#2D3340" strokeWidth="1" fill="none" />
              </svg>
              <div style={{
                fontSize: 10,
                fontFamily: 'ui-monospace, monospace',
                color: '#9CA3AF',
                marginTop: 6
              }}>
                {preset.label}
              </div>
              <div style={{
                fontSize: 9,
                fontFamily: 'ui-monospace, monospace',
                color: '#4B5563'
              }}>
                {preset.ratio}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Projects Table */}
      <div style={{ paddingLeft: 16, paddingRight: 16, paddingTop: 8, flex: 1 }}>
        {/* Table Header */}
        <div style={{
          display: 'flex',
          paddingBottom: 6,
          borderBottom: '1px solid #1E2126',
          fontSize: 9,
          fontFamily: 'ui-monospace, monospace',
          color: '#4B5563',
          letterSpacing: '0.05em'
        }}>
          <div style={{ flex: 1 }}>NAME</div>
          <div style={{ width: 64, textAlign: 'right' }}>DIM</div>
          <div style={{ width: 48, textAlign: 'right' }}>MODIFIED</div>
          <div style={{ width: 20 }}></div>
        </div>

        {/* Project Rows */}
        {[
          { name: 'Brand Refresh', dim: '1920×1080', modified: '2h ago' },
          { name: 'App Icons', dim: '1080×1080', modified: 'Yesterday' },
          { name: 'UI Kit', dim: '1080×1920', modified: '3d ago' }
        ].map((project, i) => (
          <div key={i} style={{
            height: 40,
            display: 'flex',
            alignItems: 'center',
            borderBottom: '1px solid #1E2126',
            gap: 12
          }}>
            {/* Thumbnail */}
            <div style={{
              width: 28,
              height: 28,
              borderRadius: 6,
              background: '#0A0B0D',
              border: '1px solid #1E2126',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <svg width="20" height="16" viewBox="0 0 20 16">
                <rect x="1" y="1" width="18" height="14" stroke="#1E2126" strokeWidth="1" fill="none" />
              </svg>
            </div>

            {/* Name */}
            <div style={{
              flex: 1,
              fontSize: 11,
              fontWeight: 500,
              color: '#D1D5DB',
              fontFamily: 'system-ui, sans-serif'
            }}>
              {project.name}
            </div>

            {/* Dimensions */}
            <div style={{
              width: 64,
              fontSize: 9,
              fontFamily: 'ui-monospace, monospace',
              color: '#4B5563',
              textAlign: 'right'
            }}>
              {project.dim}
            </div>

            {/* Modified */}
            <div style={{
              width: 48,
              fontSize: 9,
              fontFamily: 'ui-monospace, monospace',
              color: '#4B5563',
              textAlign: 'right'
            }}>
              {project.modified}
            </div>

            {/* More button */}
            <div style={{ width: 20, display: 'flex', justifyContent: 'center' }}>
              <MoreVertical size={14} color="#4B5563" style={{ cursor: 'pointer' }} />
            </div>
          </div>
        ))}
      </div>

      {/* Stats Row */}
      <div style={{
        paddingLeft: 16,
        paddingRight: 16,
        paddingTop: 8,
        paddingBottom: 8,
        background: '#111316',
        borderTop: '1px solid #1E2126',
        borderBottom: '1px solid #1E2126',
        display: 'flex',
        gap: 12,
        fontSize: 10,
        fontFamily: 'ui-monospace, monospace',
        color: '#4B5563'
      }}>
        <div>
          <span style={{ color: '#22C55E', fontWeight: 700 }}>12</span> PROJECTS
        </div>
        <div style={{ color: '#1E2126' }}>|</div>
        <div>
          <span style={{ color: '#22C55E', fontWeight: 700 }}>2.4 MB</span> USED
        </div>
        <div style={{ color: '#1E2126' }}>|</div>
        <div>
          OFFLINE <span style={{ color: '#22C55E', fontWeight: 700 }}>✓</span>
        </div>
      </div>

      {/* Bottom CTA */}
      <div style={{
        paddingLeft: 16,
        paddingRight: 16,
        paddingTop: 12,
        paddingBottom: 32,
        borderTop: '1px solid #1E2126'
      }}>
        <button style={{
          width: '100%',
          paddingTop: 12,
          paddingBottom: 12,
          borderRadius: 6,
          border: '1px solid #22C55E',
          background: 'transparent',
          color: '#22C55E',
          fontFamily: 'ui-monospace, monospace',
          fontWeight: 700,
          fontSize: 12,
          letterSpacing: '0.05em',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          position: 'relative'
        }}>
          + BLANK PROJECT
          <span style={{
            position: 'absolute',
            right: 12,
            color: '#4B5563',
            fontSize: 14
          }}>↵</span>
        </button>
      </div>
    </div>
  );
}
