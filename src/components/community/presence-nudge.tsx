/**
 * Doorway copy — doctrine 11_GROWTH_PAST_FIRST_DISCOVERY.md §8.
 * Invitation only. Never a score.
 */
export function PresenceNudge({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <p className="text-sm text-fg-muted">
        The board is a doorway. The win is sitting with a real person — a meal, a room offered,
        a neighbor&apos;s help. Receiving kindness is part of belonging.
      </p>
    );
  }
  return (
    <aside className="rounded-[var(--radius-xl)] border border-primary/25 bg-primary-soft/40 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
        Past the screen
      </p>
      <h2 className="mt-1 font-display text-lg font-semibold text-fg">
        The win is being with people
      </h2>
      <p className="mt-2 text-sm text-fg-muted">
        Many of us hide after being hurt. We remember the ugly conversations and expect the
        worst — even from someone offering a seat, a meal, or help. This app cannot force you
        out, and it will not score your courage. It can name the fear.
      </p>
      <p className="mt-2 text-sm text-fg-muted">
        If a kind person is offering hospitality, one next yes might be enough: stay, accept
        dinner, let them help, show up for coffee. Giving without ever receiving still keeps
        the wall up. Put the phone down when it is time to be there.
      </p>
      <p className="mt-2 text-xs text-fg-subtle">
        This is not “say yes to everyone.” If something feels harmful, use Report and Block,
        meet in public, and call 988 in a crisis.
      </p>
    </aside>
  );
}
