import { forwardRef } from 'react';
import type { RuleHit } from '../core/types';
import { cn } from '@/lib/utils';

interface Props {
  hits: RuleHit[];
  activeRuleIds: string[];
}

/** REQ-06 規則側欄：命中規則＋權重＋典籍來源，改動即時重算 */
export const RulesPanel = forwardRef<HTMLDivElement, Props>(function RulesPanel(
  { hits, activeRuleIds }, ref,
) {
  return (
    <div className="liuyao-rules-list" ref={ref}>
      {hits.length === 0 && <div className="rule-item info"><div className="detail">無命中規則。</div></div>}
      {hits.map((h, i) => {
        const cls = h.delta > 0 ? 'pos' : h.delta < 0 ? 'neg' : 'info';
        const active = activeRuleIds.includes(h.id) ? ' rule-active' : '';
        return (
          <div key={`${h.id}-${i}`} className={cn(`rule-item ${cls}${active}`)} data-rule-id={h.id}>
            <div className="head">
              <span><span className="id">{h.id}</span>{h.name}</span>
              <span className={`delta ${cls}`}>
                {h.delta > 0 ? `+${h.delta.toFixed(1)}` : h.delta < 0 ? h.delta.toFixed(1) : '資訊'}
              </span>
            </div>
            <div className="detail">{h.detail}</div>
            <div className="source">{h.source}</div>
          </div>
        );
      })}
    </div>
  );
});
