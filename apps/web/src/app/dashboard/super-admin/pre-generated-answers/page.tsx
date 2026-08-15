'use client';

import { useState, useEffect } from 'react';

interface PreGeneratedAnswer {
  id: string;
  question_text: string;
  subject: string;
  class_level: string;
  board: string;
  hit_count: number;
  last_served_at: string | null;
  created_at: string;
}

interface Stats {
  total: number;
  totalHits: number;
  avgHitsPerAnswer: number;
}

export default function PreGeneratedAnswersPage() {
  const [answers, setAnswers] = useState<PreGeneratedAnswer[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filter, setFilter] = useState({
    subject: '',
    classLevel: '',
    board: ''
  });

  useEffect(() => {
    fetchAnswers();
  }, [page, filter]);

  const fetchAnswers = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
        sortBy: 'hit_count',
        sortOrder: 'DESC',
        ...(filter.subject && { subject: filter.subject }),
        ...(filter.classLevel && { classLevel: filter.classLevel }),
        ...(filter.board && { board: filter.board })
      });

      const response = await fetch(`/api/super-admin/pre-generated-answers?${params}`);
      const data = await response.json();

      if (data.success) {
        setAnswers(data.data.answers);
        setTotalPages(data.data.totalPages);
        setStats(data.stats);
      }
    } catch (error) {
      console.error('Error fetching pre-generated answers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this pre-generated answer?')) {
      return;
    }

    try {
      const response = await fetch(`/api/super-admin/pre-generated-answers/${id}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        alert('Answer deleted successfully');
        fetchAnswers();
      } else {
        alert('Failed to delete answer');
      }
    } catch (error) {
      console.error('Error deleting answer:', error);
      alert('Error deleting answer');
    }
  };

  return (
    <div className="container mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Pre-Generated Answers</h1>
        <p className="text-muted-foreground">
          Manage pre-computed answers for frequently asked questions
        </p>
      </div>

      {/* Statistics */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-card p-6 rounded-lg shadow">
            <h3 className="text-sm font-medium text-muted-foreground">Total Answers</h3>
            <p className="text-3xl font-bold text-primary">{stats.total}</p>
          </div>
          <div className="bg-card p-6 rounded-lg shadow">
            <h3 className="text-sm font-medium text-muted-foreground">Total Cache Hits</h3>
            <p className="text-3xl font-bold text-green-600">{stats.totalHits}</p>
          </div>
          <div className="bg-card p-6 rounded-lg shadow">
            <h3 className="text-sm font-medium text-muted-foreground">Avg Hits/Answer</h3>
            <p className="text-3xl font-bold text-primary">
              {stats.avgHitsPerAnswer.toFixed(1)}
            </p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-card p-4 rounded-lg shadow mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Subject
            </label>
            <select
              value={filter.subject}
              onChange={(e) => setFilter({ ...filter, subject: e.target.value })}
              className="w-full border border-input rounded-md px-3 py-2"
            >
              <option value="">All Subjects</option>
              <option value="Physics">Physics</option>
              <option value="Chemistry">Chemistry</option>
              <option value="Biology">Biology</option>
              <option value="Mathematics">Mathematics</option>
              <option value="Social Science">Social Science</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Class
            </label>
            <select
              value={filter.classLevel}
              onChange={(e) => setFilter({ ...filter, classLevel: e.target.value })}
              className="w-full border border-input rounded-md px-3 py-2"
            >
              <option value="">All Classes</option>
              <option value="9">Class 9</option>
              <option value="10">Class 10</option>
              <option value="11">Class 11</option>
              <option value="12">Class 12</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Board
            </label>
            <select
              value={filter.board}
              onChange={(e) => setFilter({ ...filter, board: e.target.value })}
              className="w-full border border-input rounded-md px-3 py-2"
            >
              <option value="">All Boards</option>
              <option value="CBSE">CBSE</option>
              <option value="ICSE">ICSE</option>
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={() => {
                setFilter({ subject: '', classLevel: '', board: '' });
                setPage(1);
              }}
              className="w-full bg-muted hover:bg-muted text-foreground font-medium py-2 px-4 rounded-md"
            >
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-card rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <p className="text-muted-foreground">Loading...</p>
          </div>
        ) : answers.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-muted-foreground">No pre-generated answers found</p>
          </div>
        ) : (
          <>
            <table className="min-w-full divide-y divide-border">
              <thead className="bg-muted/40">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Question
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Subject
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Class
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Board
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Hits
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Last Served
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-card divide-y divide-border">
                {answers.map((answer) => (
                  <tr key={answer.id}>
                    <td className="px-6 py-4 text-sm text-foreground max-w-md truncate">
                      {answer.question_text}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                      {answer.subject}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                      {answer.class_level}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                      {answer.board}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-green-600">
                      {answer.hit_count}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                      {answer.last_served_at
                        ? new Date(answer.last_served_at).toLocaleDateString()
                        : 'Never'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={() => handleDelete(answer.id)}
                        className="text-red-600 hover:text-red-900"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination */}
            <div className="bg-muted/40 px-6 py-3 flex items-center justify-between border-t border-border">
              <div className="text-sm text-foreground">
                Page {page} of {totalPages}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                  className="px-4 py-2 border border-input rounded-md text-sm font-medium text-foreground bg-card hover:bg-muted/50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage(Math.min(totalPages, page + 1))}
                  disabled={page === totalPages}
                  className="px-4 py-2 border border-input rounded-md text-sm font-medium text-foreground bg-card hover:bg-muted/50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

