/**
 * Retargetable damped-spring track (ported from the legacy canvas engine).
 * Unlike Remotion's spring(), each new keyframe starts from the spring's
 * *current* position AND velocity, so a cursor that changes targets mid-flight
 * curves naturally instead of snapping — the "hand-animated" cursor feel.
 *
 * Times are in seconds. omega ≈ stiffness (rad/s), zeta = damping ratio.
 */
type Seg = { t0: number; x0: number; v0: number; target: number; omega: number; zeta: number };

function evalSegment(seg: Seg, t: number) {
  const tau = t - seg.t0;
  if (tau <= 0) return { x: seg.x0, v: seg.v0 };
  const A = seg.x0 - seg.target;
  const wd = seg.omega * Math.sqrt(Math.max(1 - seg.zeta * seg.zeta, 1e-6));
  const B = (seg.v0 + seg.zeta * seg.omega * A) / wd;
  const decay = Math.exp(-seg.zeta * seg.omega * tau);
  const cos = Math.cos(wd * tau);
  const sin = Math.sin(wd * tau);
  const x = seg.target + decay * (A * cos + B * sin);
  const v = decay * (-seg.zeta * seg.omega * (A * cos + B * sin) + (-A * wd * sin + B * wd * cos));
  return { x, v };
}

export function springTrack(keys: { t: number; v: number }[], omega = 16, zeta = 0.85) {
  const segs: Seg[] = [{ t0: keys[0].t, x0: keys[0].v, v0: 0, target: keys[0].v, omega, zeta }];
  for (let i = 1; i < keys.length; i++) {
    const st = evalSegment(segs[segs.length - 1], keys[i].t);
    segs.push({ t0: keys[i].t, x0: st.x, v0: st.v, target: keys[i].v, omega, zeta });
  }
  return (t: number) => {
    let seg = segs[0];
    for (let i = segs.length - 1; i >= 0; i--) {
      if (t >= segs[i].t0) {
        seg = segs[i];
        break;
      }
    }
    return evalSegment(seg, t).x;
  };
}
