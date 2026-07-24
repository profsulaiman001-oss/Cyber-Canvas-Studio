import React from 'react';
import { Settings, MoreVertical } from 'lucide-react';

export function CyberpunkSlate() {
  return (
    <div style={{width: 390, height: 820, overflow: 'hidden', background: '#08090C', fontFamily: 'system-ui, sans-serif'}} className="flex flex-col text-[#E4E8EF] relative">
      {/* Header */}
      <header className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(0,240,255,0.08)' }}>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 flex items-center justify-center font-mono text-[11px] bg-[#101318] text-[#00F0FF] rounded" style={{ border: '1px solid #00F0FF', boxShadow: '0 0 0 1px rgba(0,240,255,0.1)' }}>
            CS
          </div>
          <span className="font-semibold text-[12px] tracking-[0.15em] text-[#E4E8EF]">CYBER STUDIO</span>
        </div>
        <Settings size={15} color="#556070" />
      </header>

      {/* Status Bar hint */}
      <div className="px-4 py-1.5 bg-[#101318] flex items-center justify-between" style={{ borderBottom: '1px solid rgba(0,240,255,0.06)' }}>
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-[#10B981]"></div>
          <span className="text-[9px] font-mono tracking-wider text-[#4A5568]">OFFLINE READY</span>
        </div>
        <span className="text-[9px] font-mono tracking-wider text-[#4A5568]">v1.0</span>
      </div>

      <div className="flex-1 overflow-y-auto overflow-x-hidden flex flex-col">
        {/* Canvas Presets */}
        <div className="pt-5 px-4 flex-shrink-0">
          <div className="text-[10px] font-mono text-[#3A4A55] tracking-wider mb-3">
            // NEW CANVAS
          </div>
          <div className="flex gap-2 overflow-x-auto pb-4 -mx-4 px-4 scrollbar-hide" style={{ scrollbarWidth: 'none' }}>
            
            {/* Square 1:1 */}
            <div className="w-[90px] flex-shrink-0 bg-[#101318] rounded-lg p-2.5 transition-colors cursor-pointer group hover:border-[#00F0FF]" style={{ border: '1px solid rgba(0,240,255,0.10)' }}>
              <div className="w-full h-[60px] bg-[#08090C] rounded flex items-center justify-center mb-2 relative overflow-hidden group-hover:shadow-[0_0_0_1px_rgba(0,240,255,0.22)]">
                 <div className="absolute inset-0 flex flex-wrap gap-[6px] justify-center items-center opacity-[0.12] text-[#00F0FF] p-1">
                   <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
                      <pattern id="dotGrid1" x="0" y="0" width="8" height="8" patternUnits="userSpaceOnUse">
                        <circle cx="1" cy="1" r="1" fill="#00F0FF" />
                      </pattern>
                      <rect x="0" y="0" width="100%" height="100%" fill="url(#dotGrid1)" />
                   </svg>
                 </div>
                 <div className="w-[30px] h-[30px] border border-[rgba(0,240,255,0.2)] z-10"></div>
              </div>
              <div className="text-[11px] font-medium text-[#C8D0DA] whitespace-nowrap">Square 1:1</div>
              <div className="text-[10px] font-mono text-[#3A4A55]">1080×1080</div>
            </div>

            {/* Vertical 9:16 */}
            <div className="w-[90px] flex-shrink-0 bg-[#101318] rounded-lg p-2.5 transition-colors cursor-pointer group hover:border-[#00F0FF]" style={{ border: '1px solid rgba(0,240,255,0.10)' }}>
              <div className="w-full h-[60px] bg-[#08090C] rounded flex items-center justify-center mb-2 relative overflow-hidden group-hover:shadow-[0_0_0_1px_rgba(0,240,255,0.22)]">
                 <div className="absolute inset-0 flex flex-wrap gap-[6px] justify-center items-center opacity-[0.12] text-[#00F0FF] p-1">
                   <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
                      <pattern id="dotGrid2" x="0" y="0" width="8" height="8" patternUnits="userSpaceOnUse">
                        <circle cx="1" cy="1" r="1" fill="#00F0FF" />
                      </pattern>
                      <rect x="0" y="0" width="100%" height="100%" fill="url(#dotGrid2)" />
                   </svg>
                 </div>
                 <div className="w-[20px] h-[36px] border border-[rgba(0,240,255,0.2)] z-10"></div>
              </div>
              <div className="text-[11px] font-medium text-[#C8D0DA] whitespace-nowrap">Vertical 9:16</div>
              <div className="text-[10px] font-mono text-[#3A4A55]">1080×1920</div>
            </div>

            {/* Widescreen 16:9 */}
            <div className="w-[90px] flex-shrink-0 bg-[#101318] rounded-lg p-2.5 transition-colors cursor-pointer group hover:border-[#00F0FF]" style={{ border: '1px solid rgba(0,240,255,0.10)' }}>
              <div className="w-full h-[60px] bg-[#08090C] rounded flex items-center justify-center mb-2 relative overflow-hidden group-hover:shadow-[0_0_0_1px_rgba(0,240,255,0.22)]">
                 <div className="absolute inset-0 flex flex-wrap gap-[6px] justify-center items-center opacity-[0.12] text-[#00F0FF] p-1">
                   <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
                      <pattern id="dotGrid3" x="0" y="0" width="8" height="8" patternUnits="userSpaceOnUse">
                        <circle cx="1" cy="1" r="1" fill="#00F0FF" />
                      </pattern>
                      <rect x="0" y="0" width="100%" height="100%" fill="url(#dotGrid3)" />
                   </svg>
                 </div>
                 <div className="w-[36px] h-[20px] border border-[rgba(0,240,255,0.2)] z-10"></div>
              </div>
              <div className="text-[11px] font-medium text-[#C8D0DA] whitespace-nowrap overflow-hidden text-ellipsis">Widescreen</div>
              <div className="text-[10px] font-mono text-[#3A4A55]">1920×1080</div>
            </div>

            {/* Custom */}
            <div className="w-[90px] flex-shrink-0 bg-[#101318] rounded-lg p-2.5 transition-colors cursor-pointer group hover:border-[#00F0FF]" style={{ border: '1px solid rgba(0,240,255,0.10)' }}>
              <div className="w-full h-[60px] bg-[#08090C] rounded flex items-center justify-center mb-2 relative overflow-hidden group-hover:shadow-[0_0_0_1px_rgba(0,240,255,0.22)]">
                 <div className="absolute inset-0 flex flex-wrap gap-[6px] justify-center items-center opacity-[0.12] text-[#00F0FF] p-1">
                   <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
                      <pattern id="dotGrid4" x="0" y="0" width="8" height="8" patternUnits="userSpaceOnUse">
                        <circle cx="1" cy="1" r="1" fill="#00F0FF" />
                      </pattern>
                      <rect x="0" y="0" width="100%" height="100%" fill="url(#dotGrid4)" />
                   </svg>
                 </div>
                 <div className="text-[#00F0FF] opacity-50 font-mono text-xl z-10">+</div>
              </div>
              <div className="text-[11px] font-medium text-[#C8D0DA] whitespace-nowrap">Custom</div>
              <div className="text-[10px] font-mono text-[#3A4A55]">Set limits</div>
            </div>

          </div>
        </div>

        {/* Divider */}
        <div className="mx-4 my-3 flex-shrink-0" style={{ height: '1px', backgroundColor: 'rgba(0,240,255,0.06)' }}></div>

        {/* Recent Projects */}
        <div className="px-4 flex-shrink-0 pb-6">
          <div className="text-[10px] font-mono text-[#3A4A55] tracking-wider mb-3">
            // RECENT
          </div>
          
          <div className="grid grid-cols-2 gap-2">
            {/* Project 1 */}
            <div className="bg-[#101318] rounded-lg overflow-hidden cursor-pointer group hover:border-[#00F0FF]" style={{ border: '1px solid rgba(0,240,255,0.08)' }}>
              <div className="h-[90px] bg-[#08090C] relative flex items-center justify-center overflow-hidden">
                <svg className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg">
                  <line x1="10%" y1="0" x2="10%" y2="100%" stroke="rgba(0,240,255,0.05)" strokeWidth="1" />
                  <line x1="90%" y1="0" x2="90%" y2="100%" stroke="rgba(0,240,255,0.05)" strokeWidth="1" />
                  <line x1="0" y1="10%" x2="100%" y2="10%" stroke="rgba(0,240,255,0.05)" strokeWidth="1" />
                  <line x1="0" y1="90%" x2="100%" y2="90%" stroke="rgba(0,240,255,0.05)" strokeWidth="1" />
                </svg>
                {/* Wireframe */}
                <div className="w-10 h-10 border border-[rgba(0,240,255,0.15)] flex items-center justify-center relative">
                  <div className="w-full h-[1px] bg-[rgba(0,240,255,0.15)] absolute"></div>
                  <div className="w-[1px] h-full bg-[rgba(0,240,255,0.15)] absolute"></div>
                </div>
              </div>
              <div className="px-2 py-1.5 flex items-start justify-between">
                <div>
                  <div className="text-[11px] text-[#C8D0DA]">Brand Refresh</div>
                  <div className="text-[9px] font-mono text-[#3A4A55] mt-0.5">2h ago</div>
                </div>
                <MoreVertical size={14} color="#556070" className="mt-0.5" />
              </div>
            </div>

            {/* Project 2 */}
            <div className="bg-[#101318] rounded-lg overflow-hidden cursor-pointer group hover:border-[#00F0FF]" style={{ border: '1px solid rgba(0,240,255,0.08)' }}>
              <div className="h-[90px] bg-[#08090C] relative flex items-center justify-center overflow-hidden">
                <svg className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg">
                  <line x1="30%" y1="0" x2="30%" y2="100%" stroke="rgba(0,240,255,0.05)" strokeWidth="1" />
                  <line x1="70%" y1="0" x2="70%" y2="100%" stroke="rgba(0,240,255,0.05)" strokeWidth="1" />
                  <line x1="0" y1="50%" x2="100%" y2="50%" stroke="rgba(0,240,255,0.05)" strokeWidth="1" />
                </svg>
                {/* Wireframe */}
                <div className="w-12 h-12 rounded-full border border-[rgba(0,240,255,0.12)] flex items-center justify-center relative">
                  <div className="w-4 h-4 border border-[rgba(0,240,255,0.2)]"></div>
                </div>
              </div>
              <div className="px-2 py-1.5 flex items-start justify-between">
                <div>
                  <div className="text-[11px] text-[#C8D0DA]">App Icons</div>
                  <div className="text-[9px] font-mono text-[#3A4A55] mt-0.5">Yesterday</div>
                </div>
                <MoreVertical size={14} color="#556070" className="mt-0.5" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom CTA */}
      <div className="px-4 pb-8 pt-3 flex-shrink-0 bg-[#08090C] z-10" style={{ borderTop: '1px solid rgba(0,240,255,0.06)' }}>
        <button 
          className="w-full py-3.5 rounded-lg flex items-center justify-center transition-transform active:scale-[0.98]"
          style={{ 
            background: 'linear-gradient(135deg, #00C5FF 0%, #7C3AED 100%)',
            boxShadow: '0 4px 24px rgba(0,197,255,0.25)'
          }}
        >
          <span className="text-white font-semibold text-[13px] tracking-wide">+ BLANK PROJECT</span>
        </button>
      </div>
    </div>
  );
}
