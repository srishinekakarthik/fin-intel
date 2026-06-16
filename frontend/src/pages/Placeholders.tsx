import { Users } from 'lucide-react';

export function TeamPage() {
  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-9 h-9 bg-gray-800 border border-gray-700 rounded-lg flex items-center justify-center">
          <Users size={18} className="text-gray-400" />
        </div>
        <h1 className="text-white text-2xl font-semibold">Team</h1>
      </div>
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center">
        <Users size={36} className="text-gray-700 mx-auto mb-4" />
        <h2 className="text-gray-300 text-lg font-medium mb-2">Team management</h2>
        <p className="text-gray-500 text-sm max-w-sm mx-auto">
          Invite team members and manage roles. Backend endpoints already exist at /api/v1/users — UI coming soon.
        </p>
      </div>
    </div>
  );
}
