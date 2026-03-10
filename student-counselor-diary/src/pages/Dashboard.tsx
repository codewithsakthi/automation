import React, { useEffect, useState } from 'react';
import { Users, GraduationCap, Award, Activity } from 'lucide-react';

export default function Dashboard() {
  const [stats, setStats] = useState({
    totalStudents: 0,
    activeStudents: 0,
    graduated: 0,
    activities: 0
  });

  useEffect(() => {
    fetch('/api/students')
      .then(res => res.json())
      .then(data => {
        setStats({
          totalStudents: data.length,
          activeStudents: data.length, // Placeholder logic
          graduated: 0,
          activities: 0
        });
      })
      .catch(err => console.error(err));
  }, []);

  const cards = [
    { title: 'Total Students', value: stats.totalStudents, icon: Users, color: 'bg-blue-500' },
    { title: 'Active Students', value: stats.activeStudents, icon: GraduationCap, color: 'bg-green-500' },
    { title: 'Graduated', value: stats.graduated, icon: Award, color: 'bg-purple-500' },
    { title: 'Activities Logged', value: stats.activities, icon: Activity, color: 'bg-orange-500' },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {cards.map((card, index) => (
        <div key={index} className="bg-white rounded-xl shadow-sm p-6 flex items-center space-x-4">
          <div className={`p-3 rounded-lg ${card.color} text-white`}>
            <card.icon size={24} />
          </div>
          <div>
            <p className="text-sm text-gray-500 font-medium">{card.title}</p>
            <h3 className="text-2xl font-bold text-gray-800">{card.value}</h3>
          </div>
        </div>
      ))}
      
      <div className="col-span-1 lg:col-span-2 bg-white rounded-xl shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Recent Activity</h3>
        <div className="space-y-4">
          <p className="text-gray-500 text-sm">No recent activity to display.</p>
        </div>
      </div>

      <div className="col-span-1 lg:col-span-2 bg-white rounded-xl shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Quick Actions</h3>
        <div className="grid grid-cols-2 gap-4">
          <button className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 text-left">
            <span className="font-medium text-blue-600 block">Add New Student</span>
            <span className="text-xs text-gray-500">Register a new student entry</span>
          </button>
          <button className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 text-left">
            <span className="font-medium text-blue-600 block">Generate Report</span>
            <span className="text-xs text-gray-500">Download PDF summary</span>
          </button>
        </div>
      </div>
    </div>
  );
}
