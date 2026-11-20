/* ---------------- Update the Android app from inside it ----------------
   Every push builds a new APK as the "android-latest" release. The app compares its own build number with the latest
   one when it opens (and from the button), and "Update app" downloads the new APK and hands it to Android's installer,
   so there's no browser download to find and open. The first time, Android asks to allow Beat Splicer to install
   updates. Your settings and projects stay, because every build is signed with the same key. */
const APP_REL="https://api.github.com/repos/mcduffog-max/beat-splicer/releases/tags/android-latest";
async function appUpdateCheck(quiet){ const U=NP("AppUpdate"); if(!U) return null;
  try{ const [mine,rel]=await Promise.all([U.info(), fetch(RELAY.url?RELAY.url.replace(/\/$/,"")+"/latest":APP_REL,{cache:"no-store"}).then(r=>r.ok?r.json():Promise.reject(new Error("GitHub said "+r.status)))]); // through the relay once the repository is private
    const m=String(rel.body||"").match(/Build:\s*(\d+)/)||String(rel.name||"").match(/build\s+(\d+)/i), latest=m?+m[1]:0, asset=rel.apk?{browser_download_url:rel.apk}:(rel.assets||[]).find(a=>/\.apk$/i.test(a.name));
    const info={have:+mine.versionCode||1, latest, url:asset&&asset.browser_download_url, canInstall:mine.canInstall}; S._appUpd=info; renderAppUpdate(); if(!quiet) status(info.latest>info.have?`Build ${info.latest} is ready (you have ${info.have}).`:`The app is up to date (build ${info.have}).`); return info; }
  catch(e){ if(!quiet) status("Couldn't check for an update: "+(e&&e.message||e),true); return null; } }
function renderAppUpdate(){ const b=$("appUpd"), i=S._appUpd; if(!b) return; const newer=!!(i&&i.url&&i.latest>i.have); b.hidden=!newer; if(newer) $("appUpdMsg").textContent=`A new version of the app is ready (build ${i.latest}; you have ${i.have}).`; }
async function appUpdateNow(){ const U=NP("AppUpdate"); if(!U) return; const i=S._appUpd&&S._appUpd.url?S._appUpd:await appUpdateCheck(false); if(!i||!i.url) return;
  if(!(i.latest>i.have)){ status(`The app is up to date (build ${i.have}).`); return; }
  const fresh=await U.info().catch(()=>({})); if(fresh.canInstall===false){ status("Android needs your OK once: switch on “Allow from this source” for Beat Splicer, come back, then tap Update app again."); await U.allowInstalls(); return; }
  const h=await U.addListener("progress",e=>{ status(e.percent>=0?`Downloading the update… ${e.percent}%`:"Downloading the update…"); });
  try{ await U.install({url:i.url}); status("Opening Android's installer: tap Update. The app restarts on the new version."); }
  catch(e){ status("The update didn't download: "+(e&&e.message||e),true); }
  finally{ try{ h.remove(); }catch(e){} } }
if(NATIVE){ $("appUpdBtn").onclick=appUpdateNow; $("appUpdCheck").onclick=()=>appUpdateCheck(false); $("appUpdCheck").hidden=false; setTimeout(()=>appUpdateCheck(true),4000); }
