/* ---------------- Inside the Android app ----------------
   The same app runs inside a real Android app (Capacitor). There, a browser download doesn't exist, so finished videos
   are written straight into the phone's Movies/Beat Splicer folder (pictures into Pictures, other files into Download),
   the screen is kept on while a video is made, and Share hands the file to YouTube, Instagram, TikTok or any app. */
const NATIVE=!!(window.Capacitor&&window.Capacitor.isNativePlatform&&window.Capacitor.isNativePlatform());
const NP=n=>NATIVE&&window.Capacitor.Plugins?window.Capacitor.Plugins[n]:null;
function nativeFolder(name){ return /\.(mp4|webm|mov)$/i.test(name)?"Movies/Beat Splicer":/\.(jpe?g|png|webp)$/i.test(name)?"Pictures/Beat Splicer":"Download/Beat Splicer"; }
const blobB64=b=>new Promise((res,rej)=>{ const r=new FileReader(); r.onload=()=>res(String(r.result).split(",")[1]||""); r.onerror=rej; r.readAsDataURL(b); });
/* written in slices, so a long video never has to sit in memory as one huge string */
async function nativeWrite(path,directory,blob,onProg){ const FS=NP("Filesystem"), step=3*1024*1024;
  for(let at=0; at<blob.size||at===0; at+=step){ const data=await blobB64(blob.slice(at,at+step));
    if(at===0) await FS.writeFile({path,directory,data,recursive:true}); else await FS.appendFile({path,directory,data});
    if(onProg) onProg(Math.min(1,(at+step)/Math.max(1,blob.size))); if(blob.size===0) break; }
  return (await FS.getUri({path,directory})).uri; }
async function nativeSave(name,data){ const FS=NP("Filesystem"); if(!FS) return false; const blob=data instanceof Blob?data:new Blob([data]);
  try{ await FS.requestPermissions(); }catch(e){}
  const path=`${nativeFolder(name)}/${name}`;
  try{ await nativeWrite(path,"EXTERNAL_STORAGE",blob,q=>status(`Saving ${name}… ${Math.round(q*100)}%`)); status(`Saved to ${nativeFolder(name)} on your phone: ${name}.`); return true; }
  catch(e){ try{ await nativeWrite(`Beat Splicer/${name}`,"DOCUMENTS",blob); status(`Saved to Documents/Beat Splicer: ${name}.`); return true; }
    catch(e2){ status("Couldn't save to the phone: "+(e2&&e2.message||e2),true); return true; } } }
async function nativeShare(name,blob,text){ const SH=NP("Share"); if(!SH) return; try{ status("Preparing to share…"); const uri=await nativeWrite(`share/${name}`,"CACHE",blob);
    await SH.share({files:[uri], text:text||undefined, dialogTitle:"Share your video"}); status("Shared."); }
  catch(e){ if(!/cancel/i.test(String(e&&e.message||e))) status("Couldn't share: "+(e&&e.message||e),true); } }
async function nativeAwake(on){ const K=NP("KeepAwake"); if(!K) return false; try{ if(on) await K.keepAwake(); else await K.allowSleep(); return true; }catch(e){ return false; } }
if(NATIVE) document.documentElement.classList.add("native");
