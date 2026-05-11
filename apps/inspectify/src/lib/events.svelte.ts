import { driver, type inspectify } from './api';

export type Job = Omit<inspectify.endpoints.Job, 'kind'> & {
  kind: driver.job.JobKind | { kind: 'Waiting'; data: {} };
};

export const jobsListStore: { jobs: driver.job.JobId[] } = $state({ jobs: [] });
export const jobsStore: { jobs: Record<driver.job.JobId, Job> } = $state({ jobs: {} });

export const compilationStatus: { status: inspectify.endpoints.CompilationStatus | null } = $state({
  status: {
    id: null,
    state: 'Succeeded',
    error_output: null, 
  },
});
