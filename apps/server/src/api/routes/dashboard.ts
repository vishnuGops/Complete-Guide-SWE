import type { FastifyInstance } from 'fastify';
import { dashboardQuerySchema, reportQuerySchema, type DashboardResponse } from '@devpromax/shared';
import { dashboard } from '../dashboardService.js';
import { parseInput } from '../errors.js';
import { buildReport } from '../reportService.js';
import type { ApiDeps } from './types.js';

/**
 * The progress dashboard and its export (ROADMAP P7-5).
 *
 * Two routes over one function: the screen reads the same object the report is
 * built from, so a number that is on screen and a number in the file someone
 * sends to a recruiter cannot disagree.
 */
export function registerDashboardRoutes(app: FastifyInstance, deps: ApiDeps): void {
  app.get('/api/dashboard', async (request): Promise<DashboardResponse> => {
    // The viewer's time zone decides what a day is (P7-11); an unknown one is a
    // 400 rather than a quiet fall back to UTC, which would look like a bug.
    const { tz } = parseInput(dashboardQuerySchema, request.query, 'query');
    return dashboard(deps, tz);
  });

  app.get('/api/dashboard/report', async (request, reply) => {
    const { format, tz } = parseInput(reportQuerySchema, request.query, 'query');
    const report = buildReport(dashboard(deps, tz), format);

    // `attachment` with a name, because this is a file to keep rather than a
    // page to look at - and the HTML one in particular must not be rendered by
    // the app's own origin on the way past.
    await reply
      .header('Content-Type', report.contentType)
      .header('Content-Disposition', `attachment; filename="${report.filename}"`)
      .header('Cache-Control', 'no-store')
      .send(report.body);
  });
}
