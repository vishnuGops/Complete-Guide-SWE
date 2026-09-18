import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { interviewSaySchema, type Interview, type InterviewResponse } from '@devpromax/shared';
import {
  advanceInterview,
  currentInterview,
  finishInterview,
  getInterview,
  sayToInterviewer,
  startInterview,
} from '../interviewService.js';
import { parseInput } from '../errors.js';
import { streamEvents } from './stream.js';
import type { ApiDeps } from './types.js';

const idParams = z.object({ id: z.uuid() });

/**
 * Mock interviews (ROADMAP P9-1).
 *
 * Three plain JSON routes for the state of the sitting, and two event streams
 * for the parts a model writes - the same split, and the same `streamEvents`
 * helper, as the coach routes, because a debrief that appears all at once after
 * thirty seconds is the failure streaming exists to avoid.
 */
export function registerInterviewRoutes(app: FastifyInstance, deps: ApiDeps): void {
  app.get('/api/interview', async (): Promise<InterviewResponse> => ({
    interview: currentInterview(deps),
  }));

  app.post('/api/interview', async (): Promise<Interview> => startInterview(deps));

  app.get('/api/interview/:id', async (request): Promise<Interview> => {
    const { id } = parseInput(idParams, request.params, 'params');
    return getInterview(id, deps);
  });

  /** Moving on: approach to coding, coding to review, review to the next problem. */
  app.post('/api/interview/:id/advance', async (request): Promise<Interview> => {
    const { id } = parseInput(idParams, request.params, 'params');
    return advanceInterview(id, deps);
  });

  app.post('/api/interview/:id/say', async (request, reply) => {
    const { id } = parseInput(idParams, request.params, 'params');
    const { message } = parseInput(interviewSaySchema, request.body, 'body');
    return streamEvents(reply, (signal) => sayToInterviewer(id, message, deps, signal));
  });

  app.post('/api/interview/:id/finish', async (request, reply) => {
    const { id } = parseInput(idParams, request.params, 'params');
    return streamEvents(reply, (signal) => finishInterview(id, deps, signal));
  });
}
