// Force clear old cache
(function(){
  try {
    var v = localStorage.getItem('scg_ver');
    if (v !== 'v99') {
      var keysToKeep = ['scg_fb_cfg','scg_firebase','aircon_session','aircon_dark','aircon_lang','airtrack_pwa'];
      var saved = {};
      keysToKeep.forEach(function(k){ var val=localStorage.getItem(k); if(val) saved[k]=val; });
      localStorage.clear();
      keysToKeep.forEach(function(k){ if(saved[k]) localStorage.setItem(k,saved[k]); });
      localStorage.setItem('scg_ver','v99');
    }
  } catch(e){}
})();
