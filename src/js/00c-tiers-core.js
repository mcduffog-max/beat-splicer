/* Tiers, the basics every part can ask early on (the paywall and purchases are in 49-tiers.js). */
const STORE=/*@STORE@*/false;
const TIER_NAMES=["Free","No watermark","Creator","Pro"], TIER_PRODUCTS={bs_no_watermark:1,bs_creator:2,bs_pro:3};
const GATES={watermark:1, hd:2, platforms:2, lens:2, ownLook:2, note:2, motif:2, youtubeLearn:3, reference:3, taste:3, aiReview:3, batch:3};
const GATE_WORDS={watermark:"Remove the watermark", hd:"1080p videos", platforms:"Every platform", lens:"Lens kits", ownLook:"Your own colour look", note:"The director's note", motif:"The returning image", youtubeLearn:"Learning from your YouTube results", reference:"Edit like this", taste:"Which is better", aiReview:"The AI reviewer", batch:"Several formats at once"};
let TIER_LEVEL=(()=>{ try{ return +localStorage.getItem("beatsplicerTier")||0; }catch(e){ return 0; } })();
function tierLevel(){ return STORE?TIER_LEVEL:3; }
function has(f){ return tierLevel()>=(GATES[f]||0); }
/* asked for something not yet unlocked: say what unlocks it and offer it */
function needTier(f){ if(has(f)) return true; openPaywall(f); return false; }
const FREE_EPS=["shorts","youtube"];
