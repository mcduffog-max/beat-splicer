/* ---------------- The story arc ----------------
   Shot size and emotion follow the song: open wide to set the scene, introduce the subject in medium shots, push in through
   each build, land the drop on a close-up or the eyes, breathe in the quiet middle, and pull back wide to resolve. */
function storyBeat(s,i,plan){
  const dur=S.an?S.an.duration:1, rel=s.start/dur, e=s.e;
  if(rel>0.9 && i>=plan.length-3) return "resolve";
  if(s.build) return "build";
  if(s.drop) return "peak";
  if(rel<0.1 && e<0.55) return "establish";
  if(e>0.7) return rel>0.66?"climax":"peak";
  if(e<0.35) return rel>0.4?"reflect":"establish";
  return rel>0.3?"develop":"introduce";
}
const BEAT_SCALE={establish:0.8,introduce:2.2,develop:2.9,build:3,peak:4.2,climax:4.6,reflect:3.2,resolve:1};
function wantScale(s,beat){ if(beat==="build"){ const k=s.buildK||4; return 2+2.6*(1-Math.min(8,k)/8); } return BEAT_SCALE[beat]; }
function storyOn(){ return !!optV("storyOn"); }
