"use client";

import { useEffect, useState } from "react";
import { JobCard } from "./JobCard";

interface Job {
  id: string;
  status: string;
  title: string;
  thumbnail: string | null;
  niche: string;
  platform: string;
  createdAt: string;
  errorMsg: string | null;
}

export function JobQueue() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchJobs = async () => {
    try {
      const res = await fetch("/api/jobs");
      if (res.ok) setJobs(await res.json());
    } catch {
      // silent — next poll will retry
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
    const interval = setInterval(fetchJobs, 5000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-20 rounded-lg bg-[var(--color-surface)] animate-pulse" />
        ))}
      </div>
    );
  }

  if (jobs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4 text-[var(--color-muted)]">
        <p className="text-lg">No jobs yet</p>
        <p className="text-sm">Trigger the pipeline to start generating content</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {jobs.map((job) => (
        <JobCard key={job.id} job={job} />
      ))}
    </div>
  );
}
