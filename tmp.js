const fs = require('fs');
const path = 'c:/Users/devel/automation/frontend/src/pages/AdminDashboard.tsx';
let c = fs.readFileSync(path, 'utf8');

c = c.replace(
  "import LeaderboardView from '../features/admin/views/LeaderboardView';",
  "import LeaderboardView from '../features/admin/views/LeaderboardView';\nimport PlacementView from '../features/admin/views/PlacementView';"
);

const sIdx = c.indexOf("{activeTab === 'Placements' && (");
const eIdx = c.indexOf("{activeTab === 'Staff' && (");

if (sIdx !== -1 && eIdx !== -1) {
  c = c.replace(
    c.substring(sIdx, eIdx),
    "{activeTab === 'Placements' && (\\n        <PlacementView onOpenStudentProfile={setSelectedRollNo} />\\n      )}\\n\\n      "
  );
}

// remove placementSearch state
c = c.replace(/const \[placementSearch, setPlacementSearch\] = useState\([^)]*\);\n*/g, '');

fs.writeFileSync(path, c);
console.log("Done");
