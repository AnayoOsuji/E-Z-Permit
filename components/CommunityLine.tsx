import { formatCommunity, type CommunityStat } from "../lib/durations.ts";

/** "Community average: 23 days (from 14 reports)". Renders nothing until a step has enough reports. */
export function CommunityLine({ stat }: { stat: CommunityStat | undefined }) {
  if (!stat) return null;
  return (
    <p className="community" title="The median of what other founders reported, so one unusual answer doesn't skew it.">
      <span aria-hidden="true">👥 </span>
      {formatCommunity(stat)}
    </p>
  );
}
