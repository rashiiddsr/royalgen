import { useEffect, useState } from 'react';
import { Clock3, Filter } from 'lucide-react';
import { getActivityLogs, ActivityLog as ActivityLogEntry } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';

interface ActivityLogProps {
  showHeader?: boolean;
}

export default function ActivityLog({ showHeader = true }: ActivityLogProps) {
  const { profile } = useAuth();
  const [logs, setLogs] = useState<ActivityLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadLogs = async () => {
      if (!profile?.id) return;
      try {
        setLoading(true);
        const data = await getActivityLogs(profile.id);
        setLogs(data);
      } catch (err) {
        console.error('Failed to load activity logs', err);
        setError('Unable to load activity logs');
      } finally {
        setLoading(false);
      }
    };

    loadLogs();
  }, [profile?.id]);

  return (
    <div>
      {showHeader && (
        <div className="mb-6 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Activity Log</h1>
            <p className="text-gray-600 mt-1">View your recent actions across the platform.</p>
          </div>
          <div className="flex items-center gap-2 px-3 py-2 bg-white rounded-lg border border-gray-200 shadow-sm text-sm text-gray-700">
            <Filter className="h-4 w-4 text-gray-500" />
            Showing personal activity
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-gray-600">Loading activity...</div>
        ) : error ? (
          <div className="p-6 text-center text-red-600">{error}</div>
        ) : logs.length === 0 ? (
          <div className="p-10 text-center text-gray-600">No activity recorded yet.</div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {logs.map((log) => (
              <li key={log.id} className="p-4 flex items-start gap-3 hover:bg-gray-50 dark:hover:bg-slate-800/60">
                <div className="mt-1 text-blue-600">
                  <Clock3 className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 text-sm text-gray-900">
                    <span className="font-semibold capitalize">{log.action}</span>
                    <span className="text-gray-500">on</span>
                    <span className="font-medium">{log.entity_type}</span>
                    <span className="text-gray-400">#{log.entity_id}</span>
                  </div>
                  {log.description && (
                    <p className="text-sm text-gray-700 mt-1">{log.description}</p>
                  )}
                  <p className="text-xs text-gray-500 mt-1">
                    {new Date(log.created_at).toLocaleString()}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
