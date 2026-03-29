const fs = require('fs');
const path = 'c:/Users/devel/automation/frontend/src/pages/AdminDashboard.tsx';
let c = fs.readFileSync(path, 'utf8');

if (!c.includes('import RiskRadarView')) {
  c = c.replace(
    "import PlacementView from '../features/admin/views/PlacementView';",
    "import PlacementView from '../features/admin/views/PlacementView';\nimport RiskRadarView from '../features/admin/views/RiskRadarView';"
  );
}

const radarStart = '<article id="risk-radar"';
const radarEndMatch = '</article>';

const startIdx = c.indexOf(radarStart);
if (startIdx !== -1) {
  let endIdx = c.indexOf(radarEndMatch, startIdx);
  if (endIdx !== -1) {
    endIdx += radarEndMatch.length;
    c = c.slice(0, startIdx) + c.slice(endIdx);
  }
}

if (!c.includes("activeTab === 'Risk'")) {
  c = c.replace(
    "{activeTab === 'Placements' && (",
    "{activeTab === 'Risk' && (\n        <RiskRadarView onOpenStudentProfile={setSelectedRollNo} />\n      )}\n\n      {activeTab === 'Placements' && ("
  );
}

fs.writeFileSync(path, c);
console.log("RiskRadar integration complete.");
