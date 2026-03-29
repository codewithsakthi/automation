const fs = require('fs');
const path = 'c:/Users/devel/automation/frontend/src/pages/AdminDashboard.tsx';
let c = fs.readFileSync(path, 'utf8');

// remove columns
const colStart = "const columns = useMemo<ColumnDef<PlacementCandidate>[]>(() => [";
const colEnd = "], []);";
const colIdxStart = c.indexOf(colStart);
if (colIdxStart !== -1) {
  const colIdxEnd = c.indexOf(colEnd, colIdxStart) + colEnd.length;
  c = c.slice(0, colIdxStart) + c.slice(colIdxEnd);
}

// remove table
const tblStart = "const table = useReactTable({";
const tblEnd = "});";
const tblIdxStart = c.indexOf(tblStart);
if (tblIdxStart !== -1) {
  const tblIdxEnd = c.indexOf(tblEnd, tblIdxStart) + tblEnd.length;
  c = c.slice(0, tblIdxStart) + c.slice(tblIdxEnd);
}

// remove sorting state
c = c.replace(/const \[sorting, setSorting\] = useState<SortingState>\(\[\]\);\n*/g, '');

// remove placementSearch state again just in case
c = c.replace(/const \[placementSearch, setPlacementSearch\] = useState\([^)]*\);\n*/g, '');

fs.writeFileSync(path, c);
console.log("Cleaned up table and columns");
