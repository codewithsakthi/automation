const fs = require('fs'); 
const file = 'c:/Users/devel/automation/frontend/src/pages/AdminDashboard.tsx'; 
let c = fs.readFileSync(file, 'utf-8'); 
const r = `  useEffect(() => {
    const hash = window.location.hash;
    if (hash && activeTab === 'Overview') {
      const tryScroll = () => {
        const element = document.getElementById(hash.substring(1));
        const mainScroll = document.getElementById('main-scroll');
        if (element && mainScroll) {
          const containerTop = mainScroll.getBoundingClientRect().top;
          const elementTop = element.getBoundingClientRect().top;
          const topOffset = elementTop - containerTop + mainScroll.scrollTop - 60;
          
          mainScroll.scrollTo({
            top: topOffset > 0 ? topOffset : 0,
            behavior: 'smooth'
          });
        }
      };
      
      setTimeout(tryScroll, 100);
      setTimeout(tryScroll, 500);
      setTimeout(tryScroll, 1500);
      setTimeout(tryScroll, 3000);
    }
  }, [activeTab]);`; 
const c2 = c.replace(/useEffect\(\(\) => {[\s\n\r]*const hash = window\.location\.hash;[\s\S]*?}, \[activeTab\]\);/, r); 
if(c !== c2) { 
  fs.writeFileSync(file, c2); 
  console.log('Replaced successfully'); 
} else { 
  console.log('No match found'); 
}
