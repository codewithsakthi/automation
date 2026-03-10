import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Edit, Trash2, Plus, Search } from 'lucide-react';
import { Student } from '../types';

export default function StudentList() {
  const [students, setStudents] = useState<Student[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStudents();
  }, []);

  const fetchStudents = async () => {
    try {
      const res = await fetch('/api/students');
      const data = await res.json();
      if (Array.isArray(data)) {
        setStudents(data);
      } else {
        console.error('Received invalid data format:', data);
        setStudents([]);
      }
    } catch (error) {
      console.error('Failed to fetch students', error);
      setStudents([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (roll_no: string) => {
    if (!confirm('Are you sure you want to delete this student?')) return;
    
    try {
      await fetch(`/api/students/${roll_no}`, { method: 'DELETE' });
      setStudents(students.filter(s => s.roll_no !== roll_no));
    } catch (error) {
      console.error('Failed to delete student', error);
    }
  };

  const filteredStudents = students.filter(student => 
    student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    student.roll_no?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    student.klnce_reg_no?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-800">Students Directory</h1>
        <Link 
          to="/students/new" 
          className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700 transition-colors"
        >
          <Plus size={20} />
          Add Student
        </Link>
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input 
              type="text" 
              placeholder="Search by name, roll no, or reg no..." 
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50 text-gray-600 text-sm uppercase">
              <tr>
                <th className="px-6 py-3 font-semibold">Photo</th>
                <th className="px-6 py-3 font-semibold">Name</th>
                <th className="px-6 py-3 font-semibold">Roll No</th>
                <th className="px-6 py-3 font-semibold">Reg No</th>
                <th className="px-6 py-3 font-semibold">Batch</th>
                <th className="px-6 py-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">Loading students...</td>
                </tr>
              ) : filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">No students found.</td>
                </tr>
              ) : (
                filteredStudents.map((student) => (
                  <tr key={student.roll_no} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      {student.profile_pic_path || student.photo ? (
                        <img 
                          src={student.profile_pic_path || student.photo} 
                          alt={student.name} 
                          className="w-10 h-10 rounded-full object-cover" 
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            // If the failed src was NOT the default png, try the default png
                            if (!target.src.includes('default.png') && !target.src.includes('default.svg')) {
                              target.src = '/assets/profiles/default.png';
                            } 
                            // If the failed src WAS the default png, try the default svg
                            else if (target.src.includes('default.png')) {
                              target.src = '/assets/profiles/default.svg';
                            }
                            // If even the svg fails, use a placeholder service
                            else {
                              target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(student.name)}&background=random`;
                              target.onerror = null;
                            }
                          }}
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 text-xs">
                          {student.name.charAt(0)}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 font-medium text-gray-900">{student.name}</td>
                    <td className="px-6 py-4 text-gray-600">{student.roll_no}</td>
                    <td className="px-6 py-4 text-gray-600">{student.klnce_reg_no}</td>
                    <td className="px-6 py-4 text-gray-600">{student.batch}</td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <Link 
                        to={`/students/${student.roll_no}/edit`}
                        className="inline-block p-2 text-blue-600 hover:bg-blue-50 rounded-full"
                        title="Edit"
                      >
                        <Edit size={18} />
                      </Link>
                      <button 
                        onClick={() => handleDelete(student.roll_no!)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-full"
                        title="Delete"
                      >
                        <Trash2 size={18} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
