/* ---------------- Share and upload pages ---------------- */
const UPLOAD={youtube:"https://studio.youtube.com",shorts:"https://studio.youtube.com",reels:"https://www.instagram.com/",igfeed:"https://www.facebook.com/",tiktok:"https://www.tiktok.com/upload",square:"https://www.linkedin.com/feed/"};
function canShareFiles(){ try{ return !!(navigator.canShare && navigator.canShare({files:[new File(["x"],"x.mp4",{type:"video/mp4"})]})); }catch(e){ return false; } }

