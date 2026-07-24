import { Settings, MoreVertical } from 'lucide-react';

export function FigmaDark() {
  return (
    <div style={{ width: 390, height: 820, overflow: 'hidden', background: '#0D0E11' }} className="relative font-sans text-[#F2F3F5]">
      {/* Header */}
      <header className="h-9 border-b border-[#252830] flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-[#4F8EF7] rounded flex items-center justify-center">
            <span className="font-mono text-[11px] font-bold text-white">CS</span>
          </div>
          <span className="text-[12px] font-semibold tracking-[0.12em] text-[#F2F3F5]">CYBER STUDIO</span>
        </div>
        <button className="w-[22px] h-[22px] bg-[#252830] rounded flex items-center justify-center">
          <Settings className="w-3.5 h-3.5 text-[#6E7280]" />
        </button>
      </header>

      {/* Canvas Presets Section */}
      <section className="pt-5 px-4">
        <h2 className="text-[10px] font-semibold tracking-[0.14em] text-[#4A4D5A] uppercase mb-3">NEW CANVAS</h2>
        <div className="flex gap-2.5 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
          {/* Square Preset */}
          <div className="flex-shrink-0 w-[88px] bg-[#16181E] border border-[#252830] rounded-xl p-2.5">
            <div className="w-full h-[52px] flex items-center justify-center mb-2">
              <svg width="52" height="52" viewBox="0 0 52 52" fill="none">
                <rect x="0.5" y="0.5" width="51" height="51" fill="#0D0E11" stroke="#252830" strokeWidth="1"/>
                <line x1="26" y1="0" x2="26" y2="52" stroke="#252830" strokeWidth="1"/>
                <line x1="0" y1="26" x2="52" y2="26" stroke="#252830" strokeWidth="1"/>
              </svg>
            </div>
            <div className="text-[11px] font-medium text-[#C8CAD0]">Square</div>
            <div className="text-[10px] text-[#6E7280]">1080 × 1080</div>
          </div>

          {/* Vertical Preset */}
          <div className="flex-shrink-0 w-[88px] bg-[#16181E] border border-[#252830] rounded-xl p-2.5">
            <div className="w-full h-[52px] flex items-center justify-center mb-2">
              <svg width="29" height="52" viewBox="0 0 29 52" fill="none">
                <rect x="0.5" y="0.5" width="28" height="51" fill="#0D0E11" stroke="#252830" strokeWidth="1"/>
                <line x1="14.5" y1="0" x2="14.5" y2="52" stroke="#252830" strokeWidth="1"/>
                <line x1="0" y1="26" x2="29" y2="26" stroke="#252830" strokeWidth="1"/>
              </svg>
            </div>
            <div className="text-[11px] font-medium text-[#C8CAD0]">Vertical</div>
            <div className="text-[10px] text-[#6E7280]">1080 × 1920</div>
          </div>

          {/* Widescreen Preset */}
          <div className="flex-shrink-0 w-[88px] bg-[#16181E] border border-[#252830] rounded-xl p-2.5">
            <div className="w-full h-[52px] flex items-center justify-center mb-2">
              <svg width="52" height="29" viewBox="0 0 52 29" fill="none">
                <rect x="0.5" y="0.5" width="51" height="28" fill="#0D0E11" stroke="#252830" strokeWidth="1"/>
                <line x1="26" y1="0" x2="26" y2="29" stroke="#252830" strokeWidth="1"/>
                <line x1="0" y1="14.5" x2="52" y2="14.5" stroke="#252830" strokeWidth="1"/>
              </svg>
            </div>
            <div className="text-[11px] font-medium text-[#C8CAD0]">Widescreen</div>
            <div className="text-[10px] text-[#6E7280]">1920 × 1080</div>
          </div>

          {/* Custom Preset */}
          <div className="flex-shrink-0 w-[88px] bg-[#16181E] border border-[#252830] rounded-xl p-2.5">
            <div className="w-full h-[52px] flex items-center justify-center mb-2">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <line x1="12" y1="6" x2="12" y2="18" stroke="#4A4D5A" strokeWidth="2" strokeLinecap="round"/>
                <line x1="6" y1="12" x2="18" y2="12" stroke="#4A4D5A" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </div>
            <div className="text-[11px] font-medium text-[#C8CAD0]">Custom</div>
            <div className="text-[10px] text-[#6E7280]">Set dimensions</div>
          </div>
        </div>
      </section>

      {/* Divider */}
      <div className="h-[1px] bg-[#252830] mx-4 my-4" />

      {/* Recent Projects Section */}
      <section className="px-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[10px] font-semibold tracking-[0.14em] text-[#4A4D5A] uppercase">RECENT PROJECTS</h2>
          <span className="text-[10px] font-semibold tracking-[0.14em] text-[#4A4D5A]">2</span>
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          {/* Project 1 */}
          <div className="bg-[#16181E] border border-[#252830] rounded-xl overflow-hidden">
            <div className="h-[90px] bg-[#0D0E11] flex items-center justify-center">
              <svg width="60" height="60" viewBox="0 0 60 60" fill="none">
                <rect x="10" y="10" width="40" height="40" stroke="#252830" strokeWidth="1" fill="none"/>
                <line x1="30" y1="10" x2="30" y2="50" stroke="#252830" strokeWidth="1"/>
                <line x1="10" y1="30" x2="50" y2="30" stroke="#252830" strokeWidth="1"/>
              </svg>
            </div>
            <div className="px-2.5 py-2 flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <div className="text-[11px] font-medium text-[#C8CAD0] truncate">Brand Refresh</div>
                <div className="text-[10px] text-[#6E7280]">2h ago</div>
              </div>
              <button className="w-4 h-4 flex items-center justify-center flex-shrink-0 ml-1">
                <MoreVertical className="w-3 h-3 text-[#6E7280]" />
              </button>
            </div>
          </div>

          {/* Project 2 */}
          <div className="bg-[#16181E] border border-[#252830] rounded-xl overflow-hidden">
            <div className="h-[90px] bg-[#0D0E11] flex items-center justify-center">
              <svg width="60" height="60" viewBox="0 0 60 60" fill="none">
                <rect x="10" y="10" width="40" height="40" stroke="#252830" strokeWidth="1" fill="none"/>
                <line x1="30" y1="10" x2="30" y2="50" stroke="#252830" strokeWidth="1"/>
                <line x1="10" y1="30" x2="50" y2="30" stroke="#252830" strokeWidth="1"/>
              </svg>
            </div>
            <div className="px-2.5 py-2 flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <div className="text-[11px] font-medium text-[#C8CAD0] truncate">App Icons</div>
                <div className="text-[10px] text-[#6E7280]">Yesterday</div>
              </div>
              <button className="w-4 h-4 flex items-center justify-center flex-shrink-0 ml-1">
                <MoreVertical className="w-3 h-3 text-[#6E7280]" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Settings Modal Preview (partially visible at top-right) */}
      <div className="absolute top-12 right-4 w-[180px] bg-[#16181E] border border-[#252830] rounded-xl overflow-hidden" style={{ boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}>
        <div className="px-3 py-2.5 border-b border-[#252830]">
          <h3 className="text-[10px] font-semibold tracking-[0.14em] text-[#4A4D5A] uppercase">SETTINGS</h3>
        </div>
        <div className="py-1">
          <div className="px-3 py-2 text-[11px] font-medium text-[#C8CAD0]">Profile</div>
          <div className="px-3 py-2 text-[11px] font-medium text-[#C8CAD0]">Appearance</div>
          <div className="px-3 py-2 text-[11px] font-medium text-[#C8CAD0]">Storage</div>
          <div className="px-3 py-2 text-[11px] font-medium text-[#C8CAD0]">About</div>
        </div>
      </div>

      {/* Bottom FAB area */}
      <div className="absolute bottom-0 left-0 right-0 px-4 pb-8 pt-3 border-t border-[#252830] bg-[#0D0E11]">
        <button className="w-full py-3 rounded-xl bg-[#4F8EF7] text-white font-semibold text-[13px]">
          + BLANK PROJECT
        </button>
      </div>
    </div>
  );
}
